import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { DirectConversation, DirectConversationID, DirectMessage } from '../../types/models';

interface DirectMessagesState {
  conversations: DirectConversation[];
  messagesByConversation: Record<DirectConversationID, DirectMessage[]>;
  totalsByConversation: Record<DirectConversationID, number>;
  activeConversationId: DirectConversationID | null;
}

const initialState: DirectMessagesState = {
  conversations: [],
  messagesByConversation: {},
  totalsByConversation: {},
  activeConversationId: null,
};

function sortByCreatedAtAsc<T extends { created_at: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

const directMessagesSlice = createSlice({
  name: 'directMessages',
  initialState,
  reducers: {
    setConversations(state, action: PayloadAction<DirectConversation[]>) {
      state.conversations = [...action.payload].sort(
        (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );
    },
    upsertConversation(state, action: PayloadAction<DirectConversation>) {
      const next = action.payload;
      const idx = state.conversations.findIndex((c) => c.id === next.id);
      if (idx >= 0) {
        state.conversations[idx] = next;
      } else {
        state.conversations.push(next);
      }
      state.conversations.sort(
        (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
      );
    },
    setMessages(
      state,
      action: PayloadAction<{ conversationId: DirectConversationID; items: DirectMessage[]; total: number }>
    ) {
      const { conversationId, items, total } = action.payload;
      state.messagesByConversation[conversationId] = sortByCreatedAtAsc(items);
      state.totalsByConversation[conversationId] = total;
    },
    addIncomingDirectMessage(
      state,
      action: PayloadAction<{ message: DirectMessage; viewerUserId: number }>
    ) {
      const { message, viewerUserId } = action.payload;
      const conversationId = message.conversation_id;
      const current = state.messagesByConversation[conversationId] || [];
      const exists = current.some((m) => m.id === message.id);
      if (!exists) {
        state.messagesByConversation[conversationId] = sortByCreatedAtAsc([...current, message]);
        state.totalsByConversation[conversationId] = (state.totalsByConversation[conversationId] || current.length) + 1;
      }
      let conv = state.conversations.find((c) => c.id === conversationId);
      if (conv) {
        conv.last_message_text = message.text;
        conv.last_message_created_at = message.created_at;
        conv.last_message_at = message.created_at;
      } else if (message.sender_user_id !== viewerUserId) {
        const low = Math.min(message.sender_user_id, viewerUserId);
        const high = Math.max(message.sender_user_id, viewerUserId);
        const peerName =
          message.sender_user_name?.trim() || `Пользователь ${message.sender_user_id}`;
        conv = {
          id: conversationId,
          user_low_id: low,
          user_high_id: high,
          peer_user_id: message.sender_user_id,
          peer_user_name: peerName,
          peer_user_avatar_url: message.sender_user_avatar_url,
          peer_user_online: false,
          last_message_text: message.text,
          last_message_created_at: message.created_at,
          last_message_at: message.created_at,
          created_at: message.created_at,
          updated_at: message.updated_at,
        };
        state.conversations.push(conv);
      }
      if (conv) {
        state.conversations.sort(
          (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
        );
      }
    },
    updateDirectMessageInConversation(state, action: PayloadAction<DirectMessage>) {
      const message = action.payload;
      const conversationId = message.conversation_id;
      const current = state.messagesByConversation[conversationId] || [];
      const idx = current.findIndex((m) => m.id === message.id);
      if (idx >= 0) {
        current[idx] = message;
        state.messagesByConversation[conversationId] = sortByCreatedAtAsc(current);
      }
    },
    removeDirectMessageFromConversation(
      state,
      action: PayloadAction<{ conversationId: DirectConversationID; messageId: string }>
    ) {
      const { conversationId, messageId } = action.payload;
      const current = state.messagesByConversation[conversationId] || [];
      state.messagesByConversation[conversationId] = current.filter((m) => m.id !== messageId);
      if (state.totalsByConversation[conversationId] > 0) {
        state.totalsByConversation[conversationId] -= 1;
      }
    },
    setActiveDirectConversation(state, action: PayloadAction<DirectConversationID | null>) {
      state.activeConversationId = action.payload;
    },
    removeConversation(state, action: PayloadAction<DirectConversationID>) {
      const id = action.payload;
      state.conversations = state.conversations.filter((c) => c.id !== id);
      delete state.messagesByConversation[id];
      delete state.totalsByConversation[id];
      if (state.activeConversationId === id) {
        state.activeConversationId = state.conversations[0]?.id ?? null;
      }
    },
    setPeerPresence(state, action: PayloadAction<{ userId: number; online: boolean }>) {
      const { userId, online } = action.payload;
      const row = state.conversations.find((c) => c.peer_user_id === userId);
      if (row) {
        row.peer_user_online = online;
      }
    },
    applyPeerPresenceSnapshot(state, action: PayloadAction<number[]>) {
      const onlineSet = new Set(action.payload);
      for (const c of state.conversations) {
        c.peer_user_online = onlineSet.has(c.peer_user_id);
      }
    },
  },
});

export const {
  setConversations,
  upsertConversation,
  setMessages,
  addIncomingDirectMessage,
  updateDirectMessageInConversation,
  removeDirectMessageFromConversation,
  setActiveDirectConversation,
  removeConversation,
  setPeerPresence,
  applyPeerPresenceSnapshot,
} = directMessagesSlice.actions;

export default directMessagesSlice.reducer;
