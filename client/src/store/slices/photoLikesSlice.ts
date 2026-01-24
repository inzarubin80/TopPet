import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as photoLikesApi from '../../api/photoLikesApi';
import { PhotoLikeResponse } from '../../types/models';

interface PhotoLikeState {
  likes: Record<string, PhotoLikeResponse>; // photoId -> { like_count, is_liked }
  loading: Record<string, boolean>; // photoId -> loading state
  error: string | null;
}

const initialState: PhotoLikeState = {
  likes: {},
  loading: {},
  error: null,
};

// Async thunks
export const fetchPhotoLike = createAsyncThunk(
  'photoLikes/fetchPhotoLike',
  async (photoId: string, { rejectWithValue }) => {
    try {
      const response = await photoLikesApi.getPhotoLike(photoId);
      if (!response) {
        return { photoId, like_count: 0, is_liked: false };
      }
      return { photoId, ...response };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch photo like');
    }
  }
);

export const likePhoto = createAsyncThunk(
  'photoLikes/likePhoto',
  async (photoId: string, { rejectWithValue }) => {
    try {
      const response = await photoLikesApi.likePhoto(photoId);
      return { photoId, ...response };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to like photo');
    }
  }
);

export const unlikePhoto = createAsyncThunk(
  'photoLikes/unlikePhoto',
  async (photoId: string, { rejectWithValue }) => {
    try {
      const response = await photoLikesApi.unlikePhoto(photoId);
      if (!response) {
        // If no response, assume we need to fetch current state
        const currentState = await photoLikesApi.getPhotoLike(photoId);
        return { photoId, like_count: currentState?.like_count || 0, is_liked: false };
      }
      return { photoId, ...response };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to unlike photo');
    }
  }
);

const photoLikesSlice = createSlice({
  name: 'photoLikes',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setPhotoLike: (state, action: { payload: { photoId: string; like_count: number; is_liked: boolean } }) => {
      const { photoId, like_count, is_liked } = action.payload;
      state.likes[photoId] = { like_count, is_liked };
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchPhotoLike
      .addCase(fetchPhotoLike.pending, (state, action) => {
        state.loading[action.meta.arg] = true;
        state.error = null;
      })
      .addCase(fetchPhotoLike.fulfilled, (state, action) => {
        state.loading[action.payload.photoId] = false;
        state.likes[action.payload.photoId] = {
          like_count: action.payload.like_count,
          is_liked: action.payload.is_liked,
        };
      })
      .addCase(fetchPhotoLike.rejected, (state, action) => {
        state.loading[action.meta.arg] = false;
        state.error = action.payload as string;
      })
      // likePhoto
      .addCase(likePhoto.pending, (state, action) => {
        state.loading[action.meta.arg] = true;
        state.error = null;
      })
      .addCase(likePhoto.fulfilled, (state, action) => {
        state.loading[action.payload.photoId] = false;
        state.likes[action.payload.photoId] = {
          like_count: action.payload.like_count,
          is_liked: action.payload.is_liked,
        };
      })
      .addCase(likePhoto.rejected, (state, action) => {
        state.loading[action.meta.arg] = false;
        state.error = action.payload as string;
      })
      // unlikePhoto
      .addCase(unlikePhoto.pending, (state, action) => {
        state.loading[action.meta.arg] = true;
        state.error = null;
      })
      .addCase(unlikePhoto.fulfilled, (state, action) => {
        state.loading[action.payload.photoId] = false;
        state.likes[action.payload.photoId] = {
          like_count: action.payload.like_count,
          is_liked: action.payload.is_liked,
        };
      })
      .addCase(unlikePhoto.rejected, (state, action) => {
        state.loading[action.meta.arg] = false;
        state.error = action.payload as string;
      });
  },
});

export const { clearError, setPhotoLike } = photoLikesSlice.actions;
export default photoLikesSlice.reducer;
