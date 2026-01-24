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
  isVoted?: boolean;
  isWinner?: boolean;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({ 
  participant, 
  contestId, 
  contestStatus,
  onEdit,
  onDelete,
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
          {canEdit && (
            <div className="participant-card-actions" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="secondary"
                size="small"
                onClick={handleEditClick}
              >
                Редактировать
              </Button>
              <Button
                variant="danger"
                size="small"
                onClick={handleDeleteClick}
              >
                Удалить
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
