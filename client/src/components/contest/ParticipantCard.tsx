import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { Participant, ContestStatus } from '../../types/models';
import { Button } from '../common/Button';
import { useToast } from '../../contexts/ToastContext';
import { errorHandler } from '../../utils/errorHandler';
import { useParticipantPermissions } from '../../hooks/useParticipantPermissions';
import { patchParticipantSubmission } from '../../store/slices/participantsSlice';
import { ParticipantGalleryNavigationState } from '../../types/participantNavigation';
import './ParticipantCard.css';

interface ParticipantCardProps {
  participant: Participant;
  contestId: string;
  contestStatus: ContestStatus;
  /** Подпись номинации (если заявка привязана к категории) */
  nominationTitle?: string;
  /** По умолчанию true — если false, участник не может получать голоса (права редактирования и т.д.) */
  publicVotingEnabled?: boolean;
  isContestAdmin?: boolean;
  galleryNavigationState?: ParticipantGalleryNavigationState;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({ 
  participant, 
  contestId, 
  contestStatus,
  nominationTitle,
  publicVotingEnabled = true,
  isContestAdmin,
  galleryNavigationState,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id);
  const { showError } = useToast();
  const [moderationBusy, setModerationBusy] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const { isOwner } = useParticipantPermissions(
    participant,
    currentUserId,
    contestStatus,
    publicVotingEnabled
  );
  const authorLabel = isOwner ? 'Вы' : participant.user_name || `Пользователь ${participant.user_id}`;
  const workTitle = participant.entry_title?.trim() || participant.pet_name;
  const photos = participant.photos ?? [];

  const submissionStatus = participant.submission_status;
  const showSubmissionBadge =
    submissionStatus === 'pending' || submissionStatus === 'rejected';
  const canModerateSubmission = isContestAdmin && submissionStatus === 'pending';

  const openRejectModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRejectComment('');
    setRejectModalOpen(true);
  };

  const closeRejectModal = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setRejectModalOpen(false);
  };

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (moderationBusy) {
      return;
    }
    try {
      setModerationBusy(true);
      await dispatch(
        patchParticipantSubmission({ participantId: participant.id, submission_status: 'accepted' })
      ).unwrap();
    } catch (error) {
      errorHandler.handleError(error, () => showError('Не удалось принять заявку'));
    } finally {
      setModerationBusy(false);
    }
  };

  const submitReject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const trimmed = rejectComment.trim();
    if (!trimmed) {
      showError('Напишите комментарий для участника');
      return;
    }
    if (moderationBusy) {
      return;
    }
    try {
      setModerationBusy(true);
      await dispatch(
        patchParticipantSubmission({
          participantId: participant.id,
          submission_status: 'rejected',
          submission_comment: trimmed,
        })
      ).unwrap();
      setRejectModalOpen(false);
      setRejectComment('');
    } catch (error) {
      errorHandler.handleError(error, () => showError('Не удалось отклонить заявку'));
    } finally {
      setModerationBusy(false);
    }
  };

  const handleClick = () => {
    navigate(`/contests/${contestId}/participants/${participant.id}`, {
      state: galleryNavigationState ? { galleryNavigation: galleryNavigationState } : undefined,
    });
  };

  const avatarInitial = (authorLabel.trim()[0] || 'У').toUpperCase();

  return (
    <>
    <div className="participant-card" onClick={handleClick}>
      <div className="participant-card-image-wrap">
        <div className="participant-card-image">
          {photos.length > 0 ? (
            <img
              src={photos[0].thumb_url || photos[0].url}
              alt={workTitle}
              className="participant-card-single-image"
            />
          ) : (
            <div className="participant-card-placeholder">Нет фото</div>
          )}
        </div>
        <div className="participant-card-summary">
          <h4 className="participant-card-name">{workTitle}</h4>
          <div className="participant-card-meta-row">
            <span className="participant-card-avatar" aria-hidden="true">
              {avatarInitial}
            </span>
            <span className="participant-card-author">{authorLabel}</span>
            <span className="participant-card-dot" aria-hidden="true">•</span>
            <span className="participant-card-comments">💬 {participant.comment_count ?? 0}</span>
          </div>
          {nominationTitle ? <span className="participant-card-nomination">{nominationTitle}</span> : null}
          {showSubmissionBadge ? (
            <span
              className={
                submissionStatus === 'rejected'
                  ? 'participant-card-submission-badge participant-card-submission-badge-rejected'
                  : 'participant-card-submission-badge participant-card-submission-badge-pending'
              }
            >
              {submissionStatus === 'rejected' ? 'Отклонено' : 'На модерации'}
            </span>
          ) : null}
          {submissionStatus === 'rejected' &&
          (isContestAdmin || isOwner) &&
          participant.submission_comment?.trim() ? (
            <p className="participant-card-reject-reason">{participant.submission_comment}</p>
          ) : null}
        </div>
      </div>
      {canModerateSubmission ? (
        <div className="participant-card-footer">
          <div className="participant-card-icon-actions" onClick={(e) => e.stopPropagation()}>
            <div className="participant-card-moderation-row">
              <button
                type="button"
                className="participant-card-moderation-btn participant-card-moderation-accept"
                onClick={handleAccept}
                disabled={moderationBusy}
                title="Принять заявку"
              >
                Принять
              </button>
              <button
                type="button"
                className="participant-card-moderation-btn participant-card-moderation-reject"
                onClick={openRejectModal}
                disabled={moderationBusy}
                title="Отклонить заявку"
              >
                Отклонить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
    {rejectModalOpen ? (
      <div className="participant-card-reject-overlay" role="presentation" onClick={() => closeRejectModal()}>
        <div
          className="participant-card-reject-dialog"
          role="dialog"
          aria-labelledby="participant-reject-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="participant-reject-title" className="participant-card-reject-title">
            Отклонить заявку
          </h3>
          <p className="participant-card-reject-hint">
            Участник увидит этот комментарий. Поле обязательно.
          </p>
          <textarea
            className="participant-card-reject-textarea"
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Например: уточните описание или замените фото…"
            rows={5}
            maxLength={2000}
            disabled={moderationBusy}
          />
          <div className="participant-card-reject-actions">
            <Button type="button" variant="secondary" size="small" onClick={(e) => closeRejectModal(e)} disabled={moderationBusy}>
              Отмена
            </Button>
            <Button type="button" variant="primary" size="small" onClick={submitReject} disabled={moderationBusy}>
              {moderationBusy ? 'Отправка…' : 'Отклонить'}
            </Button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
};
