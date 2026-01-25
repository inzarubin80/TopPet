import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Participant, Contest } from '../../types/models';
import {
  getParticipantUrl,
  getMetaImage,
  getParticipantDescription,
} from '../../utils/seo';

interface ParticipantMetaTagsProps {
  participant: Participant;
  contest: Contest;
  contestId: string;
  participantId: string;
}

export const ParticipantMetaTags: React.FC<ParticipantMetaTagsProps> = ({
  participant,
  contest,
  contestId,
  participantId,
}) => {
  const title = `${participant.pet_name} - Top-Pet`;
  const description = getParticipantDescription(participant);
  const url = getParticipantUrl(contestId, participantId);
  
  // Получаем первое фото участника для изображения
  const firstPhoto = participant.photos && participant.photos.length > 0
    ? participant.photos.sort((a, b) => {
        const posA = a.position ?? 0;
        const posB = b.position ?? 0;
        return posA - posB;
      })[0]
    : null;
  const imageUrl = getMetaImage(firstPhoto);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph метатеги */}
      <meta property="og:title" content={participant.pet_name} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:site_name" content="Top-Pet" />
      
      {/* Twitter Card метатеги */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={participant.pet_name} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
};
