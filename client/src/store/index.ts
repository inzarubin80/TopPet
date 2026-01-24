import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import contestsReducer from './slices/contestsSlice';
import participantsReducer from './slices/participantsSlice';
import commentsReducer from './slices/commentsSlice';
import chatReducer from './slices/chatSlice';
import photoLikesReducer from './slices/photoLikesSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    contests: contestsReducer,
    participants: participantsReducer,
    comments: commentsReducer,
    chat: chatReducer,
    photoLikes: photoLikesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
