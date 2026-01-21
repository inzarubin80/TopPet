import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Participant } from '../../types/models';
import './ParticipantCard.css';

interface ParticipantCardProps {
  participant: Participant;
  contestId: string;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({ participant, contestId }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/contests/${contestId}/participants/${participant.id}`);
  };

  return (
    <div className="participant-card" onClick={handleClick}>
      <div className="participant-card-image">
        {participant.photos && participant.photos.length > 0 ? (
          <img
            src={participant.photos[0].thumb_url || participant.photos[0].url}
            alt={participant.pet_name}
          />
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
          <span className="participant-card-votes">
            Голосов: {participant.total_votes || 0}
          </span>
        </div>
      </div>
    </div>
  );
};
