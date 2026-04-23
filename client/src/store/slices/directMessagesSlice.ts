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
    addIncomingDirectMessage(state, action: PayloadAction<DirectMessage>) {
      const message = action.payload;
      const conversationId = message.conversation_id;
      const current = state.messagesByConversation[conversationId] || [];
      const exists = current.some((m) => m.id === message.id);
      if (!exists) {
        state.messagesByConversation[conversationId] = sortByCreatedAtAsc([...current, message]);
        state.totalsByConversation[conversationId] = (state.totalsByConversation[conversationId] || current.length) + 1;
      }
      const conv = state.conversations.find((c) => c.id === conversationId);
      if (conv) {
        conv.last_message_text = message.text;
        conv.last_message_created_at = message.created_at;
        conv.last_message_at = message.created_at;
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
} = directMessagesSlice.actions;

export default directMessagesSlice.reducer;
