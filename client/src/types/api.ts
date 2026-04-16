// API types and utilities

import { Contest, Participant, Comment, ChatMessage, ContestStatus } from './models';
import type { ContestPrizePlace } from './models';

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
}

export interface Photo {
  id: string;
  participant_id: string;
  url: string;
  thumb_url?: string;
  created_at: string;
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
  rules_text?: string;
  prize_text?: string;
  jury_prize_places?: ContestPrizePlace[];
  audience_prize_places?: ContestPrizePlace[];
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
  min_photo_count?: number;
  max_photo_count?: number;
  /** Подсказка для поля наименования заявки (участникам). */
  entry_title_hint?: string;
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
  /** Наименование заявки (предпочтительно явно задать в форме). */
  entry_title?: string;
  entry_description?: string;
  nomination_id?: string;
  registration_answers?: Record<string, unknown>;
  privacy_consent?: boolean;
  policy_version?: string;
}

export interface UpdateParticipantRequest {
  pet_name?: string;
  pet_description?: string;
  entry_title?: string;
  entry_description?: string;
  registration_answers?: Record<string, unknown>;
}

export interface CreateCommentRequest {
  text: string;
  parent_id?: string;
}

export interface UpdateCommentRequest {
  text: string;
}

export interface VoteValueRequest {
  value: -1 | 1;
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
    const fromBody = error.response?.data?.message || error.response?.data?.error;
    if (fromBody) {
      if (fromBody === 'already participating in this nomination') {
        return 'Вы уже подали заявку в этой номинации';
      }
      if (fromBody === 'already participating in this contest') {
        return 'Вы уже подали заявку в этом конкурсе';
      }
      return fromBody;
    }
    if (error.response?.status === 409) {
      return 'Такая запись уже существует. Обновите страницу и проверьте список заявок.';
    }
    return error.message || 'Unknown error';
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
};
