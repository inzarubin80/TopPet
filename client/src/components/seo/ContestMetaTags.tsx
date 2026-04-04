import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Contest, Participant } from '../../types/models';
import {
  getContestUrl,
  getFirstParticipantPhoto,
  getContestDescription,
  getContestShareImage,
} from '../../utils/seo';
import { BRAND_NAME, brandTabTitle } from '../../config/brand';

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
  const title = brandTabTitle(contest.title);
  const description = getContestDescription(contest);
  const url = getContestUrl(contestId);
  
  const firstPhoto = getFirstParticipantPhoto(participants);
  const imageUrl = getContestShareImage(contest, firstPhoto);

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
      <meta property="og:site_name" content={BRAND_NAME} />
      
      {/* Twitter Card метатеги */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={contest.title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
};
