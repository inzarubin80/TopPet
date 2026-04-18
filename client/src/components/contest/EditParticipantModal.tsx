import React from 'react';
import { Participant, ContestID, Nomination } from '../../types/models';
import { AddParticipantModal } from './AddParticipantModal';

interface EditParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  participant: Participant | null;
  nominations?: Nomination[];
  myContestParticipants?: Participant[];
  contestMinPhotoCount?: number;
  contestMaxPhotoCount?: number;
  entryTitleHint?: string;
}

export const EditParticipantModal: React.FC<EditParticipantModalProps> = ({
  isOpen,
  onClose,
  participant,
  nominations,
  myContestParticipants,
  contestMinPhotoCount,
  contestMaxPhotoCount,
  entryTitleHint,
}) => {
  if (!participant) {
    return null;
  }

  const contestId: ContestID = participant.contest_id;

  return (
    <AddParticipantModal
      isOpen={isOpen}
      onClose={onClose}
      contestId={contestId}
      participant={participant}
      nominations={nominations}
      myContestParticipants={myContestParticipants}
      contestMinPhotoCount={contestMinPhotoCount}
      contestMaxPhotoCount={contestMaxPhotoCount}
      entryTitleHint={entryTitleHint}
    />
  );
};
