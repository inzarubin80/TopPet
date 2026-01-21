import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Contest, ContestStatus, ContestID } from '../../types/models';
import * as contestsApi from '../../api/contestsApi';
import { CreateContestRequest, UpdateContestRequest } from '../../types/api';

interface ContestsState {
  items: Contest[];
  currentContest: Contest | null;
  total: number;
  loading: boolean;
  error: string | null;
  filters: {
    status?: ContestStatus;
    limit: number;
    offset: number;
  };
}

const initialState: ContestsState = {
  items: [],
  currentContest: null,
  total: 0,
  loading: false,
  error: null,
  filters: {
    limit: 20,
    offset: 0,
  },
};

// Async thunks
export const fetchContests = createAsyncThunk(
  'contests/fetchContests',
  async (params: { status?: ContestStatus; limit?: number; offset?: number }, { rejectWithValue }) => {
    try {
      const response = await contestsApi.getContests(params.status, params.limit, params.offset);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch contests');
    }
  }
);

export const fetchContest = createAsyncThunk(
  'contests/fetchContest',
  async (contestId: ContestID, { rejectWithValue }) => {
    try {
      const contest = await contestsApi.getContest(contestId);
      return contest;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch contest');
    }
  }
);

export const createContest = createAsyncThunk(
  'contests/createContest',
  async (data: CreateContestRequest, { rejectWithValue }) => {
    try {
      const contest = await contestsApi.createContest(data);
      return contest;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create contest');
    }
  }
);

export const updateContest = createAsyncThunk(
  'contests/updateContest',
  async ({ contestId, data }: { contestId: ContestID; data: UpdateContestRequest }, { rejectWithValue }) => {
    try {
      const contest = await contestsApi.updateContest(contestId, data);
      return contest;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update contest');
    }
  }
);

export const publishContest = createAsyncThunk(
  'contests/publishContest',
  async (contestId: ContestID, { rejectWithValue }) => {
    try {
      const contest = await contestsApi.publishContest(contestId);
      return contest;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to publish contest');
    }
  }
);

export const finishContest = createAsyncThunk(
  'contests/finishContest',
  async (contestId: ContestID, { rejectWithValue }) => {
    try {
      const contest = await contestsApi.finishContest(contestId);
      return contest;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to finish contest');
    }
  }
);

export const deleteContest = createAsyncThunk(
  'contests/deleteContest',
  async (contestId: ContestID, { rejectWithValue }) => {
    try {
      await contestsApi.deleteContest(contestId);
      return contestId;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete contest');
    }
  }
);

const contestsSlice = createSlice({
  name: 'contests',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<{ status?: ContestStatus; limit?: number; offset?: number }>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearCurrentContest: (state) => {
      state.currentContest = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchContests
      .addCase(fetchContests.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContests.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.items;
        state.total = action.payload.total;
      })
      .addCase(fetchContests.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchContest
      .addCase(fetchContest.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchContest.fulfilled, (state, action) => {
        state.loading = false;
        state.currentContest = action.payload;
        // Update in items list if exists
        const index = state.items.findIndex((c) => c.id === action.payload.id);
        if (index >= 0) {
          state.items[index] = action.payload;
        }
      })
      .addCase(fetchContest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // createContest
      .addCase(createContest.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
        state.total += 1;
      })
      // updateContest
      .addCase(updateContest.fulfilled, (state, action) => {
        if (state.currentContest?.id === action.payload.id) {
          state.currentContest = action.payload;
        }
        const index = state.items.findIndex((c) => c.id === action.payload.id);
        if (index >= 0) {
          state.items[index] = action.payload;
        }
      })
      // publishContest
      .addCase(publishContest.fulfilled, (state, action) => {
        if (state.currentContest?.id === action.payload.id) {
          state.currentContest = action.payload;
        }
        const index = state.items.findIndex((c) => c.id === action.payload.id);
        if (index >= 0) {
          state.items[index] = action.payload;
        }
      })
      // finishContest
      .addCase(finishContest.fulfilled, (state, action) => {
        if (state.currentContest?.id === action.payload.id) {
          state.currentContest = action.payload;
        }
        const index = state.items.findIndex((c) => c.id === action.payload.id);
        if (index >= 0) {
          state.items[index] = action.payload;
        }
      })
      // deleteContest
      .addCase(deleteContest.fulfilled, (state, action) => {
        if (state.currentContest?.id === action.payload) {
          state.currentContest = null;
        }
        state.items = state.items.filter((c) => c.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      });
  },
});

export const { setFilters, clearCurrentContest, clearError } = contestsSlice.actions;
export default contestsSlice.reducer;
