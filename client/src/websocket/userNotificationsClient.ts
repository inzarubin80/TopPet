import { tokenStorage } from '../utils/tokenStorage';
import { logger } from '../utils/logger';

const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8080/api';
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

export type UserNotificationIncoming =
  | { type: 'notification_unread'; total_unread: number }
  | { type: 'notification'; notification: Record<string, unknown> };

export class UserNotificationsWebSocketClient {
  private ws: WebSocket | null = null;
  private accessToken: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private onMessageHandler: ((msg: UserNotificationIncoming) => void) | null = null;
  private shouldRun = false;

  setOnMessage(handler: (msg: UserNotificationIncoming) => void): void {
    this.onMessageHandler = handler;
  }

  private getUrl(): string {
    let baseUrl = WS_URL;
    if (baseUrl.startsWith('http://')) {
      baseUrl = baseUrl.replace('http://', 'ws://');
    } else if (baseUrl.startsWith('https://')) {
      baseUrl = baseUrl.replace('https://', 'wss://');
    }
    const url = new URL(`${baseUrl}/me/notifications/ws`);
    if (this.accessToken) {
      url.searchParams.set('accessToken', this.accessToken);
    }
    return url.toString();
  }

  connect(accessToken: string): void {
    this.shouldRun = true;
    this.accessToken = accessToken;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  disconnect(): void {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'client disconnect');
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (!this.shouldRun || this.reconnectTimer) {
      return;
    }
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.warn('[UserNotifications WS] max reconnect attempts');
      return;
    }
    this.reconnectAttempts += 1;
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      const t = tokenStorage.getAccessToken();
      if (t) {
        this.accessToken = t;
      }
      this.doConnect();
    }, delay);
  }

  private doConnect(): void {
    if (!this.shouldRun) {
      return;
    }
    if (!this.accessToken) {
      logger.warn('[UserNotifications WS] no access token');
      return;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    try {
      const url = this.getUrl();
      this.ws = new WebSocket(url);
      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
      };
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as UserNotificationIncoming;
          if (this.onMessageHandler) {
            this.onMessageHandler(data);
          }
        } catch (e) {
          logger.debug('[UserNotifications WS] parse error', e);
        }
      };
      this.ws.onerror = () => {
        logger.debug('[UserNotifications WS] socket error');
      };
      this.ws.onclose = (ev) => {
        this.ws = null;
        if (this.shouldRun && ev.code !== 1000) {
          this.scheduleReconnect();
        }
      };
    } catch (e) {
      logger.warn('[UserNotifications WS] connect failed', e);
      this.scheduleReconnect();
    }
  }
}

let singleton: UserNotificationsWebSocketClient | null = null;

export function getUserNotificationsWebSocketClient(): UserNotificationsWebSocketClient {
  if (!singleton) {
    singleton = new UserNotificationsWebSocketClient();
  }
  return singleton;
}
