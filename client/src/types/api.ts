// API types and utilities

import { Contest, Participant, Comment, ChatMessage, ContestStatus } from './models';

export interface ContestsListResponse {
  items: Contest[];
  total: number;
}

export interface CommentsListResponse {
  items: Comment[];
  total: number;
}

export interface ChatMessagesListResponse {
  items: ChatMessage[];
  total: number;
}

export interface ParticipantDetails extends Participant {
  photos: Photo[];
  video?: Video;
}

export interface Photo {
  id: string;
  participant_id: string;
  url: string;
  thumb_url?: string;
  created_at: string;
}

export interface Video {
  id: string;
  participant_id: string;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface CreateContestRequest {
  title: string;
  description: string;
}

export interface UpdateContestRequest {
  title?: string;
  description?: string;
}

export interface VoterInfo {
  user_id: number;
  user_name: string;
  voted_at: string;
}

export interface UpdateContestStatusRequest {
  status: ContestStatus;
}

export interface CreateParticipantRequest {
  pet_name: string;
  pet_description: string;
}

export interface UpdateParticipantRequest {
  pet_name: string;
  pet_description: string;
}

export interface CreateCommentRequest {
  text: string;
}

export interface UpdateCommentRequest {
  text: string;
}

export interface VoteRequest {
  participant_id: string;
}

export interface RefreshTokenResponse {
  token: string;
  refresh_token: string;
}

export interface ApiError {
  message?: string;
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
    };
  };
}

export const isApiError = (error: unknown): error is ApiError => {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('message' in error || 'response' in error)
  );
};

export const getApiErrorMessage = (error: unknown): string => {
  if (isApiError(error)) {
    return error.response?.data?.message || error.response?.data?.error || error.message || 'Unknown error';
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
};
