import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { StaffCommentNotification } from '../../types/models';
import * as api from '../../api/staffCommentNotificationsApi';
import { getApiErrorMessage } from '../../types/api';

interface NotificationsState {
  items: StaffCommentNotification[];
  totalUnread: number;
  loading: boolean;
  error: string | null;
}

const initialState: NotificationsState = {
  items: [],
  totalUnread: 0,
  loading: false,
  error: null,
};

export const fetchStaffCommentNotifications = createAsyncThunk(
  'notifications/fetchStaffCommentNotifications',
  async (_, { rejectWithValue }) => {
    try {
      return await api.getStaffCommentNotifications();
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    clearStaffNotifications: (state) => {
      state.items = [];
      state.totalUnread = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStaffCommentNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStaffCommentNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.totalUnread = action.payload.total_unread;
      })
      .addCase(fetchStaffCommentNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearStaffNotifications } = notificationsSlice.actions;
export default notificationsSlice.reducer;
