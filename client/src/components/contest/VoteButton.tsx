import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Button } from '../common/Button';
import { vote, getVotes, unvote } from '../../api/votesApi';
import { ContestID, ParticipantID } from '../../types/models';
import { buildLoginUrl } from '../../utils/navigation';
import { setUserVotesForContest } from '../../store/slices/contestsSlice';
import { useToast } from '../../contexts/ToastContext';
import { errorHandler } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import './VoteButton.css';

interface VoteButtonProps {
  contestId: ContestID;
  participantId: ParticipantID;
  /** Номинация заявки (слот голоса); без номинаций не передаётся */
  nominationId?: string | null;
  isOwner?: boolean;
  /** false — заявка не принята (модерация), голосовать нельзя */
  canReceiveVotes?: boolean;
  /** false — лайки недоступны (например черновик или конкурс завершён); при true — этапы приёма заявок и голосования */
  phaseAllowsLikes?: boolean;
  /** Текст кнопки вместо «Голосовать» */
  voteCtaLabel?: string;
  onVoted?: (participantId: ParticipantID) => void;
  /** По умолчанию true — на странице работы в строке с числом голосов удобнее false */
  fullWidth?: boolean;
  /**
   * Полоса «N Нравится» (сердце + число), как на странице работы в галерее;
   * по умолчанию — круглая кнопка только с иконкой.
   */
  appearance?: 'default' | 'statStrip';
  /** Число голосов (для statStrip); обновляется с карточкой участника / WebSocket */
  totalVotes?: number;
  /** Клик по числу «N Нравится» — открыть список проголосовавших (сердце по-прежнему ставит лайк). */
  onViewLikes?: () => void;
}

export const VoteButton: React.FC<VoteButtonProps> = ({
  contestId,
  participantId,
  nominationId,
  isOwner = false,
  canReceiveVotes = true,
  phaseAllowsLikes = true,
  voteCtaLabel,
  onVoted,
  fullWidth = true,
  appearance = 'default',
  totalVotes = 0,
  onViewLikes,
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

  const handleVote = async () => {
    if (!isAuthenticated) {
      const returnUrl = location.pathname + location.search;
      navigate(buildLoginUrl(returnUrl));
      return;
    }

    if (voting || !canReceiveVotes || !phaseAllowsLikes) {
      return;
    }

    try {
      setVoting(true);
      if (isVoted) {
        await unvote(contestId, participantId);
      } else {
        await vote(contestId, { participant_id: participantId });
      }
      const actualVotes = await getVotes(contestId);
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

  const count = totalVotes ?? 0;
  const statStripLabel =
    loading || voting ? (loading ? 'Загрузка…' : 'Сохраняем…') : `${count} Нравится`;
  const statStripAria =
    loading || voting
      ? loading
        ? 'Загрузка состояния голосования'
        : 'Сохранение голоса'
      : isVoted
        ? `Убрать лайк, сейчас ${count} голосов`
        : `Поставить лайк, сейчас ${count} голосов`;

  const statStripHeart = (filled: boolean) => (
    <svg
      className={`vote-button-stat-strip-heart ${filled ? 'vote-button-stat-strip-heart--filled' : ''}`}
      viewBox="0 0 24 24"
      width={22}
      height={22}
      aria-hidden="true"
    >
      {filled ? (
        <path
          fill="currentColor"
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      ) : (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinejoin="round"
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      )}
    </svg>
  );

  if (appearance === 'statStrip') {
    const countBlock =
      loading || voting ? (
        <span className="vote-button-stat-strip-label vote-button-stat-strip-label--loading">{statStripLabel}</span>
      ) : (
        <>
          <span className="vote-button-stat-strip-count">{count}</span> Нравится
        </>
      );

    const readonlyStrip = (filled: boolean) =>
      onViewLikes ? (
        <div
          className="vote-button-stat-strip vote-button-stat-strip--split vote-button-stat-strip--readonly"
          role="group"
          aria-label={`${count} ${count === 1 ? 'лайк' : 'лайков'}`}
        >
          <span className="vote-button-stat-strip-heart-wrap" aria-hidden="true">
            {statStripHeart(filled)}
          </span>
          <button
            type="button"
            className="vote-button-stat-strip-count-area"
            onClick={onViewLikes}
            aria-label={`Кто поставил лайк: ${count}`}
          >
            <span className="vote-button-stat-strip-count">{count}</span> Нравится
          </button>
        </div>
      ) : (
        <div
          className="vote-button-stat-strip vote-button-stat-strip--readonly"
          role="status"
          aria-label={`${count} ${count === 1 ? 'лайк' : 'лайков'}`}
        >
          {statStripHeart(filled)}
          <span className="vote-button-stat-strip-label">
            <span className="vote-button-stat-strip-count">{count}</span> Нравится
          </span>
        </div>
      );

    if (!canReceiveVotes) {
      return (
        <div className="vote-button-stat-strip-block">
          {readonlyStrip(false)}
          <p className="vote-button-stat-strip-hint" role="status">
            Заявка на модерации — голосование за эту работу пока недоступно.
          </p>
        </div>
      );
    }

    if (!phaseAllowsLikes) {
      return (
        <div className="vote-button-stat-strip-block">
          {readonlyStrip(isVoted)}
          <p className="vote-button-stat-strip-hint" role="status">
            Лайки доступны на этапах приёма заявок и голосования. Сейчас другая фаза конкурса.
          </p>
        </div>
      );
    }

    if (!isAuthenticated) {
      if (onViewLikes) {
        return (
          <div
            className="vote-button-stat-strip vote-button-stat-strip--split"
            role="group"
            aria-label={`Войти, чтобы голосовать. Сейчас ${count} голосов`}
          >
            <button
              type="button"
              className="vote-button-stat-strip-heart-area"
              onClick={handleVote}
              aria-label="Войти, чтобы поставить лайк"
            >
              {statStripHeart(false)}
            </button>
            <button
              type="button"
              className="vote-button-stat-strip-count-area"
              onClick={onViewLikes}
              aria-label={`Кто поставил лайк: ${count}`}
            >
              <span className="vote-button-stat-strip-count">{count}</span> Нравится
            </button>
          </div>
        );
      }
      return (
        <button
          type="button"
          className="vote-button-stat-strip"
          onClick={handleVote}
          aria-label={`Войти, чтобы голосовать. Сейчас ${count} голосов`}
        >
          {statStripHeart(false)}
          <span className="vote-button-stat-strip-label">
            <span className="vote-button-stat-strip-count">{count}</span> Нравится
          </span>
        </button>
      );
    }

    if (onViewLikes) {
      return (
        <div
          className={`vote-button-stat-strip vote-button-stat-strip--split ${isVoted ? 'vote-button-stat-strip--active' : ''}`}
          role="group"
        >
          <button
            type="button"
            className="vote-button-stat-strip-heart-area"
            onClick={handleVote}
            disabled={loading || voting}
            title={isVoted ? 'Убрать лайк' : 'Поставить лайк'}
            aria-label={statStripAria}
          >
            {statStripHeart(isVoted)}
          </button>
          <button
            type="button"
            className="vote-button-stat-strip-count-area"
            onClick={onViewLikes}
            aria-label={`Кто поставил лайк: ${count}`}
          >
            {countBlock}
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        className={`vote-button-stat-strip ${isVoted ? 'vote-button-stat-strip--active' : ''}`}
        onClick={handleVote}
        disabled={loading || voting}
        title={isVoted ? 'Убрать лайк' : 'Поставить лайк'}
        aria-label={statStripAria}
      >
        {statStripHeart(isVoted)}
        <span className="vote-button-stat-strip-label">
          {loading || voting ? (
            statStripLabel
          ) : (
            <>
              <span className="vote-button-stat-strip-count">{count}</span> Нравится
            </>
          )}
        </span>
      </button>
    );
  }

  if (!canReceiveVotes) {
    return (
      <p className="vote-button-disabled-hint" role="status">
        Заявка на модерации — голосование за эту работу пока недоступно.
      </p>
    );
  }

  if (!phaseAllowsLikes) {
    return (
      <p className="vote-button-disabled-hint" role="status">
        Лайки доступны на этапах приёма заявок и голосования. Сейчас другая фаза конкурса.
      </p>
    );
  }

  if (!isAuthenticated) {
    return (
      <Button variant="primary" size="large" fullWidth={fullWidth} onClick={handleVote}>
        Войти для голосования
      </Button>
    );
  }

  const primaryVoteLabel = voteCtaLabel?.trim() || 'Проголосовать';
  const iconTitle = isVoted ? 'Убрать лайк' : primaryVoteLabel === 'Проголосовать' ? 'Поставить лайк' : primaryVoteLabel;

  return (
    <Button
      variant={isVoted ? 'secondary' : 'primary'}
      onClick={handleVote}
      disabled={loading || voting}
      size="large"
      fullWidth={fullWidth}
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
