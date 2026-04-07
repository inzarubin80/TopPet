import React from 'react';
import { Participant, ContestID } from '../../types/models';
import { AddParticipantModal } from './AddParticipantModal';

interface EditParticipantModalProps {
  isOpen: boolean;
  onClose: () => void;
  participant: Participant | null;
  contestMinPhotoCount?: number;
  contestMaxPhotoCount?: number;
}

export const EditParticipantModal: React.FC<EditParticipantModalProps> = ({
  isOpen,
  onClose,
  participant,
  contestMinPhotoCount,
  contestMaxPhotoCount,
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
      contestMinPhotoCount={contestMinPhotoCount}
      contestMaxPhotoCount={contestMaxPhotoCount}
    />
  );
};
