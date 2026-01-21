import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Button } from '../common/Button';
import { vote, getVote } from '../../api/votesApi';
import { ContestID, ParticipantID } from '../../types/models';
import './VoteButton.css';

interface VoteButtonProps {
  contestId: ContestID;
  participantId: ParticipantID;
  contestStatus: string;
}

export const VoteButton: React.FC<VoteButtonProps> = ({
  contestId,
  participantId,
  contestStatus,
}) => {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const [currentVote, setCurrentVote] = useState<ParticipantID | null>(null);
  const [loading, setLoading] = useState(false);
  const [voting, setVoting] = useState(false);

  const loadVote = useCallback(async () => {
    try {
      setLoading(true);
      const voteData = await getVote(contestId);
      if (voteData && voteData.participant_id) {
        setCurrentVote(voteData.participant_id);
      }
    } catch (error) {
      console.error('Failed to load vote:', error);
    } finally {
      setLoading(false);
    }
  }, [contestId]);

  useEffect(() => {
    if (isAuthenticated && contestStatus === 'published') {
      loadVote();
    }
  }, [isAuthenticated, contestId, contestStatus, loadVote]);

  const handleVote = async () => {
    if (!isAuthenticated || contestStatus !== 'published' || voting) {
      return;
    }

    try {
      setVoting(true);
      await vote(contestId, { participant_id: participantId });
      setCurrentVote(participantId);
    } catch (error) {
      console.error('Failed to vote:', error);
      alert('Не удалось проголосовать');
    } finally {
      setVoting(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="vote-button-unauthorized">
        Войдите, чтобы проголосовать
      </div>
    );
  }

  if (contestStatus !== 'published') {
    return null;
  }

  const isVoted = currentVote === participantId;

  return (
    <Button
      variant={isVoted ? 'secondary' : 'primary'}
      onClick={handleVote}
      disabled={loading || voting}
      size="small"
    >
      {loading ? 'Загрузка...' : voting ? 'Голосование...' : isVoted ? 'Вы проголосовали' : 'Проголосовать'}
    </Button>
  );
};
