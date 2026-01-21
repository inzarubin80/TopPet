export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  CONTEST: (id: string) => `/contests/${id}`,
  PARTICIPANT: (contestId: string, participantId: string) =>
    `/contests/${contestId}/participants/${participantId}`,
  CREATE_CONTEST: '/create-contest',
} as const;
