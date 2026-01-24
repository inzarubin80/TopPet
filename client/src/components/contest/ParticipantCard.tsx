import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../store';
import { Participant, ContestStatus } from '../../types/models';
import { Button } from '../common/Button';
import { buildLoginUrl } from '../../utils/navigation';
import { vote, unvote } from '../../api/votesApi';
import { setUserVote } from '../../store/slices/contestsSlice';
import './ParticipantCard.css';

interface ParticipantCardProps {
  participant: Participant;
  contestId: string;
  contestStatus: ContestStatus;
  onEdit?: (participant: Participant) => void;
  onDelete?: (participant: Participant) => void;
  isVoted?: boolean;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({ 
  participant, 
  contestId, 
  contestStatus,
  onEdit,
  onDelete,
  isVoted
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const currentUserId = useSelector((state: RootState) => state.auth.user?.id);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [isVoting, setIsVoting] = useState(false);
  const isOwner = currentUserId && participant.user_id === currentUserId;
  const authorLabel = isOwner
    ? 'Вы'
    : participant.user_name || `Пользователь ${participant.user_id}`;
  const canEdit = isOwner && (contestStatus === 'draft' || contestStatus === 'registration');
  const canVote = contestStatus === 'voting' && !isOwner;
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
      console.error('Failed to vote from card:', error);
      alert(isVoted ? 'Не удалось отменить голос' : 'Не удалось проголосовать');
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
          <div
            className={`participant-card-gallery participant-card-gallery-${Math.min(
              photos.length,
              3
            )}`}
          >
            {photos.slice(0, 3).map((photo, index) => (
              <div key={photo.id} className="participant-card-thumb">
                <img src={photo.thumb_url || photo.url} alt={participant.pet_name} />
                {index === 2 && photos.length > 3 && (
                  <span className="participant-card-more">+{photos.length - 3}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="participant-card-placeholder">Нет фото</div>
        )}
      </div>
      <div className="participant-card-content">
        <h4 className="participant-card-name">{participant.pet_name}</h4>
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
          {canVote && (
            <div className="participant-card-vote" onClick={(event) => event.stopPropagation()}>
              <Button
                size="small"
                variant={isVoted ? 'secondary' : 'primary'}
                onClick={handleVoteClick}
                disabled={isVoting}
              >
                {!isAuthenticated ? 'Войти' : isVoted ? 'Отменить' : 'Голосовать'}
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
