import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { Participant, ContestStatus } from '../../types/models';
import { Button } from '../common/Button';
import { buildLoginUrl } from '../../utils/navigation';
import { vote, unvote } from '../../api/votesApi';
import { setUserVote } from '../../store/slices/contestsSlice';
import { useToast } from '../../contexts/ToastContext';
import { errorHandler } from '../../utils/errorHandler';
import { useParticipantPermissions } from '../../hooks/useParticipantPermissions';
import './ParticipantCard.css';

interface ParticipantCardProps {
  participant: Participant;
  contestId: string;
  contestStatus: ContestStatus;
  onEdit?: (participant: Participant) => void;
  onDelete?: (participant: Participant) => void;
  onShowVoters?: (participant: Participant) => void;
  isContestAdmin?: boolean;
  isVoted?: boolean;
  isWinner?: boolean;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({ 
  participant, 
  contestId, 
  contestStatus,
  onEdit,
  onDelete,
  onShowVoters,
  isContestAdmin,
  isVoted,
  isWinner = false
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const { showError } = useToast();
  const [isVoting, setIsVoting] = useState(false);
  const { isOwner, canEdit, canVote } = useParticipantPermissions(participant, currentUserId, contestStatus);
  const authorLabel = isOwner
    ? 'Вы'
    : participant.user_name || `Пользователь ${participant.user_id}`;
  const photos = participant.photos ?? [];

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
      if (isVoted) {
        await unvote(contestId);
        dispatch(setUserVote({ contestId, participantId: null }));
      } else {
        await vote(contestId, { participant_id: participant.id });
        dispatch(setUserVote({ contestId, participantId: participant.id }));
      }
    } catch (error) {
      const errorMessage = isVoted ? 'Не удалось отменить голос' : 'Не удалось проголосовать';
      errorHandler.handleError(error, () => showError(errorMessage));
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div
      className={`participant-card ${isVoted ? 'participant-card-voted' : ''}`}
      onClick={handleClick}
    >
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
          <h4 className="participant-card-name">{participant.pet_name}</h4>
          {isWinner && contestStatus === 'finished' && (
            <div className="participant-card-winner-badge">
              <svg className="participant-card-winner-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 16L3 5L8.5 10L12 4L15.5 10L21 5L19 16H5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="currentColor"/>
                <path d="M5 16H19V19C19 20.1046 18.1046 21 17 21H7C5.89543 21 5 20.1046 5 19V16Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="participant-card-winner-text">Победитель</span>
            </div>
          )}
        </div>
        <p className="participant-card-description">
          {participant.pet_description || 'Нет описания'}
        </p>
        <div className="participant-card-footer">
          <div className="participant-card-meta">
            <span className="participant-card-votes">
              Голосов: {participant.total_votes || 0}
            </span>
            <span className="participant-card-author">Автор: {authorLabel}</span>
            {isVoted && <span className="participant-card-vote-badge">Ваш голос</span>}
          </div>
          {canVote && isAuthenticated && (
            <div className="participant-card-vote" onClick={(event) => event.stopPropagation()}>
              <Button
                size="small"
                variant={isVoted ? 'secondary' : 'primary'}
                onClick={handleVoteClick}
                disabled={isVoting}
              >
                {isVoted ? 'Отменить' : 'Голосовать'}
              </Button>
            </div>
          )}
          {(isContestAdmin || canEdit) && (
            <div className="participant-card-icon-actions" onClick={(e) => e.stopPropagation()}>
              {isContestAdmin && (
                <button
                  type="button"
                  className="participant-card-icon-btn"
                  onClick={handleShowVotersClick}
                  title="Проголосовавшие"
                  aria-label="Проголосовавшие"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </button>
              )}
              {canEdit && (
                <>
                  <button
                    type="button"
                    className="participant-card-icon-btn"
                    onClick={handleEditClick}
                    title="Редактировать"
                    aria-label="Редактировать"
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
          )}
        </div>
      </div>
    </div>
  );
};
