import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { UserNotification } from '../../types/notifications';
import * as notificationsApi from '../../api/notificationsApi';
import { getApiErrorMessage } from '../../types/api';
import { logout } from './authSlice';
import type { UserNotificationsConnectionState } from '../../websocket/userNotificationsClient';

export const NOTIFICATIONS_PAGE_SIZE = 20;

export interface NotificationsState {
  totalUnread: number;
  socketState: UserNotificationsConnectionState;
  lastIncoming: UserNotification | null;
  listSynced: boolean;
  items: UserNotification[];
  listStatus: 'idle' | 'loading' | 'loadingMore' | 'succeeded' | 'failed';
  listError: string | null;
  hasMore: boolean;
  /** Фоновое обновление первой страницы (уже есть элементы в списке). */
  refreshInProgress: boolean;
  readRollback: Record<string, string | null>;
}

function getInitialState(): NotificationsState {
  return {
    totalUnread: 0,
    socketState: 'DISCONNECTED',
    lastIncoming: null,
    listSynced: false,
    items: [],
    listStatus: 'idle',
    listError: null,
    hasMore: false,
    refreshInProgress: false,
    readRollback: {},
  };
}

const initialState = getInitialState();

function normalizeNotification(raw: unknown): UserNotification {
  const r = raw as Record<string, unknown>;
  const payloadRaw = r.payload;
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
    id: String(r.id ?? ''),
    user_id: Number(r.user_id ?? 0),
    kind: String(r.kind ?? ''),
    payload,
    read_at: r.read_at != null ? String(r.read_at) : null,
    created_at: String(r.created_at ?? ''),
  };
}

/** Первая страница + total_unread: при логине и при refocus вкладки. */
export const bootstrapNotifications = createAsyncThunk(
  'notifications/bootstrap',
  async (opts: { signal?: AbortSignal } | undefined, { rejectWithValue }) => {
    try {
      const res = await notificationsApi.fetchNotifications({
        limit: NOTIFICATIONS_PAGE_SIZE,
        signal: opts?.signal,
      });
      return res;
    } catch (error: unknown) {
      if (axios.isCancel(error)) {
        return rejectWithValue(undefined);
      }
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const loadMoreNotifications = createAsyncThunk(
  'notifications/loadMore',
  async (opts: { signal?: AbortSignal } | undefined, { getState, rejectWithValue }) => {
    const state = getState() as { notifications: NotificationsState };
    const { items, hasMore, listStatus } = state.notifications;
    if (!hasMore || listStatus === 'loadingMore' || listStatus === 'loading') {
      return rejectWithValue(undefined);
    }
    const last = items[items.length - 1];
    if (!last) {
      return rejectWithValue(undefined);
    }
    try {
      const res = await notificationsApi.fetchNotifications({
        limit: NOTIFICATIONS_PAGE_SIZE,
        cursor_created_at: last.created_at,
        cursor_id: last.id,
        signal: opts?.signal,
      });
      return res;
    } catch (error: unknown) {
      if (axios.isCancel(error)) {
        return rejectWithValue(undefined);
      }
      return rejectWithValue(getApiErrorMessage(error));
    }
  },
  {
    condition: (_, { getState }) => {
      const s = (getState() as { notifications: NotificationsState }).notifications;
      return s.hasMore && s.items.length > 0 && s.listStatus === 'succeeded';
    },
  }
);

export const markNotificationReadThunk = createAsyncThunk(
  'notifications/markRead',
  async (id: string, { rejectWithValue, signal }) => {
    try {
      const raw = await notificationsApi.markNotificationRead(id, signal);
      return normalizeNotification(raw);
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const markAllNotificationsReadThunk = createAsyncThunk(
  'notifications/markAllRead',
  async (_: undefined, { rejectWithValue, signal }) => {
    try {
      await notificationsApi.markAllNotificationsRead(signal);
      return true;
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setTotalUnread: (state, action: PayloadAction<number>) => {
      state.totalUnread = action.payload;
    },
    setNotificationsSocketState: (state, action: PayloadAction<UserNotificationsConnectionState>) => {
      state.socketState = action.payload;
    },
    pushIncomingNotification: (state, action: PayloadAction<UserNotification>) => {
      const n = action.payload;
      state.lastIncoming = n;
      const idx = state.items.findIndex((i) => i.id === n.id);
      if (idx >= 0) {
        state.items[idx] = n;
        return;
      }
      state.items = [n, ...state.items];
      if (!n.read_at) {
        state.totalUnread += 1;
      }
    },
    applyUnreadSnapshot: (state, action: PayloadAction<number>) => {
      state.totalUnread = action.payload;
      state.listSynced = true;
    },
    markAllReadLocal: (state) => {
      state.totalUnread = 0;
      state.items = state.items.map((it) =>
        it.read_at ? it : { ...it, read_at: new Date().toISOString() }
      );
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(logout, () => getInitialState())
      .addCase(bootstrapNotifications.pending, (state) => {
        state.listError = null;
        if (state.items.length === 0) {
          state.listStatus = 'loading';
        } else {
          state.refreshInProgress = true;
        }
      })
      .addCase(bootstrapNotifications.fulfilled, (state, action) => {
        state.refreshInProgress = false;
        state.listStatus = 'succeeded';
        state.listSynced = true;
        state.totalUnread = action.payload.total_unread;
        state.items = action.payload.items.map((it) => normalizeNotification(it));
        state.hasMore = action.payload.items.length >= NOTIFICATIONS_PAGE_SIZE;
      })
      .addCase(bootstrapNotifications.rejected, (state, action) => {
        state.refreshInProgress = false;
        if (action.meta.aborted) {
          return;
        }
        if (action.payload === undefined) {
          return;
        }
        state.listError = String(action.payload);
        if (state.items.length === 0) {
          state.listStatus = 'failed';
        }
      })
      .addCase(loadMoreNotifications.pending, (state) => {
        state.listStatus = 'loadingMore';
        state.listError = null;
      })
      .addCase(loadMoreNotifications.fulfilled, (state, action) => {
        state.listStatus = 'succeeded';
        state.listError = null;
        const incoming = action.payload.items.map((it) => normalizeNotification(it));
        const seen = new Set(state.items.map((i) => i.id));
        for (const it of incoming) {
          if (!seen.has(it.id)) {
            seen.add(it.id);
            state.items.push(it);
          }
        }
        state.hasMore = incoming.length >= NOTIFICATIONS_PAGE_SIZE;
      })
      .addCase(loadMoreNotifications.rejected, (state, action) => {
        state.listStatus = 'succeeded';
        if (action.meta.aborted || action.payload === undefined) {
          return;
        }
        state.listError = String(action.payload);
      })
      .addCase(markNotificationReadThunk.pending, (state, action) => {
        const id = action.meta.arg as string;
        const item = state.items.find((i) => i.id === id);
        if (!item) {
          return;
        }
        state.readRollback[id] = item.read_at;
        if (!item.read_at) {
          item.read_at = new Date().toISOString();
          state.totalUnread = Math.max(0, state.totalUnread - 1);
        }
      })
      .addCase(markNotificationReadThunk.fulfilled, (state, action) => {
        const updated = action.payload;
        delete state.readRollback[updated.id];
        const idx = state.items.findIndex((i) => i.id === updated.id);
        if (idx >= 0) {
          state.items[idx] = updated;
        }
      })
      .addCase(markNotificationReadThunk.rejected, (state, action) => {
        const id = action.meta.arg as string;
        const prev = state.readRollback[id];
        delete state.readRollback[id];
        const item = state.items.find((i) => i.id === id);
        if (!item) {
          return;
        }
        const wasUnreadBeforeOptimism = prev == null;
        item.read_at = prev;
        if (wasUnreadBeforeOptimism) {
          state.totalUnread += 1;
        }
      })
      .addCase(markAllNotificationsReadThunk.fulfilled, (state) => {
        state.items = state.items.map((it) =>
          it.read_at ? it : { ...it, read_at: new Date().toISOString() }
        );
        state.totalUnread = 0;
      })
      .addCase(markAllNotificationsReadThunk.rejected, () => {});
  },
});

export const { setTotalUnread, setNotificationsSocketState, pushIncomingNotification, applyUnreadSnapshot, markAllReadLocal } =
  notificationsSlice.actions;

export default notificationsSlice.reducer;
