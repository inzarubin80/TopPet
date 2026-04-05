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
  public_voting_enabled?: boolean;
  jury_voting_enabled?: boolean;
  cover_url?: string;
  tagline?: string;
  rules_url?: string;
  prize_text?: string;
  logo_url?: string;
  theme_color?: string;
  sponsor_name?: string;
  sponsor_logo_url?: string;
  sponsor_url?: string;
  cta_label_override?: string;
  /** RFC3339 или пустая строка для сброса */
  publication_starts_at?: string;
  registration_starts_at?: string;
  voting_starts_at?: string;
  voting_ends_at?: string;
  /** IANA, например Europe/Moscow */
  schedule_timezone?: string;
  /** Домены e-mail участников; [] — сбросить ограничение. */
  participant_allowed_email_domains?: string[];
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
  /** Пустая строка — сервер подставит имя из профиля пользователя. */
  pet_name?: string;
  pet_description?: string;
  nomination_id?: string;
  registration_answers?: Record<string, string | number | boolean>;
}

export interface UpdateParticipantRequest {
  pet_name?: string;
  pet_description?: string;
  registration_answers?: Record<string, string | number | boolean>;
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
