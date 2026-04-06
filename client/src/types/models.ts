// Domain models matching server types

export type UserID = number;
export type ContestID = string;
export type ParticipantID = string;
export type CommentID = string;
export type ChatMessageID = string;

export type ContestStatus = 'draft' | 'publication' | 'registration' | 'voting' | 'finished';

/** Глобальная роль в системе (поле users.role). */
export type UserRole = 'user' | 'contest_admin' | 'system_admin';

export interface User {
  id: UserID;
  name: string;
  email?: string;
  role?: UserRole;
  /** Аккаунт заблокирован администратором системы (запись в API запрещена). */
  is_blocked?: boolean;
  avatar_url?: string;
  created_at: string;
  /** Только ответ GET /api/admin/users — OAuth-провайдеры, привязанные к аккаунту. */
  auth_providers?: string[];
}

export interface UserSearchHit {
  id: UserID;
  name: string;
  email?: string;
}

export type ContestTier = 'free' | 'pro';

/** Победитель в ответе списка/карточки конкурса (после завершения). */
export interface ContestWinnerBrief {
  participant_id: ParticipantID;
  pet_name: string;
  nomination_id?: string;
  nomination_title?: string;
  score: number;
}

export interface Contest {
  id: ContestID;
  created_by_user_id: UserID;
  title: string;
  description: string;
  status: ContestStatus;
  tier?: ContestTier;
  total_votes?: number;
  /** Голоса посетителей за работы участников */
  public_voting_enabled?: boolean;
  /** Критерии жюри и состав жюри */
  jury_voting_enabled?: boolean;
  cover_url?: string;
  tagline?: string;
  /** Многострочный текст правил; пусто — кнопка не показывается. */
  rules_text?: string;
  prize_text?: string;
  logo_url?: string;
  theme_color?: string;
  sponsor_name?: string;
  sponsor_logo_url?: string;
  sponsor_url?: string;
  cta_label_override?: string;
  /** Домены e-mail; пусто — заявку может подать любой. */
  participant_allowed_email_domains?: string[];
  /** Старт фазы «публикация» (UTC). Планировщик сверяет время с датами и выставляет статус. */
  publication_starts_at?: string;
  /** Начало регистрации (UTC, RFC3339). */
  registration_starts_at?: string;
  /** Начало голосования. */
  voting_starts_at?: string;
  /** Окончание голосования. */
  voting_ends_at?: string;
  /** IANA; в каком поясе на форме задаются даты расписания (в API моменты в UTC). */
  schedule_timezone?: string;
  created_at: string;
  updated_at: string;
  /** Заполняется для завершённых конкурсов (GET /api/contests, GET один). */
  audience_winners?: ContestWinnerBrief[];
  jury_winners?: ContestWinnerBrief[];
}

/** Категория трека (без шкал на номинации — шкалы у критериев конкурса). */
export interface Nomination {
  id: string;
  contest_id: ContestID;
  title: string;
  description: string;
  sort_order: number;
  /** Сколько фото нужно в заявке (по умолчанию 1). */
  min_photo_count?: number;
  /** Максимум фото в заявке (по умолчанию 30). */
  max_photo_count?: number;
  /** Публичный URL логотипа номинации (object storage). */
  logo_url?: string;
  created_at: string;
}

/** Критерий оценки жюри на весь конкурс. */
export interface JuryCriterion {
  id: string;
  contest_id: ContestID;
  title: string;
  description: string;
  scale_min: number;
  scale_max: number;
  scale_step: number;
  sort_order: number;
  created_at: string;
}

/** Сохранённая оценка жюри по одному критерию. */
export interface JuryScore {
  id: string;
  participant_id: ParticipantID;
  criterion_id: string;
  user_id: UserID;
  score: number;
  created_at: string;
  updated_at: string;
}

/** Строка отчёта по голосованию жюри (ответ GET …/jury-scores-report). */
export interface JuryScoreReportItem {
  juror_user_id: UserID;
  juror_name: string;
  criterion_id: string;
  criterion_title: string;
  criterion_sort_order: number;
  scale_min: number;
  scale_max: number;
  score: number;
  score_updated_at: string;
}

/** Ячейка сводки «работа × жюри» (GET …/jury-voting-progress). */
export interface JuryVotingProgressRow {
  participant_id: ParticipantID;
  pet_name: string;
  submission_status: string;
  juror_user_id: UserID;
  juror_name: string;
  criteria_scored: number;
}

export type RegistrationFieldType = 'string' | 'number' | 'boolean' | 'enum' | 'textarea' | 'image';

export interface RegistrationField {
  id: string;
  contest_id: ContestID;
  sort_order: number;
  label: string;
  field_type: RegistrationFieldType;
  required: boolean;
  enum_options?: string[];
  /** Пояснение для участника при заполнении заявки. */
  help_text?: string;
  created_at: string;
}

export interface RegistrationFieldInput {
  id?: string;
  label: string;
  field_type: RegistrationFieldType;
  required: boolean;
  enum_options?: string[];
  help_text?: string;
}

export interface JuryMember {
  id: string;
  contest_id: ContestID;
  user_id: UserID;
  user_name?: string;
  /** Порядок отображения (0 — первый). */
  sort_order: number;
  /** Ссылка на портфолио или профиль. */
  portfolio_url?: string;
  /** Краткое описание для публичной страницы. */
  bio_short?: string;
  created_at: string;
}

/** Статус модерации заявки после правок карточки. */
export type ParticipantSubmissionStatus = 'pending' | 'accepted' | 'rejected';

export interface Participant {
  id: ParticipantID;
  contest_id: ContestID;
  user_id: UserID;
  user_name?: string;
  /** UUID номинации, если заявка привязана к категории */
  nomination_id?: string;
  /** Модерация: после редактирования — pending, пока организатор не примет. */
  submission_status?: ParticipantSubmissionStatus;
  /** Комментарий организатора при отклонении заявки. */
  submission_comment?: string;
  pet_name: string;
  pet_description: string;
  registration_answers?: Record<string, string | number | boolean>;
  photos?: Photo[];
  total_votes?: number;
  /** Сумма баллов жюри по всем критериям и всем членам жюри (если API отдал поле). */
  total_jury_score?: number;
  /** Членов жюри в конкурсе (для прогресса оценивания). */
  jury_member_count?: number;
  /** Число критериев оценки в конкурсе. */
  jury_criteria_count?: number;
  /** Сколько жюри выставили баллы по всем критериям для этой работы. */
  jury_fully_scored_jurors?: number;
  /** Завершённый конкурс: максимум голосов зрителей в своей номинации (или в целом по конкурсу). */
  is_audience_winner?: boolean;
  /** Завершённый конкурс: максимальная сумма оценок жюри в своей номинации. */
  is_jury_winner?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  participant_id: ParticipantID;
  url: string;
  thumb_url?: string;
  position?: number;
  created_at: string;
}

export interface Vote {
  id: string;
  contest_id: ContestID;
  participant_id: ParticipantID;
  nomination_id?: string | null;
  user_id: UserID;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: CommentID;
  participant_id: ParticipantID;
  user_id: UserID;
  user_name?: string;
  text: string;
  created_at: string;
  updated_at: string;
}

/** Непрочитанные комментарии организатора по своей заявке (для владельца участника). */
export interface StaffCommentNotification {
  participant_id: ParticipantID;
  contest_id: ContestID;
  contest_title: string;
  pet_name: string;
  unread_count: number;
  latest_comment_at: string;
  latest_comment_preview?: string;
}

export interface ChatMessage {
  id: ChatMessageID;
  contest_id: ContestID;
  user_id: UserID;
  user_name?: string;
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
  nomination_id?: string | null;
}

export interface UserVoteItem {
  participant_id: string;
  nomination_id?: string | null;
}

export interface UserVotesListResponse {
  votes: UserVoteItem[];
}

export interface Provider {
  provider: string;
  icon_svg: string;
  name: string;
}
