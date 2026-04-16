import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatMessage, ContestID } from '../../types/models';
import { WSConnectionState } from '../../types/ws';

interface ChatState {
  messages: Record<ContestID, ChatMessage[]>;
  connectionState: WSConnectionState;
  currentContestId: ContestID | null;
}

const initialState: ChatState = {
  messages: {},
  connectionState: 'DISCONNECTED',
  currentContestId: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<{ contestId: ContestID; message: ChatMessage }>) => {
      const { contestId, message } = action.payload;
      if (!state.messages[contestId]) {
        state.messages[contestId] = [];
      }
      // Check if message already exists (avoid duplicates)
      const exists = state.messages[contestId].some((m) => m.id === message.id);
      if (!exists) {
        state.messages[contestId].push(message);
        // Sort by created_at
        state.messages[contestId].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }
    },
    setMessages: (state, action: PayloadAction<{ contestId: ContestID; messages: ChatMessage[] }>) => {
      const { contestId, messages } = action.payload;
      state.messages[contestId] = messages;
    },
    updateMessage: (state, action: PayloadAction<{ contestId: ContestID; message: ChatMessage }>) => {
      const { contestId, message } = action.payload;
      const list = state.messages[contestId];
      if (!list) {
        return;
      }
      const index = list.findIndex((m) => m.id === message.id);
      if (index >= 0) {
        list[index] = message;
      }
    },
    removeMessage: (state, action: PayloadAction<{ contestId: ContestID; messageId: string }>) => {
      const { contestId, messageId } = action.payload;
      const list = state.messages[contestId];
      if (!list) {
        return;
      }
      state.messages[contestId] = list.filter((m) => m.id !== messageId);
    },
    setMessageVote: (state, action: PayloadAction<{ contestId: ContestID; messageId: string; value: -1 | 0 | 1 }>) => {
      const { contestId, messageId, value } = action.payload;
      const list = state.messages[contestId];
      if (!list) {
        return;
      }
      const message = list.find((m) => m.id === messageId);
      if (!message) {
        return;
      }
      const prevVote = message.user_vote || 0;
      message.user_vote = value;
      message.score = (message.score || 0) - prevVote + value;
    },
    /**
     * Score (и при необходимости свой user_vote) с сервера по WebSocket.
     * Если voter — текущий пользователь, выставляем user_vote, чтобы совпала подсветка кнопок.
     */
    mergeMessageScore: (
      state,
      action: PayloadAction<{
        contestId: ContestID;
        messageId: string;
        score: number;
        voterUserId?: number;
        voterValue?: -1 | 1;
        currentUserId?: number;
      }>
    ) => {
      const { contestId, messageId, score, voterUserId, voterValue, currentUserId } = action.payload;
      const list = state.messages[contestId];
      if (!list) {
        return;
      }
      const message = list.find((m) => m.id === messageId);
      if (!message) {
        return;
      }
      message.score = score;
      if (
        voterUserId !== undefined &&
        currentUserId !== undefined &&
        voterValue !== undefined &&
        Number(voterUserId) === Number(currentUserId)
      ) {
        message.user_vote = voterValue;
      }
    },
    setConnectionState: (state, action: PayloadAction<WSConnectionState>) => {
      state.connectionState = action.payload;
    },
    setCurrentContestId: (state, action: PayloadAction<ContestID | null>) => {
      state.currentContestId = action.payload;
    },
    clearMessages: (state, action: PayloadAction<ContestID>) => {
      delete state.messages[action.payload];
    },
    clearAllMessages: (state) => {
      state.messages = {};
    },
  },
});

export const {
  addMessage,
  setMessages,
  updateMessage,
  removeMessage,
  setMessageVote,
  mergeMessageScore,
  setConnectionState,
  setCurrentContestId,
  clearMessages,
  clearAllMessages,
} = chatSlice.actions;

export default chatSlice.reducer;
