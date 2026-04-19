import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Comment, ParticipantID, CommentID } from '../../types/models';
import * as commentsApi from '../../api/commentsApi';
import { CreateCommentRequest, UpdateCommentRequest, CommentsListResponse, getApiErrorMessage } from '../../types/api';

interface CommentsState {
  items: Record<ParticipantID, Comment[]>;
  totals: Record<ParticipantID, number>;
  loading: boolean;
  error: string | null;
}

const initialState: CommentsState = {
  items: {},
  totals: {},
  loading: false,
  error: null,
};

// Async thunks
export const fetchComments = createAsyncThunk(
  'comments/fetchComments',
  async (
    { participantId, limit, offset }: { participantId: ParticipantID; limit?: number; offset?: number },
    { rejectWithValue }
  ) => {
    try {
      const response: CommentsListResponse = await commentsApi.getComments(participantId, limit, offset);
      return { participantId, comments: response.items, total: response.total };
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const createComment = createAsyncThunk(
  'comments/createComment',
  async ({ participantId, data }: { participantId: ParticipantID; data: CreateCommentRequest }, { rejectWithValue }) => {
    try {
      const comment = await commentsApi.createComment(participantId, data);
      return { participantId, comment };
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const updateComment = createAsyncThunk(
  'comments/updateComment',
  async ({ commentId, data }: { commentId: CommentID; data: UpdateCommentRequest }, { rejectWithValue }) => {
    try {
      const comment = await commentsApi.updateComment(commentId, data);
      return comment;
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const deleteComment = createAsyncThunk(
  'comments/deleteComment',
  async (commentId: CommentID, { rejectWithValue }) => {
    try {
      const deletedIds = await commentsApi.deleteComment(commentId);
      return { deletedIds };
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const voteComment = createAsyncThunk(
  'comments/voteComment',
  async ({ commentId, value }: { commentId: CommentID; value: -1 | 1 }, { rejectWithValue }) => {
    try {
      await commentsApi.voteComment(commentId, value);
      return { commentId, value };
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

const commentsSlice = createSlice({
  name: 'comments',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCommentVote: (state, action: PayloadAction<{ commentId: CommentID; value: -1 | 0 | 1 }>) => {
      const { commentId, value } = action.payload;
      Object.keys(state.items).forEach((participantId) => {
        const comment = state.items[participantId].find((c) => c.id === commentId);
        if (!comment) {
          return;
        }
        const prevVote = comment.user_vote || 0;
        comment.user_vote = value;
        comment.score = (comment.score || 0) - prevVote + value;
      });
    },
    /** Новый комментарий к работе с другого клиента (дедуп с собственным REST). */
    addWorkCommentFromWebSocket: (
      state,
      action: PayloadAction<{ participantId: ParticipantID; comment: Comment }>
    ) => {
      const { participantId, comment } = action.payload;
      if (!state.items[participantId]) {
        return;
      }
      if (state.items[participantId].some((c) => c.id === comment.id)) {
        return;
      }
      state.items[participantId].unshift(comment);
      state.totals[participantId] = (state.totals[participantId] || 0) + 1;
    },
    updateWorkCommentFromWebSocket: (state, action: PayloadAction<{ comment: Comment }>) => {
      const updated = action.payload.comment;
      const pid = updated.participant_id;
      const list = state.items[pid];
      if (!list) {
        return;
      }
      const index = list.findIndex((c) => c.id === updated.id);
      if (index >= 0) {
        list[index] = updated;
      }
    },
    removeWorkCommentFromWebSocket: (
      state,
      action: PayloadAction<{ participantId: ParticipantID; commentId: CommentID }>
    ) => {
      const { participantId, commentId } = action.payload;
      const list = state.items[participantId];
      if (!list) {
        return;
      }
      const before = list.length;
      state.items[participantId] = list.filter((c) => c.id !== commentId);
      if (state.items[participantId].length < before) {
        state.totals[participantId] = Math.max(0, (state.totals[participantId] || 0) - 1);
      }
    },
    mergeWorkCommentVoteFromWebSocket: (
      state,
      action: PayloadAction<{
        participantId: ParticipantID;
        commentId: CommentID;
        score: number;
        voterUserId: number;
        voterValue: number;
        currentUserId?: number;
      }>
    ) => {
      const { participantId, commentId, score, voterUserId, voterValue, currentUserId } = action.payload;
      const list = state.items[participantId];
      if (!list) {
        return;
      }
      const comment = list.find((c) => c.id === commentId);
      if (!comment) {
        return;
      }
      comment.score = score;
      if (currentUserId !== undefined && voterUserId === currentUserId) {
        const v = voterValue === -1 || voterValue === 1 ? voterValue : 0;
        comment.user_vote = v;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchComments
      .addCase(fetchComments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchComments.fulfilled, (state, action) => {
        state.loading = false;
        const { participantId, comments, total } = action.payload;
        state.items[participantId] = comments;
        state.totals[participantId] = total;
      })
      .addCase(fetchComments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // createComment
      .addCase(createComment.fulfilled, (state, action) => {
        const { participantId, comment } = action.payload;
        if (!state.items[participantId]) {
          state.items[participantId] = [];
        }
        state.items[participantId].unshift(comment);
        state.totals[participantId] = (state.totals[participantId] || 0) + 1;
      })
      // updateComment
      .addCase(updateComment.fulfilled, (state, action) => {
        const updatedComment = action.payload;
        // Find and update comment in all participants
        Object.keys(state.items).forEach((participantId) => {
          const index = state.items[participantId].findIndex((c) => c.id === updatedComment.id);
          if (index >= 0) {
            state.items[participantId][index] = updatedComment;
          }
        });
      })
      // deleteComment
      .addCase(deleteComment.fulfilled, (state, action) => {
        const deletedIds = new Set(action.payload.deletedIds);
        Object.keys(state.items).forEach((participantId) => {
          const list = state.items[participantId];
          const before = list.length;
          state.items[participantId] = list.filter((c) => !deletedIds.has(c.id));
          const removed = before - state.items[participantId].length;
          state.totals[participantId] = Math.max(0, (state.totals[participantId] || 0) - removed);
        });
      })
      .addCase(voteComment.fulfilled, () => {});
  },
});

export const {
  clearError,
  setCommentVote,
  addWorkCommentFromWebSocket,
  updateWorkCommentFromWebSocket,
  removeWorkCommentFromWebSocket,
  mergeWorkCommentVoteFromWebSocket,
} = commentsSlice.actions;
export default commentsSlice.reducer;
