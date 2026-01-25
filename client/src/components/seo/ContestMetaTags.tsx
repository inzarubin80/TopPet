import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Contest, Participant } from '../../types/models';
import {
  getContestUrl,
  getMetaImage,
  getFirstParticipantPhoto,
  getContestDescription,
} from '../../utils/seo';

interface ContestMetaTagsProps {
  contest: Contest;
  participants?: Participant[];
  contestId: string;
}

export const ContestMetaTags: React.FC<ContestMetaTagsProps> = ({
  contest,
  participants = [],
  contestId,
}) => {
  const title = `${contest.title} - Top-Pet`;
  const description = getContestDescription(contest);
  const url = getContestUrl(contestId);
  
  // Получаем первое фото первого участника для изображения
  const firstPhoto = getFirstParticipantPhoto(participants);
  const imageUrl = getMetaImage(firstPhoto);

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph метатеги */}
      <meta property="og:title" content={contest.title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:site_name" content="Top-Pet" />
      
      {/* Twitter Card метатеги */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={contest.title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
};
