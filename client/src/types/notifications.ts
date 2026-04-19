import { ContestID, ParticipantID } from './models';

export type UserNotificationKind = 'submission_accepted' | 'submission_rejected' | string;

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

export interface NotificationsListResponse {
  items: UserNotification[];
  total_unread: number;
}
