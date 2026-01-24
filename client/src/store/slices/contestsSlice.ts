import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Contest, ContestStatus, ContestID } from '../../types/models';
import * as contestsApi from '../../api/contestsApi';
import { CreateContestRequest, UpdateContestRequest, getApiErrorMessage } from '../../types/api';

interface ContestsState {
  items: Contest[];
  currentContest: Contest | null;
  total: number;
  loading: boolean;
  error: string | null;
  userVotes: Record<ContestID, string | null>;
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
  userVotes: {},
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
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const fetchContest = createAsyncThunk(
  'contests/fetchContest',
  async (contestId: ContestID, { rejectWithValue }) => {
    try {
      const contest = await contestsApi.getContest(contestId);
      return contest;
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const createContest = createAsyncThunk(
  'contests/createContest',
  async (data: CreateContestRequest, { rejectWithValue }) => {
    try {
      const contest = await contestsApi.createContest(data);
      return contest;
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const updateContest = createAsyncThunk(
  'contests/updateContest',
  async ({ contestId, data }: { contestId: ContestID; data: UpdateContestRequest }, { rejectWithValue }) => {
    try {
      const contest = await contestsApi.updateContest(contestId, data);
      return contest;
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const updateContestStatus = createAsyncThunk(
  'contests/updateContestStatus',
  async ({ contestId, status }: { contestId: ContestID; status: ContestStatus }, { rejectWithValue }) => {
    try {
      const contest = await contestsApi.updateContestStatus(contestId, { status });
      return contest;
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const publishContest = createAsyncThunk(
  'contests/publishContest',
  async (contestId: ContestID, { rejectWithValue }) => {
    try {
      const contest = await contestsApi.publishContest(contestId);
      return contest;
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const finishContest = createAsyncThunk(
  'contests/finishContest',
  async (contestId: ContestID, { rejectWithValue }) => {
    try {
      const contest = await contestsApi.finishContest(contestId);
      return contest;
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const deleteContest = createAsyncThunk(
  'contests/deleteContest',
  async (contestId: ContestID, { rejectWithValue }) => {
    try {
      await contestsApi.deleteContest(contestId);
      return contestId;
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
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
    setUserVote: (state, action: PayloadAction<{ contestId: ContestID; participantId: string | null }>) => {
      state.userVotes[action.payload.contestId] = action.payload.participantId;
    },
    clearUserVote: (state, action: PayloadAction<ContestID>) => {
      delete state.userVotes[action.payload];
    },
    updateContestTotalVotes: (
      state,
      action: PayloadAction<{ contestId: ContestID; totalVotes: number }>
    ) => {
      const { contestId, totalVotes } = action.payload;
      if (state.currentContest?.id === contestId) {
        state.currentContest.total_votes = totalVotes;
      }
      const index = state.items.findIndex((contest) => contest.id === contestId);
      if (index >= 0) {
        state.items[index].total_votes = totalVotes;
      }
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
      // updateContestStatus
      .addCase(updateContestStatus.fulfilled, (state, action) => {
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

export const {
  setFilters,
  clearCurrentContest,
  clearError,
  setUserVote,
  clearUserVote,
  updateContestTotalVotes,
} = contestsSlice.actions;
export default contestsSlice.reducer;
