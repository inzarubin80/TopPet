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
  /** Учитывать призовые места жюри на обложке */
  juryVotingEnabled?: boolean;
  /** Подпись номинации (если заявка привязана к категории) */
  nominationTitle?: string;
  /** По умолчанию true — если false, приз зрительского голосования на обложке скрыт */
  publicVotingEnabled?: boolean;
  onEdit?: (participant: Participant) => void;
  onDelete?: (participant: Participant) => void;
  isContestAdmin?: boolean;
  galleryNavigationState?: ParticipantGalleryNavigationState;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({ 
  participant, 
  contestId, 
  contestStatus,
  nominationTitle,
  publicVotingEnabled = true,
  onEdit,
  onDelete,
  isContestAdmin,
  juryVotingEnabled,
  galleryNavigationState,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id);
  const { showError } = useToast();
  const [moderationBusy, setModerationBusy] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const { isOwner, canEdit } = useParticipantPermissions(
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
  const audienceWinnerPlace = publicVotingEnabled ? participant.audience_winner_place : undefined;
  const juryWinnerPlace = juryVotingEnabled ? participant.jury_winner_place : undefined;

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

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(participant);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(participant);
    }
  };

  const renderWinnerOverlay = (kind: 'audience' | 'jury', place: number) => (
    <div className={`participant-card-winner-overlay participant-card-winner-overlay-${kind}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2L14.8 7.7L21 8.6L16.5 13L17.6 19.2L12 16.3L6.4 19.2L7.5 13L3 8.6L9.2 7.7L12 2Z" />
      </svg>
      <span>{kind === 'audience' ? `Голоса #${place}` : `Жюри #${place}`}</span>
    </div>
  );

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
          <div className="participant-card-overlays">
            {audienceWinnerPlace != null ? renderWinnerOverlay('audience', audienceWinnerPlace) : null}
            {juryWinnerPlace != null ? renderWinnerOverlay('jury', juryWinnerPlace) : null}
          </div>
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
            <span className="participant-card-dot" aria-hidden="true">•</span>
            <span className="participant-card-hearts" title="Пользовательские голоса">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21L10.5 19.7C5 14.8 2 12.1 2 8.8C2 6.1 4.1 4 6.8 4C8.3 4 9.7 4.7 10.6 5.9L12 7.7L13.4 5.9C14.3 4.7 15.7 4 17.2 4C19.9 4 22 6.1 22 8.8C22 12.1 19 14.8 13.5 19.7L12 21Z" />
              </svg>
              {participant.total_votes || 0}
            </span>
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
      {(isContestAdmin || canEdit) && (
        <div className="participant-card-footer">
          <div className="participant-card-icon-actions" onClick={(e) => e.stopPropagation()}>
            {canModerateSubmission ? (
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
            ) : null}
            <div className="participant-card-icon-toolbar">
              {canEdit && (
                <>
                  <button
                    type="button"
                    className="participant-card-icon-btn"
                    onClick={handleEditClick}
                    title="Редактировать заявку"
                    aria-label="Редактировать заявку"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="participant-card-icon-btn participant-card-icon-btn-danger"
                    onClick={handleDeleteClick}
                    title="Удалить"
                    aria-label="Удалить"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
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
