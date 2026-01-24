import { WSConnectionState, WSIncomingMessage } from '../types/ws';
import { tokenStorage } from '../utils/tokenStorage';
import { ChatMessage, ContestStatus } from '../types/models';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8080/api';
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1 second
const MAX_RECONNECT_DELAY = 30000; // 30 seconds

type MessageHandler = (message: ChatMessage) => void;
type MessageUpdateHandler = (message: ChatMessage) => void;
type MessageDeleteHandler = (messageId: string, contestId: string) => void;
type ContestStatusUpdateHandler = (contestId: string, status: ContestStatus) => void;
type VoteCountsUpdatedHandler = (contestId: string, participantId?: string, totalVotes?: number, contestTotal?: number) => void;
type UserVoteUpdatedHandler = (contestId: string, participantId?: string | null) => void;
type ConnectionStateHandler = (state: WSConnectionState) => void;
type ErrorHandler = (error: Event) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private contestId: string | null = null;
  private accessToken: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionState: WSConnectionState = 'DISCONNECTED';
  private subscribedContests: Set<string> = new Set();

  private onMessageHandler: MessageHandler | null = null;
  private onMessageUpdateHandler: MessageUpdateHandler | null = null;
  private onMessageDeleteHandler: MessageDeleteHandler | null = null;
  private onContestStatusUpdatedHandler: ContestStatusUpdateHandler | null = null;
  private onVoteCountsUpdatedHandler: VoteCountsUpdatedHandler | null = null;
  private onUserVoteUpdatedHandler: UserVoteUpdatedHandler | null = null;
  private onConnectionStateChange: ConnectionStateHandler | null = null;
  private onErrorHandler: ErrorHandler | null = null;

  constructor() {
    // Initialize with token from storage
    this.accessToken = tokenStorage.getAccessToken();
  }

  setOnMessage(handler: MessageHandler): void {
    this.onMessageHandler = handler;
  }

  setOnMessageUpdated(handler: MessageUpdateHandler): void {
    this.onMessageUpdateHandler = handler;
  }

  setOnMessageDeleted(handler: MessageDeleteHandler): void {
    this.onMessageDeleteHandler = handler;
  }

  setOnContestStatusUpdated(handler: ContestStatusUpdateHandler): void {
    this.onContestStatusUpdatedHandler = handler;
  }

  setOnVoteCountsUpdated(handler: VoteCountsUpdatedHandler): void {
    this.onVoteCountsUpdatedHandler = handler;
  }

  setOnUserVoteUpdated(handler: UserVoteUpdatedHandler): void {
    this.onUserVoteUpdatedHandler = handler;
  }

  setOnConnectionStateChange(handler: ConnectionStateHandler): void {
    this.onConnectionStateChange = handler;
  }

  setOnError(handler: ErrorHandler): void {
    this.onErrorHandler = handler;
  }

  private setConnectionState(state: WSConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      if (this.onConnectionStateChange) {
        this.onConnectionStateChange(state);
      }
    }
  }

  private getWebSocketUrl(contestId: string): string {
    // WS_URL should already be ws:// or wss://, but handle http:// case
    let baseUrl = WS_URL;
    if (baseUrl.startsWith('http://')) {
      baseUrl = baseUrl.replace('http://', 'ws://');
    } else if (baseUrl.startsWith('https://')) {
      baseUrl = baseUrl.replace('https://', 'wss://');
    }
    
    const url = new URL(`${baseUrl}/contests/${contestId}/chat/ws`);
    if (this.accessToken) {
      url.searchParams.set('accessToken', this.accessToken);
    }
    return url.toString();
  }

  connect(contestId: string, accessToken?: string): void {
    if (accessToken) {
      this.accessToken = accessToken;
    } else {
      this.accessToken = tokenStorage.getAccessToken();
    }

    if (!this.accessToken) {
      console.error('WebSocket: No access token available');
      return;
    }

    this.contestId = contestId;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  private doConnect(): void {
    if (!this.contestId || !this.accessToken) {
      return;
    }

    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setConnectionState('CONNECTING');

    try {
      const url = this.getWebSocketUrl(this.contestId);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('WebSocket: Connected');
        this.setConnectionState('CONNECTED');
        this.reconnectAttempts = 0;

        // Resubscribe to all contests
        this.subscribedContests.forEach((contestId) => {
          this.subscribe(contestId);
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('WebSocket: Failed to parse message', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket: Error', error);
        if (this.onErrorHandler) {
          this.onErrorHandler(error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket: Closed', event.code, event.reason);
        this.ws = null;
        this.setConnectionState('DISCONNECTED');

        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          this.scheduleReconnect();
        } else if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.error('WebSocket: Max reconnect attempts reached');
          this.setConnectionState('DISCONNECTED');
        }
      };
    } catch (error) {
      console.error('WebSocket: Failed to create connection', error);
      this.setConnectionState('DISCONNECTED');
      if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.scheduleReconnect();
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    this.reconnectAttempts++;
    this.setConnectionState('RECONNECTING');

    // Exponential backoff: 1s, 2s, 4s, 8s, ... max 30s
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY
    );

    console.log(`WebSocket: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, delay);
  }

  private handleMessage(data: any): void {
    // Fix: Server sends "chat_message" type, not "new_message"
    if ((data.type === 'new_message' || data.type === 'chat_message') && data.message) {
      if (this.onMessageHandler) {
        this.onMessageHandler(data.message as ChatMessage);
      }
      return;
    }
    if (data.type === 'message_updated' && data.message) {
      if (this.onMessageUpdateHandler) {
        this.onMessageUpdateHandler(data.message as ChatMessage);
      }
      return;
    }
    if (data.type === 'message_deleted' && data.message_id && data.contest_id) {
      if (this.onMessageDeleteHandler) {
        this.onMessageDeleteHandler(String(data.message_id), String(data.contest_id));
      }
      return;
    }
    if (data.type === 'contest_status_updated' && data.contest_id && data.status) {
      if (this.onContestStatusUpdatedHandler) {
        this.onContestStatusUpdatedHandler(String(data.contest_id), data.status as ContestStatus);
      }
      return;
    }
    // Fix: Server sends "vote_created" and "vote_deleted" types, not "vote_counts_updated"
    if ((data.type === 'vote_counts_updated' || data.type === 'vote_created' || data.type === 'vote_deleted') && data.contest_id) {
      if (this.onVoteCountsUpdatedHandler) {
        this.onVoteCountsUpdatedHandler(
          String(data.contest_id),
          data.participant_id ? String(data.participant_id) : undefined,
          typeof data.participant_total_votes === 'number' ? data.participant_total_votes : undefined,
          typeof data.contest_total_votes === 'number' ? data.contest_total_votes : undefined
        );
      }
      return;
    }
    if (data.type === 'user_vote_updated' && data.contest_id) {
      if (this.onUserVoteUpdatedHandler) {
        this.onUserVoteUpdatedHandler(
          String(data.contest_id),
          data.participant_id ? String(data.participant_id) : null
        );
      }
    }
  }

  subscribe(contestId: string): void {
    this.subscribedContests.add(contestId);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message: WSIncomingMessage = {
        type: 'subscribe',
        contest_id: contestId,
      };
      this.ws.send(JSON.stringify(message));
    }
  }

  unsubscribe(contestId: string): void {
    this.subscribedContests.delete(contestId);
  }

  sendMessage(contestId: string, text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket: Not connected');
      return;
    }

    const message: WSIncomingMessage = {
      type: 'message',
      contest_id: contestId,
      text,
    };

    this.ws.send(JSON.stringify(message));
  }

  disconnect(): void {
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close connection
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.subscribedContests.clear();
    this.contestId = null;
    this.reconnectAttempts = 0;
    this.setConnectionState('DISCONNECTED');
  }

  getConnectionState(): WSConnectionState {
    return this.connectionState;
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  updateAccessToken(accessToken: string): void {
    this.accessToken = accessToken;
    // If connected, we might need to reconnect with new token
    // For now, we'll let the next connection use the new token
  }
}
