import React from 'react';
import { useParams } from 'react-router-dom';
import { ParticipantCardBody } from '../components/participant/ParticipantCardBody';
import './ParticipantPage.css';

const ParticipantPage: React.FC = () => {
  const { id: contestId, participantId } = useParams<{ id: string; participantId: string }>();
  if (!contestId || !participantId) {
    return (
      <div className="participant-page-missing">
        <p>Некорректный адрес.</p>
      </div>
    );
  }
  return <ParticipantCardBody contestId={contestId} participantId={participantId} variant="page" />;
};

export default ParticipantPage;
