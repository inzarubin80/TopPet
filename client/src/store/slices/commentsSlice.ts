import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Comment, ParticipantID, CommentID } from '../../types/models';
import * as commentsApi from '../../api/commentsApi';
import { CreateCommentRequest, UpdateCommentRequest, CommentsListResponse } from '../../types/api';

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
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch comments');
    }
  }
);

export const createComment = createAsyncThunk(
  'comments/createComment',
  async ({ participantId, data }: { participantId: ParticipantID; data: CreateCommentRequest }, { rejectWithValue }) => {
    try {
      const comment = await commentsApi.createComment(participantId, data);
      return { participantId, comment };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create comment');
    }
  }
);

export const updateComment = createAsyncThunk(
  'comments/updateComment',
  async ({ commentId, data }: { commentId: CommentID; data: UpdateCommentRequest }, { rejectWithValue }) => {
    try {
      const comment = await commentsApi.updateComment(commentId, data);
      return comment;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update comment');
    }
  }
);

export const deleteComment = createAsyncThunk(
  'comments/deleteComment',
  async (commentId: CommentID, { rejectWithValue }) => {
    try {
      await commentsApi.deleteComment(commentId);
      return commentId;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete comment');
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
        const commentId = action.payload;
        // Remove comment from all participants
        Object.keys(state.items).forEach((participantId) => {
          state.items[participantId] = state.items[participantId].filter((c) => c.id !== commentId);
          state.totals[participantId] = Math.max(0, (state.totals[participantId] || 0) - 1);
        });
      });
  },
});

export const { clearError } = commentsSlice.actions;
export default commentsSlice.reducer;
