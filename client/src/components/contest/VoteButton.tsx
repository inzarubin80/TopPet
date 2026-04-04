import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Button } from '../common/Button';
import { vote, getVotes, unvote } from '../../api/votesApi';
import { ContestID, ParticipantID, ContestStatus } from '../../types/models';
import { buildLoginUrl } from '../../utils/navigation';
import { setUserVoteSlot, setUserVotesForContest } from '../../store/slices/contestsSlice';
import { nominationVoteKey } from '../../utils/voteKeys';
import { useToast } from '../../contexts/ToastContext';
import { errorHandler } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import './VoteButton.css';

interface VoteButtonProps {
  contestId: ContestID;
  participantId: ParticipantID;
  contestStatus: ContestStatus;
  /** Номинация заявки (слот голоса); без номинаций не передаётся */
  nominationId?: string | null;
  isOwner?: boolean;
  /** Если false — голосование посетителей недоступно */
  publicVotingEnabled?: boolean;
  /** false — заявка не принята (модерация), голосовать нельзя */
  canReceiveVotes?: boolean;
  /** Текст кнопки вместо «Голосовать» */
  voteCtaLabel?: string;
  onVoted?: (participantId: ParticipantID) => void;
}

export const VoteButton: React.FC<VoteButtonProps> = ({
  contestId,
  participantId,
  contestStatus,
  nominationId,
  isOwner = false,
  publicVotingEnabled = true,
  canReceiveVotes = true,
  voteCtaLabel,
  onVoted,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { showError } = useToast();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const slotKey = nominationVoteKey(nominationId);
  const currentVote = useSelector((state: RootState) => {
    const slots = state.contests.userVoteSlots[contestId];
    return slots ? slots[slotKey] : undefined;
  });
  const [loading, setLoading] = useState(false);
  const [voting, setVoting] = useState(false);

  const loadVote = useCallback(async () => {
    logger.debug('[VoteButton] loadVote start', { contestId, isAuthenticated });
    try {
      setLoading(true);
      const votes = await getVotes(contestId);
      logger.debug('[VoteButton] loadVote result', { contestId, count: votes.length });
      dispatch(setUserVotesForContest({ contestId, votes }));
    } catch (error) {
      logger.error('Failed to load vote', error);
      dispatch(setUserVotesForContest({ contestId, votes: [] }));
    } finally {
      logger.debug('[VoteButton] loadVote end', { contestId });
      setLoading(false);
    }
  }, [contestId, dispatch, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadVote();
    }
  }, [isAuthenticated, contestId, loadVote]);

  const handleVote = async () => {
    if (!isAuthenticated) {
      const returnUrl = location.pathname + location.search;
      navigate(buildLoginUrl(returnUrl));
      return;
    }

    if (contestStatus !== 'voting' || voting || isOwner || !publicVotingEnabled || !canReceiveVotes) {
      return;
    }

    try {
      setVoting(true);
      if (currentVote === participantId) {
        await unvote(contestId, nominationId);
        dispatch(setUserVoteSlot({ contestId, nominationKey: slotKey, participantId: null }));
      } else {
        await vote(contestId, { participant_id: participantId });
        dispatch(setUserVoteSlot({ contestId, nominationKey: slotKey, participantId }));
      }
      if (onVoted) {
        onVoted(participantId);
      }
    } catch (error) {
      const message = currentVote === participantId ? 'Не удалось отменить голос' : 'Не удалось проголосовать';
      errorHandler.handleError(error, () => showError(message));
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

  if (contestStatus === 'voting' && !publicVotingEnabled) {
    return (
      <p className="vote-button-disabled-hint" role="status">
        Пользовательское голосование на этом конкурсе отключено.
      </p>
    );
  }

  if (contestStatus === 'voting' && !canReceiveVotes) {
    return (
      <p className="vote-button-disabled-hint" role="status">
        Заявка на модерации — голосование за эту работу пока недоступно.
      </p>
    );
  }

  if (!isAuthenticated) {
    return (
      <Button variant="primary" size="large" fullWidth={true} onClick={handleVote}>
        Войти для голосования
      </Button>
    );
  }

  if (contestStatus !== 'voting') {
    return null;
  }

  const isVoted = currentVote === participantId;
  const primaryVoteLabel = voteCtaLabel?.trim() || 'Проголосовать';

  return (
    <Button
      variant={isVoted ? 'secondary' : 'primary'}
      onClick={handleVote}
      disabled={loading || voting}
      size="large"
      fullWidth={true}
    >
      {loading ? 'Загрузка...' : voting ? 'Голосование...' : isVoted ? 'Отменить голос' : primaryVoteLabel}
    </Button>
  );
};
