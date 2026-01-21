// Domain models matching server types

export type UserID = number;
export type ContestID = string;
export type ParticipantID = string;
export type CommentID = string;
export type ChatMessageID = string;

export type ContestStatus = 'draft' | 'published' | 'finished';

export interface User {
  id: UserID;
  name: string;
  avatar_url?: string;
  created_at: string;
}

export interface Contest {
  id: ContestID;
  created_by_user_id: UserID;
  title: string;
  description: string;
  status: ContestStatus;
  total_votes?: number;
  created_at: string;
  updated_at: string;
}

export interface Participant {
  id: ParticipantID;
  contest_id: ContestID;
  user_id: UserID;
  pet_name: string;
  pet_description: string;
  photos?: Photo[];
  video?: Video;
  total_votes?: number;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  participant_id: ParticipantID;
  url: string;
  thumb_url?: string;
  created_at: string;
}

export interface Video {
  id: string;
  participant_id: ParticipantID;
  url: string;
  created_at: string;
  updated_at: string;
}

export interface Vote {
  id: string;
  contest_id: ContestID;
  participant_id: ParticipantID;
  user_id: UserID;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: CommentID;
  participant_id: ParticipantID;
  user_id: UserID;
  text: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: ChatMessageID;
  contest_id: ContestID;
  user_id: UserID;
  text: string;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

// API Response types
export interface AuthResponse {
  token: string;
  refresh_token: string;
  user_id: UserID;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export interface VoteResponse {
  participant_id: string;
}

export interface Provider {
  provider: string;
  icon_svg: string;
  name: string;
}
