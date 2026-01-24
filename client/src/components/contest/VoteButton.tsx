import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Button } from '../common/Button';
import { vote, getVote, unvote } from '../../api/votesApi';
import { ContestID, ParticipantID, ContestStatus } from '../../types/models';
import { buildLoginUrl } from '../../utils/navigation';
import { setUserVote } from '../../store/slices/contestsSlice';
import './VoteButton.css';

interface VoteButtonProps {
  contestId: ContestID;
  participantId: ParticipantID;
  contestStatus: ContestStatus;
  isOwner?: boolean;
  onVoted?: (participantId: ParticipantID) => void;
}

export const VoteButton: React.FC<VoteButtonProps> = ({
  contestId,
  participantId,
  contestStatus,
  isOwner = false,
  onVoted,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const currentVote = useSelector((state: RootState) =>
    state.contests.userVotes[contestId] ? state.contests.userVotes[contestId] : null
  );
  const [loading, setLoading] = useState(false);
  const [voting, setVoting] = useState(false);

  const loadVote = useCallback(async () => {
    console.log('[VoteButton] loadVote start', { contestId, isAuthenticated });
    try {
      setLoading(true);
      const voteData = await getVote(contestId);
      console.log('[VoteButton] loadVote result', { contestId, participantId: voteData?.participant_id || null });
      dispatch(setUserVote({ contestId, participantId: voteData?.participant_id || null }));
    } catch (error) {
      console.error('Failed to load vote:', error);
      dispatch(setUserVote({ contestId, participantId: null }));
    } finally {
      console.log('[VoteButton] loadVote end', { contestId });
      setLoading(false);
    }
  }, [contestId, dispatch]);

  useEffect(() => {
    if (isAuthenticated) {
      loadVote();
    }
  }, [isAuthenticated, contestId, loadVote]);

  const handleVote = async () => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      const returnUrl = location.pathname + location.search;
      navigate(buildLoginUrl(returnUrl));
      return;
    }

    if (contestStatus !== 'voting' || voting || isOwner) {
      return;
    }

    try {
      setVoting(true);
      if (currentVote === participantId) {
        await unvote(contestId);
        dispatch(setUserVote({ contestId, participantId: null }));
      } else {
        await vote(contestId, { participant_id: participantId });
        dispatch(setUserVote({ contestId, participantId }));
      }
      if (onVoted) {
        onVoted(participantId);
      }
    } catch (error) {
      console.error('Failed to vote:', error);
      alert(currentVote === participantId ? 'Не удалось отменить голос' : 'Не удалось проголосовать');
    } finally {
      setVoting(false);
    }
  };

  if (isOwner && contestStatus === 'voting') {
    return (
      <div className="vote-button-owner-info">
        <svg className="vote-button-owner-info-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
          <path d="M12 16V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="12" cy="8" r="1" fill="currentColor"/>
        </svg>
        <span className="vote-button-owner-info-text">Это ваш участник</span>
      </div>
    );
  }

  if (isOwner) {
    return null;
  }

  if (!isAuthenticated) {
    return (
      <Button
        variant="primary"
        size="large"
        fullWidth={true}
        onClick={handleVote}
      >
        Войти для голосования
      </Button>
    );
  }

  if (contestStatus !== 'voting') {
    return null;
  }

  const isVoted = currentVote === participantId;

  return (
    <Button
      variant={isVoted ? 'secondary' : 'primary'}
      onClick={handleVote}
      disabled={loading || voting}
      size="large"
      fullWidth={true}
    >
      {loading ? 'Загрузка...' : voting ? 'Голосование...' : isVoted ? 'Отменить голос' : 'Проголосовать'}
    </Button>
  );
};
