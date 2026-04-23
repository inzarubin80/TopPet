import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { NominationTabsBar } from '../common/NominationTabsBar';
import { getParticipantsByContest, type ParticipantsListNominationFilter } from '../../api/participantsApi';
import { getVotes, unvote, vote } from '../../api/votesApi';
import type { ContestID, ContestStatus, Nomination, Participant } from '../../types/models';
import { RootState } from '../../store';
import { setUserVotesForContest, updateParticipantVoteTotal } from '../../store/slices/contestsSlice';
import { useToast } from '../../contexts/ToastContext';
import { errorHandler } from '../../utils/errorHandler';
import { buildLoginUrl } from '../../utils/navigation';
import './ContestUserVotingTab.css';

type Props = {
  contestId: ContestID;
  contestStatus: ContestStatus;
  nominations: Nomination[];
};

export const ContestUserVotingTab: React.FC<Props> = ({
  contestId,
  contestStatus,
  nominations,
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { showError } = useToast();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const votedMap = useSelector((state: RootState) => state.contests.userVoteSlots[contestId] ?? {});
  const voteTotalsByParticipant = useSelector(
    (state: RootState) => state.contests.participantVoteTotals[contestId] ?? {}
  );
  const participantsById = useSelector((state: RootState) => state.participants.items);
  const [nominationFilter, setNominationFilter] = useState<ParticipantsListNominationFilter>('all');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [items, setItems] = useState<Participant[]>([]);
  const latestLoadRequestIdRef = useRef(0);

  const canVote = contestStatus === 'voting';

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7648/ingest/f0553ada-9363-42b1-9afe-d218d34ae783',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d469fa'},body:JSON.stringify({sessionId:'d469fa',runId:'run_ws_sync',hypothesisId:'H3',location:'ContestUserVotingTab:stateSync',message:'Voting tab state snapshot',data:{contestId,nominationFilter,itemsCount:items.length,votedParticipantIds:Object.keys(votedMap),voteTotalsKeys:Object.keys(voteTotalsByParticipant).slice(0,20),itemsSample:items.slice(0,8).map((item)=>({participantId:item.id,itemTotalVotes:item.total_votes,wsTotalVotes:voteTotalsByParticipant[item.id],shownTotalVotes:Object.prototype.hasOwnProperty.call(voteTotalsByParticipant,item.id)?voteTotalsByParticipant[item.id]:(item.total_votes ?? 0)}))},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [contestId, nominationFilter, items, votedMap, voteTotalsByParticipant]);

  useEffect(() => {
    if (nominations.length > 1) {
      setNominationFilter((prev) => {
        if (prev === 'all' || prev === 'none') return nominations[0].id;
        if (!nominations.some((n) => n.id === prev)) return nominations[0].id;
        return prev;
      });
    } else {
      setNominationFilter('all');
    }
  }, [nominations]);

  const loadParticipants = useCallback(async () => {
    const requestId = latestLoadRequestIdRef.current + 1;
    latestLoadRequestIdRef.current = requestId;
    setLoading(true);
    try {
      const res = await getParticipantsByContest(contestId, nominationFilter, {
        limit: 10000,
        offset: 0,
        submissionFilter: 'accepted',
        sort: 'votes',
      });
      if (latestLoadRequestIdRef.current !== requestId) {
        // #region agent log
        fetch('http://127.0.0.1:7648/ingest/f0553ada-9363-42b1-9afe-d218d34ae783',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d469fa'},body:JSON.stringify({sessionId:'d469fa',runId:'run_ws_sync',hypothesisId:'H11',location:'ContestUserVotingTab:loadParticipants',message:'Discard stale participants response',data:{contestId,nominationFilter,requestId,latestRequestId:latestLoadRequestIdRef.current,itemsCount:res.items.length},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return;
      }
      // #region agent log
      fetch('http://127.0.0.1:7648/ingest/f0553ada-9363-42b1-9afe-d218d34ae783',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d469fa'},body:JSON.stringify({sessionId:'d469fa',runId:'run_ws_sync',hypothesisId:'H10',location:'ContestUserVotingTab:loadParticipants',message:'Participants API totals snapshot',data:{contestId,nominationFilter,itemsCount:res.items.length,itemsSample:res.items.slice(0,8).map((item)=>({participantId:item.id,apiTotalVotes:item.total_votes}))},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      for (const item of res.items) {
        dispatch(
          updateParticipantVoteTotal({
            contestId,
            participantId: item.id,
            totalVotes: item.total_votes ?? 0,
          })
        );
      }
      setItems(res.items);
    } catch (error) {
      if (latestLoadRequestIdRef.current !== requestId) {
        return;
      }
      errorHandler.handleError(error, () => showError('Не удалось загрузить участников'));
      setItems([]);
    } finally {
      if (latestLoadRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [contestId, nominationFilter, showError, dispatch]);

  useEffect(() => {
    void loadParticipants();
  }, [loadParticipants]);

  useEffect(() => {
    setItems((prev) =>
      prev.map((item) => {
        const next = participantsById[item.id];
        if (!next) {
          return item;
        }
        return {
          ...item,
          ...next,
          photos: next.photos ?? item.photos,
        };
      })
    );
  }, [participantsById]);

  const handleVote = async (participantId: string) => {
    if (!isAuthenticated) {
      navigate(buildLoginUrl(`${location.pathname}${location.search}${location.hash}`));
      return;
    }
    if (!canVote || savingId) {
      return;
    }

    setSavingId(participantId);
    try {
      if (votedMap[participantId]) {
        await unvote(contestId, participantId);
      } else {
        await vote(contestId, { participant_id: participantId });
      }
      const actualVotes = await getVotes(contestId);
      // #region agent log
      fetch('http://127.0.0.1:7648/ingest/f0553ada-9363-42b1-9afe-d218d34ae783',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d469fa'},body:JSON.stringify({sessionId:'d469fa',runId:'run_ws_sync',hypothesisId:'H4',location:'ContestUserVotingTab:handleVote',message:'Manual vote flow getVotes result',data:{contestId,participantId,afterActionVotesCount:actualVotes.length,participantIds:actualVotes.map((v)=>v.participant_id)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      dispatch(setUserVotesForContest({ contestId, votes: actualVotes }));
      await loadParticipants();
    } catch (error) {
      errorHandler.handleError(error, () => showError('Не удалось обновить голос'));
    } finally {
      setSavingId(null);
    }
  };

  const statusHint = useMemo(() => {
    if (canVote) {
      return 'Выберите работу и проголосуйте. Голос можно изменить до завершения этапа.';
    }
    return 'Голосование завершено. Доступен просмотр итогового выбора.';
  }, [canVote]);

  return (
    <div className="contest-user-voting">
      <div className="contest-user-voting-card">
        <p className="contest-user-voting-hint">{statusHint}</p>
        {nominations.length > 1 ? (
          <NominationTabsBar
            className="contest-user-voting-nomination-bar"
            tabs={nominations.map((n) => ({ id: n.id, label: n.title }))}
            selectedId={nominationFilter}
            onSelect={(id) => setNominationFilter(id as ParticipantsListNominationFilter)}
            ariaLabel="Фильтр по номинации"
          />
        ) : null}
        {loading ? (
          <div className="contest-user-voting-loading">
            <LoadingSpinner size="medium" />
          </div>
        ) : items.length === 0 ? (
          <p className="contest-user-voting-empty">Нет заявок для голосования.</p>
        ) : (
          <div className="contest-user-voting-list">
            {items.map((item) => {
              const latestItem = participantsById[item.id] ?? item;
              const isSelected = Boolean(votedMap[item.id]);
              const image = latestItem.photos?.[0]?.thumb_url || latestItem.photos?.[0]?.url || '';
              const title = latestItem.entry_title?.trim() || latestItem.pet_name;
              return (
                <div key={item.id} className={`contest-user-voting-item ${isSelected ? 'is-selected' : ''}`}>
                  <div className="contest-user-voting-item-main">
                    {image ? <img src={image} alt={title} className="contest-user-voting-item-image" /> : null}
                    <div className="contest-user-voting-item-text">
                      <strong>{title}</strong>
                      <span>
                        Голосов:{' '}
                        {Object.prototype.hasOwnProperty.call(voteTotalsByParticipant, item.id)
                          ? voteTotalsByParticipant[item.id]
                          : latestItem.total_votes ?? 0}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant={isSelected ? 'secondary' : 'primary'}
                    disabled={Boolean(savingId) || !canVote}
                    onClick={() => handleVote(item.id)}
                  >
                    {isSelected ? 'Отменить голос' : 'Голосовать'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
