import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Contest } from '../../types/models';
import './ContestCard.css';

interface ContestCardProps {
  contest: Contest;
}

export const ContestCard: React.FC<ContestCardProps> = ({ contest }) => {
  const navigate = useNavigate();

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Черновик';
      case 'registration':
        return 'Регистрация';
      case 'voting':
        return 'Голосование';
      case 'finished':
        return 'Завершен';
      default:
        return status;
    }
  };

  const getStatusClass = (status: string) => {
    return `status-${status}`;
  };

  return (
    <div className="contest-card" onClick={() => navigate(`/contests/${contest.id}`)}>
      <div className="contest-card-header">
        <h3 className="contest-card-title">{contest.title}</h3>
        <span className={`contest-card-status ${getStatusClass(contest.status)}`}>
          {getStatusLabel(contest.status)}
        </span>
      </div>
      <p className="contest-card-description">{contest.description || 'Нет описания'}</p>
      <div className="contest-card-footer">
        <span className="contest-card-votes">
          Голосов: {contest.total_votes || 0}
        </span>
        <span className="contest-card-date">
          {new Date(contest.created_at).toLocaleDateString('ru-RU')}
        </span>
      </div>
    </div>
  );
};
