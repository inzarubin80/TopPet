import { ContestID, ParticipantID } from './models';

export type UserNotificationKind =
  | 'submission_accepted'
  | 'submission_rejected'
  | 'participant_work_chat_message'
  | 'participant_work_chat_reply'
  | 'contest_chat_reply'
  | 'work_liked'
  | string;

export interface UserNotification {
  id: string;
  user_id: number;
  kind: UserNotificationKind;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface SubmissionModerationPayload {
  contest_id: ContestID;
  contest_title: string;
  participant_id: ParticipantID;
  entry_title: string;
  submission_comment?: string;
}

/** Комментарии к работе (чат заявки) */
export interface ParticipantWorkChatPayload {
  contest_id: ContestID;
  contest_title: string;
  participant_id: ParticipantID;
  entry_title: string;
  comment_id: string;
  author_name: string;
  message_preview?: string;
}

/** Ответ в общем чате конкурса */
export interface ContestChatReplyPayload {
  contest_id: ContestID;
  contest_title: string;
  message_id: string;
  parent_message_id: string;
  author_name: string;
  message_preview?: string;
}

/** Лайк на работу участника */
export interface WorkLikedPayload {
  contest_id: ContestID;
  contest_title: string;
  participant_id: ParticipantID;
  entry_title: string;
  author_name: string;
}

export interface NotificationsListResponse {
  items: UserNotification[];
  total_unread: number;
}
