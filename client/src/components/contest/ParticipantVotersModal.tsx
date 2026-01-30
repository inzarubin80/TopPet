import React, { useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { getParticipantVoters } from '../../api/participantsApi';
import { VoterInfo } from '../../types/api';
import './ParticipantVotersModal.css';

interface ParticipantVotersModalProps {
  isOpen: boolean;
  onClose: () => void;
  contestId: string;
  participantId: string;
  participantName: string;
}

const formatVotedAt = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
};

export const ParticipantVotersModal: React.FC<ParticipantVotersModalProps> = ({
  isOpen,
  onClose,
  contestId,
  participantId,
  participantName,
}) => {
  const [voters, setVoters] = useState<VoterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !contestId || !participantId) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getParticipantVoters(contestId, participantId)
      .then((data) => {
        if (!cancelled) {
          setVoters(data.voters || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Не удалось загрузить список');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, contestId, participantId]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Проголосовавшие за ${participantName}`}
    >
      <div className="participant-voters-modal-body">
        {loading && (
          <div className="participant-voters-modal-loading">
            <LoadingSpinner size="medium" />
          </div>
        )}
        {!loading && error && (
          <div className="participant-voters-modal-error">{error}</div>
        )}
        {!loading && !error && voters.length === 0 && (
          <div className="participant-voters-modal-empty">Нет голосов</div>
        )}
        {!loading && !error && voters.length > 0 && (
          <ul className="participant-voters-modal-list">
            {voters.map((v) => (
              <li key={`${v.user_id}-${v.voted_at}`} className="participant-voters-modal-item">
                <span className="participant-voters-modal-name">{v.user_name}</span>
                <span className="participant-voters-modal-date">{formatVotedAt(v.voted_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
};
