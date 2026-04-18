// WebSocket message types

export type WSConnectionState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

export type WSIncomingMessageType = 'subscribe' | 'message';

export type WSOutgoingMessageType = 'new_message';

export interface WSIncomingMessage {
  type: WSIncomingMessageType;
  contest_id: string;
  text?: string;
  parent_id?: string;
  image_url?: string;
}

export interface WSOutgoingMessage {
  type: WSOutgoingMessageType;
  contest_id: string;
  message: {
    id: string;
    contest_id: string;
    user_id: number;
    text: string;
    is_system: boolean;
    created_at: string;
    updated_at: string;
  };
}
