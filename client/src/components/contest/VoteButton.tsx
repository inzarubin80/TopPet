import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Button } from '../common/Button';
import { vote, getVotes, unvote } from '../../api/votesApi';
import { ContestID, ParticipantID, ContestStatus } from '../../types/models';
import { buildLoginUrl } from '../../utils/navigation';
import { setUserVotesForContest } from '../../store/slices/contestsSlice';
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
  const isVoted = useSelector((state: RootState) => {
    const slots = state.contests.userVoteSlots[contestId];
    return Boolean(slots?.[participantId]);
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

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7648/ingest/f0553ada-9363-42b1-9afe-d218d34ae783',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d3c4b1'},body:JSON.stringify({sessionId:'d3c4b1',runId:'run1',hypothesisId:'H3',location:'client/src/components/contest/VoteButton.tsx:isVotedEffect',message:'Vote button state changed',data:{contestId,participantId,isVoted,isAuthenticated,pathname:location.pathname},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [contestId, participantId, isVoted, isAuthenticated, location.pathname]);

  const handleVote = async () => {
    if (!isAuthenticated) {
      const returnUrl = location.pathname + location.search;
      navigate(buildLoginUrl(returnUrl));
      return;
    }

    if (contestStatus !== 'voting' || voting || !publicVotingEnabled || !canReceiveVotes) {
      return;
    }

    try {
      setVoting(true);
      // #region agent log
      fetch('http://127.0.0.1:7648/ingest/f0553ada-9363-42b1-9afe-d218d34ae783',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d3c4b1'},body:JSON.stringify({sessionId:'d3c4b1',runId:'run1',hypothesisId:'H4',location:'client/src/components/contest/VoteButton.tsx:handleVote',message:'Handle vote started',data:{contestId,participantId,isVotedBefore:isVoted,action:isVoted?'unvote':'vote'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (isVoted) {
        await unvote(contestId, participantId);
      } else {
        await vote(contestId, { participant_id: participantId });
      }
      const actualVotes = await getVotes(contestId);
      // #region agent log
      fetch('http://127.0.0.1:7648/ingest/f0553ada-9363-42b1-9afe-d218d34ae783',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d3c4b1'},body:JSON.stringify({sessionId:'d3c4b1',runId:'run1',hypothesisId:'H4',location:'client/src/components/contest/VoteButton.tsx:handleVote',message:'Handle vote resynced',data:{contestId,participantId,isPresentAfterResync:actualVotes.some((v)=>v.participant_id===participantId),countAfterResync:actualVotes.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      dispatch(setUserVotesForContest({ contestId, votes: actualVotes }));
      if (onVoted) {
        onVoted(participantId);
      }
    } catch (error) {
      const message = isVoted ? 'Не удалось отменить голос' : 'Не удалось проголосовать';
      errorHandler.handleError(error, () => showError(message));
    } finally {
      setVoting(false);
    }
  };

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

  const primaryVoteLabel = voteCtaLabel?.trim() || 'Проголосовать';
  const iconTitle = isVoted ? 'Убрать лайк' : primaryVoteLabel === 'Проголосовать' ? 'Поставить лайк' : primaryVoteLabel;

  return (
    <Button
      variant={isVoted ? 'secondary' : 'primary'}
      onClick={handleVote}
      disabled={loading || voting}
      size="large"
      fullWidth={true}
      className={`vote-button-main ${isVoted ? 'vote-button-main-active' : ''}`}
      title={iconTitle}
      aria-label={iconTitle}
    >
      <span className="vote-button-main-content">
        <svg
          className={`vote-button-main-icon ${isVoted ? 'vote-button-main-icon-filled' : ''}`}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12 21L10.5 19.7C5 14.8 2 12.1 2 8.8C2 6.1 4.1 4 6.8 4C8.3 4 9.7 4.7 10.6 5.9L12 7.7L13.4 5.9C14.3 4.7 15.7 4 17.2 4C19.9 4 22 6.1 22 8.8C22 12.1 19 14.8 13.5 19.7L12 21Z" />
        </svg>
        {loading || voting ? (
          <span>{loading ? 'Загрузка...' : 'Сохраняем...'}</span>
        ) : null}
      </span>
    </Button>
  );
};
