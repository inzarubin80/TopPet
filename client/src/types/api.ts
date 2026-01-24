// API types and utilities

import { Contest, Participant, Comment, ChatMessage, VoteResponse, ContestStatus } from './models';

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
