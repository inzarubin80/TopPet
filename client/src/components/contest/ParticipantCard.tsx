import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { Participant, ContestStatus } from '../../types/models';
import { Button } from '../common/Button';
import { buildLoginUrl } from '../../utils/navigation';
import { vote, unvote } from '../../api/votesApi';
import { setUserVoteSlot } from '../../store/slices/contestsSlice';
import { nominationVoteKey } from '../../utils/voteKeys';
import { useToast } from '../../contexts/ToastContext';
import { errorHandler } from '../../utils/errorHandler';
import { descriptionWithBreaks } from '../../utils/formatText';
import { useParticipantPermissions } from '../../hooks/useParticipantPermissions';
import { patchParticipantSubmission } from '../../store/slices/participantsSlice';
import './ParticipantCard.css';

interface ParticipantCardProps {
  participant: Participant;
  contestId: string;
  contestStatus: ContestStatus;
  /** Показывать сумму баллов жюри, если она пришла с сервера */
  juryVotingEnabled?: boolean;
  /** Подпись номинации (если заявка привязана к категории) */
  nominationTitle?: string;
  /** По умолчанию true — если false, кнопка голосования скрыта */
  publicVotingEnabled?: boolean;
  /** Подпись на кнопке голосования вместо «Голосовать» */
  voteCtaLabel?: string;
  onEdit?: (participant: Participant) => void;
  onDelete?: (participant: Participant) => void;
  onShowVoters?: (participant: Participant) => void;
  /** Отчёт по оценкам жюри (доступен организатору конкурса / глобальным админам). */
  onShowJuryReport?: (participant: Participant) => void;
  isContestAdmin?: boolean;
  isVoted?: boolean;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({ 
  participant, 
  contestId, 
  contestStatus,
  nominationTitle,
  publicVotingEnabled = true,
  voteCtaLabel,
  onEdit,
  onDelete,
  onShowVoters,
  onShowJuryReport,
  isContestAdmin,
  isVoted,
  juryVotingEnabled = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const { showError } = useToast();
  const [isVoting, setIsVoting] = useState(false);
  const [moderationBusy, setModerationBusy] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const { isOwner, canEdit, canVote } = useParticipantPermissions(
    participant,
    currentUserId,
    contestStatus,
    publicVotingEnabled
  );
  const authorLabel = isOwner
    ? 'Вы'
    : participant.user_name || `Пользователь ${participant.user_id}`;
  const photos = participant.photos ?? [];

  const submissionStatus = participant.submission_status;
  const showSubmissionBadge =
    submissionStatus === 'pending' || submissionStatus === 'rejected';
  const canModerateSubmission = isContestAdmin && submissionStatus === 'pending';
  const isWinner =
    contestStatus === 'finished' && (participant.is_audience_winner || participant.is_jury_winner);
  const winnerScopeLabel = participant.is_audience_winner && participant.is_jury_winner
    ? 'Зрители и жюри'
    : participant.is_audience_winner
      ? 'Зрители'
      : 'Жюри';
  const winnerMetaItems: string[] = [];
  if (publicVotingEnabled && participant.audience_winner_place != null) {
    winnerMetaItems.push(
      `Зрители: ${participant.audience_winner_place} место${participant.audience_winner_prize ? ` (${participant.audience_winner_prize})` : ''}`
    );
  }
  if (juryVotingEnabled && participant.jury_winner_place != null) {
    winnerMetaItems.push(
      `Жюри: ${participant.jury_winner_place} место${participant.jury_winner_prize ? ` (${participant.jury_winner_prize})` : ''}`
    );
  }

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
    navigate(`/contests/${contestId}/participants/${participant.id}`);
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

  const handleShowVotersClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShowVoters) {
      onShowVoters(participant);
    }
  };

  const handleShowJuryReportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShowJuryReport) {
      onShowJuryReport(participant);
    }
  };

  const handleVoteClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!canVote || isVoting) {
      return;
    }
    if (!isAuthenticated) {
      const returnUrl = location.pathname + location.search;
      navigate(buildLoginUrl(returnUrl));
      return;
    }

    try {
      setIsVoting(true);
      const slotKey = nominationVoteKey(participant.nomination_id);
      if (isVoted) {
        await unvote(contestId, participant.nomination_id);
        dispatch(setUserVoteSlot({ contestId, nominationKey: slotKey, participantId: null }));
      } else {
        await vote(contestId, { participant_id: participant.id });
        dispatch(setUserVoteSlot({ contestId, nominationKey: slotKey, participantId: participant.id }));
      }
    } catch (error) {
      const errorMessage = isVoted ? 'Не удалось отменить голос' : 'Не удалось проголосовать';
      errorHandler.handleError(error, () => showError(errorMessage));
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <>
    <div
      className={`participant-card ${isVoted ? 'participant-card-voted' : ''}`}
      onClick={handleClick}
    >
      <div className="participant-card-main">
        <div className="participant-card-image">
          {photos.length > 0 ? (
            <img
              src={photos[0].thumb_url || photos[0].url}
              alt={participant.pet_name}
              className="participant-card-single-image"
            />
          ) : (
            <div className="participant-card-placeholder">Нет фото</div>
          )}
        </div>
        <div className="participant-card-content">
          <div className="participant-card-name-wrapper">
            <div className="participant-card-title-row">
              <h4 className="participant-card-name">{participant.pet_name}</h4>
              {isWinner ? (
                <div className="participant-card-winner-badge" aria-label={`Победитель: ${winnerScopeLabel}`}>
                  <svg className="participant-card-winner-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor"/>
                    <path d="M5 16H19V19C19 20.1046 18.1046 21 17 21H7C5.89543 21 5 20.1046 5 19V16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="participant-card-winner-text">Победитель</span>
                </div>
              ) : null}
            </div>
            {nominationTitle ? (
              <span className="participant-card-nomination">{nominationTitle}</span>
            ) : null}
            {isWinner ? (
              <span className="participant-card-winner-subtitle">{winnerScopeLabel}</span>
            ) : null}
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
          </div>
          {participant.pet_description?.trim() ? (
            <p className="participant-card-description">
              {descriptionWithBreaks(participant.pet_description.trim())}
            </p>
          ) : null}
          {submissionStatus === 'rejected' &&
          (isContestAdmin || isOwner) &&
          participant.submission_comment?.trim() ? (
            <p className="participant-card-reject-reason">{participant.submission_comment}</p>
          ) : null}
        </div>
      </div>
      <div className="participant-card-footer">
        <div className="participant-card-meta">
          <span className="participant-card-votes">
            Голосов: {participant.total_votes || 0}
          </span>
          {juryVotingEnabled && participant.total_jury_score !== undefined ? (
            <div className="participant-card-jury">
              <span
                className="participant-card-jury-total"
                title="Сумма оценок жюри по всем критериям и членам жюри"
              >
                Жюри: {participant.total_jury_score}
              </span>
            </div>
          ) : null}
          <span className="participant-card-author">Автор: {authorLabel}</span>
          {isVoted && <span className="participant-card-vote-badge">Ваш голос</span>}
          {winnerMetaItems.length > 0 ? (
            <div className="participant-card-winner-meta-wrap">
              {winnerMetaItems.map((item) => (
                <span key={item} className="participant-card-winner-meta">
                  {item}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {canVote && isAuthenticated && (
          <div className="participant-card-vote" onClick={(event) => event.stopPropagation()}>
            <Button
              size="small"
              variant={isVoted ? 'secondary' : 'primary'}
              onClick={handleVoteClick}
              disabled={isVoting}
            >
              {isVoted ? 'Отменить' : voteCtaLabel?.trim() || 'Голосовать'}
            </Button>
          </div>
        )}
        {(isContestAdmin || canEdit) && (
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
              {isContestAdmin && (
                <>
                  <button
                    type="button"
                    className="participant-card-icon-btn"
                    onClick={handleShowVotersClick}
                    title="Кто проголосовал (зрители)"
                    aria-label="Кто проголосовал зрители"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                  </button>
                  {juryVotingEnabled && onShowJuryReport ? (
                    <button
                      type="button"
                      className="participant-card-icon-btn"
                      onClick={handleShowJuryReportClick}
                      title="Отчёт по оценкам жюри"
                      aria-label="Отчёт по оценкам жюри"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="8" y1="13" x2="16" y2="13" />
                        <line x1="8" y1="17" x2="14" y2="17" />
                      </svg>
                    </button>
                  ) : null}
                </>
              )}
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
        )}
      </div>
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
