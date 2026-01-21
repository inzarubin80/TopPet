import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Participant, ParticipantID, ContestID } from '../../types/models';
import * as participantsApi from '../../api/participantsApi';
import { CreateParticipantRequest } from '../../types/api';

interface ParticipantsState {
  items: Record<ParticipantID, Participant>;
  byContest: Record<ContestID, ParticipantID[]>;
  loading: boolean;
  error: string | null;
}

const initialState: ParticipantsState = {
  items: {},
  byContest: {},
  loading: false,
  error: null,
};

// Async thunks
export const fetchParticipant = createAsyncThunk(
  'participants/fetchParticipant',
  async ({ contestId, participantId }: { contestId: ContestID; participantId: ParticipantID }, { rejectWithValue }) => {
    try {
      const participant = await participantsApi.getParticipant(contestId, participantId);
      return participant;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch participant');
    }
  }
);

export const fetchParticipantsByContest = createAsyncThunk(
  'participants/fetchParticipantsByContest',
  async (contestId: ContestID, { rejectWithValue }) => {
    try {
      const participants = await participantsApi.getParticipantsByContest(contestId);
      return { contestId, participants };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch participants');
    }
  }
);

export const createParticipant = createAsyncThunk(
  'participants/createParticipant',
  async ({ contestId, data }: { contestId: ContestID; data: CreateParticipantRequest }, { rejectWithValue }) => {
    try {
      const participant = await participantsApi.createParticipant(contestId, data);
      return participant;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to create participant');
    }
  }
);

export const uploadPhoto = createAsyncThunk(
  'participants/uploadPhoto',
  async ({ participantId, file }: { participantId: ParticipantID; file: File }, { rejectWithValue }) => {
    try {
      const photo = await participantsApi.uploadPhoto(participantId, file);
      return { participantId, photo };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to upload photo');
    }
  }
);

export const uploadVideo = createAsyncThunk(
  'participants/uploadVideo',
  async ({ participantId, file }: { participantId: ParticipantID; file: File }, { rejectWithValue }) => {
    try {
      const video = await participantsApi.uploadVideo(participantId, file);
      return { participantId, video };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to upload video');
    }
  }
);

const participantsSlice = createSlice({
  name: 'participants',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchParticipant
      .addCase(fetchParticipant.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchParticipant.fulfilled, (state, action) => {
        state.loading = false;
        state.items[action.payload.id] = action.payload;
      })
      .addCase(fetchParticipant.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // fetchParticipantsByContest
      .addCase(fetchParticipantsByContest.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchParticipantsByContest.fulfilled, (state, action) => {
        state.loading = false;
        const { contestId, participants } = action.payload;
        const participantIds: ParticipantID[] = [];
        participants.forEach((p) => {
          state.items[p.id] = p;
          participantIds.push(p.id);
        });
        state.byContest[contestId] = participantIds;
      })
      .addCase(fetchParticipantsByContest.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // createParticipant
      .addCase(createParticipant.fulfilled, (state, action) => {
        state.items[action.payload.id] = action.payload;
        const contestId = action.payload.contest_id;
        if (!state.byContest[contestId]) {
          state.byContest[contestId] = [];
        }
        if (!state.byContest[contestId].includes(action.payload.id)) {
          state.byContest[contestId].push(action.payload.id);
        }
      })
      // uploadPhoto
      .addCase(uploadPhoto.fulfilled, (state, action) => {
        const { participantId, photo } = action.payload;
        const participant = state.items[participantId];
        if (participant) {
          if (!participant.photos) {
            participant.photos = [];
          }
          participant.photos.push(photo);
        }
      })
      // uploadVideo
      .addCase(uploadVideo.fulfilled, (state, action) => {
        const { participantId, video } = action.payload;
        const participant = state.items[participantId];
        if (participant) {
          participant.video = video;
        }
      });
  },
});

export const { clearError } = participantsSlice.actions;
export default participantsSlice.reducer;
