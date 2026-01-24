import { useMemo } from 'react';
import { Participant, ParticipantID, ContestStatus } from '../types/models';

/**
 * Hook to determine winners of a contest
 * Returns a function that checks if a participant is a winner
 */
export const useContestWinners = (
  participants: Record<ParticipantID, Participant>,
  contestStatus: ContestStatus
): ((participantId: ParticipantID) => boolean) => {
  const isWinner = useMemo(() => {
    // Only calculate winners when contest is finished
    if (contestStatus !== 'finished') {
      return () => false;
    }

    // Calculate maximum votes
    const participantIds = Object.keys(participants);
    if (participantIds.length === 0) {
      return () => false;
    }

    const maxVotes = Math.max(
      ...participantIds.map((id) => participants[id]?.total_votes || 0),
      0
    );

    // If no votes, no winners
    if (maxVotes === 0) {
      return () => false;
    }

    // Return function that checks if participant has max votes
    return (participantId: ParticipantID): boolean => {
      const participant = participants[participantId];
      return participant?.total_votes === maxVotes;
    };
  }, [participants, contestStatus]);

  return isWinner;
};
