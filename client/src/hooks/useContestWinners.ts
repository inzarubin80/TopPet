import { useMemo } from 'react';
import { Participant, ParticipantID, ContestStatus } from '../types/models';

/**
 * Победители считаются на сервере (is_audience_winner / is_jury_winner).
 * Хук оставлен для обратной совместимости вызовов вида isWinner(id).
 */
export const useContestWinners = (
  participants: Record<ParticipantID, Participant>,
  contestParticipantIds: ParticipantID[],
  contestStatus: ContestStatus
): ((participantId: ParticipantID) => boolean) => {
  const isWinner = useMemo(() => {
    if (contestStatus !== 'finished') {
      return () => false;
    }
    return (participantId: ParticipantID): boolean => {
      const p = participants[participantId];
      return !!(p?.is_audience_winner || p?.is_jury_winner);
    };
  }, [participants, contestParticipantIds, contestStatus]);

  return isWinner;
};
