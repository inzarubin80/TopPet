import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../store';
import { refreshTokenAsync } from '../store/slices/authSlice';
import {
  applyUnreadSnapshot,
  bootstrapNotifications,
  pushIncomingNotification,
  setNotificationsSocketState,
} from '../store/slices/notificationsSlice';
import {
  addIncomingDirectMessage,
  applyPeerPresenceSnapshot,
  removeConversation,
  removeDirectMessageFromConversation,
  setPeerPresence,
  updateDirectMessageInConversation,
} from '../store/slices/directMessagesSlice';
import { getUserNotificationsWebSocketClient, UserNotificationIncoming } from '../websocket/userNotificationsClient';
import { tokenStorage } from '../utils/tokenStorage';
import { logger } from '../utils/logger';
import { useToast } from '../contexts/ToastContext';
import type { RefreshTokenResponse } from '../types/api';
import type { UserNotification } from '../types/notifications';
import { getNotificationLineText } from '../utils/notificationCopy';
import { playIncomingMessageSound } from '../utils/playIncomingMessageSound';

function toastForNotification(
  showSuccess: (m: string) => void,
  showInfo: (m: string) => void,
  n: UserNotification
): void {
  const line = getNotificationLineText(n);
  if (n.kind === 'submission_accepted') {
    showSuccess(line);
  } else {
    showInfo(line);
  }
}

function normalizeNotification(raw: Record<string, unknown>): UserNotification {
  const payloadRaw = raw.payload;
  let payload: Record<string, unknown> = {};
  if (payloadRaw && typeof payloadRaw === 'object' && !Array.isArray(payloadRaw)) {
    payload = payloadRaw as Record<string, unknown>;
  } else if (typeof payloadRaw === 'string') {
    try {
      payload = JSON.parse(payloadRaw) as Record<string, unknown>;
    } catch {
      payload = {};
    }
  }
  return {
    id: String(raw.id ?? ''),
    user_id: Number(raw.user_id ?? 0),
    kind: String(raw.kind ?? ''),
    payload,
    read_at: raw.read_at != null ? String(raw.read_at) : null,
    created_at: String(raw.created_at ?? ''),
  };
}

/**
 * Глобальный WebSocket уведомлений: не привязан к открытому конкурсу — пользователь видит события по всем конкурсам.
 */
export const useUserNotificationsSocket = (): void => {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((s: RootState) => s.auth.user);
  const { showSuccess, showInfo } = useToast();
  const toastRef = useRef({ showSuccess, showInfo });
  toastRef.current = { showSuccess, showInfo };

  useEffect(() => {
    if (!user) {
      dispatch(setNotificationsSocketState('DISCONNECTED'));
      getUserNotificationsWebSocketClient().disconnect();
      return;
    }

    void dispatch(bootstrapNotifications({}));

    const client = getUserNotificationsWebSocketClient();
    client.setOnStateChange((state) => {
      dispatch(setNotificationsSocketState(state));
    });
    client.setOnMessage((msg: UserNotificationIncoming) => {
      if (msg.type === 'notification_unread') {
        dispatch(applyUnreadSnapshot(msg.total_unread));
        return;
      }
      if (msg.type === 'notification' && msg.notification) {
        const n = normalizeNotification(msg.notification as Record<string, unknown>);
        dispatch(pushIncomingNotification(n));
        toastForNotification(
          (m) => toastRef.current.showSuccess(m),
          (m) => toastRef.current.showInfo(m),
          n
        );
        return;
      }
      if (msg.type === 'direct_message' && msg.message) {
        const selfId = user?.id;
        if (selfId == null || msg.message.sender_user_id !== selfId) {
          playIncomingMessageSound();
        }
        dispatch(addIncomingDirectMessage(msg.message));
        return;
      }
      if (msg.type === 'direct_message_updated' && msg.message) {
        dispatch(updateDirectMessageInConversation(msg.message));
        return;
      }
      if (msg.type === 'direct_message_deleted') {
        dispatch(
          removeDirectMessageFromConversation({
            conversationId: msg.conversation_id,
            messageId: msg.message_id,
          })
        );
        return;
      }
      if (msg.type === 'direct_conversation_deleted') {
        dispatch(removeConversation(msg.conversation_id));
        return;
      }
      if (msg.type === 'peer_presence') {
        dispatch(setPeerPresence({ userId: msg.user_id, online: msg.online }));
        return;
      }
      if (msg.type === 'peer_presence_snapshot') {
        dispatch(applyPeerPresenceSnapshot(msg.online_peer_user_ids));
        return;
      }
    });

    let cancelled = false;

    const connect = async () => {
      const refreshTokenValue = tokenStorage.getRefreshToken();
      if (!refreshTokenValue) {
        logger.warn('[useUserNotificationsSocket] no refresh token');
        dispatch(setNotificationsSocketState('DISCONNECTED'));
        return;
      }
      try {
        const result = await dispatch(refreshTokenAsync(refreshTokenValue));
        if (!refreshTokenAsync.fulfilled.match(result)) {
          return;
        }
        const payload = result.payload as RefreshTokenResponse;
        const token = payload?.token;
        if (!token || cancelled) {
          return;
        }
        client.connect(token);
      } catch (e) {
        logger.warn('[useUserNotificationsSocket] refresh failed', e);
        dispatch(setNotificationsSocketState('DISCONNECTED'));
      }
    };

    void connect();

    return () => {
      cancelled = true;
      client.disconnect();
    };
  }, [dispatch, user]);
};
