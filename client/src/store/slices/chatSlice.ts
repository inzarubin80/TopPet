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
  setConnectionState,
  setCurrentContestId,
  clearMessages,
  clearAllMessages,
} = chatSlice.actions;

export default chatSlice.reducer;
