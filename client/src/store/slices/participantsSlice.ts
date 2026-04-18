import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { Participant, ParticipantID, ContestID, ParticipantSubmissionStatus } from '../../types/models';
import * as participantsApi from '../../api/participantsApi';
import type {
  GetParticipantsByContestOptions,
  ParticipantsListNominationFilter,
  ParticipantsListSort,
  ParticipantsListSubmissionFilter,
} from '../../api/participantsApi';
import { CreateParticipantRequest, UpdateParticipantRequest, getApiErrorMessage } from '../../types/api';

interface ParticipantsState {
  items: Record<ParticipantID, Participant>;
  byContest: Record<ContestID, ParticipantID[]>;
  /** Всего записей в списке конкурса (с учётом фильтров), для пагинации */
  listTotalByContest: Record<ContestID, number>;
  /** Заявки текущего пользователя в конкурсе (черновик / регистрация), для кнопок «Уже участвуете» */
  mineByContest: Record<ContestID, Participant[]>;
  /** Последний dispatch fetchParticipantsByContest — чтобы игнорировать устаревший fulfilled при гонке запросов. */
  latestParticipantsListRequestId: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: ParticipantsState = {
  items: {},
  byContest: {},
  listTotalByContest: {},
  mineByContest: {},
  latestParticipantsListRequestId: null,
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
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export type { ParticipantsListNominationFilter };

export const fetchParticipantsByContest = createAsyncThunk(
  'participants/fetchParticipantsByContest',
  async (
    payload:
      | ContestID
      | {
          contestId: ContestID;
          nominationFilter?: ParticipantsListNominationFilter;
          submissionFilter?: ParticipantsListSubmissionFilter;
          votedOnly?: boolean;
          limit?: number;
          offset?: number;
          sort?: ParticipantsListSort;
        },
    { rejectWithValue }
  ) => {
    try {
      const contestId = typeof payload === 'string' ? payload : payload.contestId;
      const nominationFilter: ParticipantsListNominationFilter =
        typeof payload === 'string' ? 'all' : payload.nominationFilter ?? 'all';
      const submissionFilter: ParticipantsListSubmissionFilter =
        typeof payload === 'string' ? 'all' : payload.submissionFilter ?? 'all';
      const votedOnly = typeof payload === 'string' ? false : payload.votedOnly ?? false;
      let listOptions: GetParticipantsByContestOptions | undefined;
      if (typeof payload === 'object') {
        const o: GetParticipantsByContestOptions = {};
        if (payload.limit !== undefined) {
          o.limit = payload.limit;
        }
        if (payload.offset !== undefined) {
          o.offset = payload.offset;
        }
        if (submissionFilter !== 'all') {
          o.submissionFilter = submissionFilter;
        }
        if (votedOnly) {
          o.votedOnly = true;
        }
        if (payload.sort) {
          o.sort = payload.sort;
        }
        listOptions = Object.keys(o).length > 0 ? o : undefined;
      }
      const { items: participants, total, limit: appliedLimit, offset: appliedOffset } =
        await participantsApi.getParticipantsByContest(contestId, nominationFilter, listOptions);
      return {
        contestId,
        participants,
        total,
        limit: appliedLimit,
        offset: appliedOffset,
        nominationFilter,
      };
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const fetchMyParticipantsForContest = createAsyncThunk(
  'participants/fetchMyParticipantsForContest',
  async ({ contestId }: { contestId: ContestID }, { rejectWithValue }) => {
    try {
      const { items } = await participantsApi.getParticipantsByContest(contestId, 'all', {
        participantScope: 'mine',
        limit: 100,
        offset: 0,
      });
      return { contestId, items };
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const createParticipant = createAsyncThunk(
  'participants/createParticipant',
  async ({ contestId, data }: { contestId: ContestID; data: CreateParticipantRequest }, { rejectWithValue }) => {
    try {
      const participant = await participantsApi.createParticipant(contestId, data);
      return participant;
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const uploadPhoto = createAsyncThunk(
  'participants/uploadPhoto',
  async ({ participantId, file }: { participantId: ParticipantID; file: File }, { rejectWithValue }) => {
    try {
      const photo = await participantsApi.uploadPhoto(participantId, file);
      return { participantId, photo };
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const updateParticipant = createAsyncThunk(
  'participants/updateParticipant',
  async ({ participantId, data }: { participantId: ParticipantID; data: UpdateParticipantRequest }, { rejectWithValue }) => {
    try {
      const participant = await participantsApi.updateParticipant(participantId, data);
      return participant;
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const deleteParticipant = createAsyncThunk(
  'participants/deleteParticipant',
  async (participantId: ParticipantID, { rejectWithValue }) => {
    try {
      await participantsApi.deleteParticipant(participantId);
      return participantId;
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const deletePhoto = createAsyncThunk(
  'participants/deletePhoto',
  async ({ participantId, photoId }: { participantId: ParticipantID; photoId: string }, { rejectWithValue }) => {
    try {
      await participantsApi.deletePhoto(participantId, photoId);
      return { participantId, photoId };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to delete photo');
    }
  }
);

export const updatePhotoOrder = createAsyncThunk(
  'participants/updatePhotoOrder',
  async ({ participantId, photoIds }: { participantId: ParticipantID; photoIds: string[] }, { rejectWithValue }) => {
    try {
      await participantsApi.updatePhotoOrder(participantId, photoIds);
      return { participantId, photoIds };
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
    }
  }
);

export const patchParticipantSubmission = createAsyncThunk(
  'participants/patchParticipantSubmission',
  async (
    {
      participantId,
      submission_status,
      submission_comment,
    }: {
      participantId: ParticipantID;
      submission_status: ParticipantSubmissionStatus;
      submission_comment?: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const participant = await participantsApi.patchParticipantSubmission(
        participantId,
        submission_status,
        submission_comment
      );
      return participant;
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error));
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
    updateParticipantVotes: (
      state,
      action: {
        payload: { participantId: ParticipantID; totalVotes: number };
        type: string;
      }
    ) => {
      const { participantId, totalVotes } = action.payload;
      const participant = state.items[participantId];
      if (participant) {
        participant.total_votes = totalVotes;
      }
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
      .addCase(fetchParticipantsByContest.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.latestParticipantsListRequestId = action.meta.requestId;
      })
      .addCase(fetchParticipantsByContest.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.latestParticipantsListRequestId) {
          return;
        }
        state.loading = false;
        const { contestId, participants, total } = action.payload;
        const participantIds: ParticipantID[] = [];
        if (Array.isArray(participants)) {
          participants.forEach((p) => {
            state.items[p.id] = p;
            participantIds.push(p.id);
          });
        }
        state.byContest[contestId] = participantIds;
        state.listTotalByContest[contestId] = total;
      })
      .addCase(fetchMyParticipantsForContest.fulfilled, (state, action) => {
        const { contestId, items } = action.payload;
        for (const p of items) {
          state.items[p.id] = p;
        }
        state.mineByContest[contestId] = items;
      })
      .addCase(fetchParticipantsByContest.rejected, (state, action) => {
        if (action.meta.requestId !== state.latestParticipantsListRequestId) {
          return;
        }
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
          participant.submission_status = 'pending';
          participant.submission_comment = undefined;
        }
      })
      // updateParticipant
      .addCase(updateParticipant.fulfilled, (state, action) => {
        state.items[action.payload.id] = action.payload;
      })
      .addCase(updateParticipant.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // deleteParticipant
      .addCase(deleteParticipant.fulfilled, (state, action) => {
        const participantId = action.payload;
        delete state.items[participantId];
        for (const contestId in state.byContest) {
          state.byContest[contestId] = state.byContest[contestId].filter((id) => id !== participantId);
        }
        for (const contestId in state.mineByContest) {
          state.mineByContest[contestId] = state.mineByContest[contestId].filter((p) => p.id !== participantId);
        }
      })
      .addCase(deleteParticipant.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // deletePhoto
      .addCase(deletePhoto.fulfilled, (state, action) => {
        const { participantId, photoId } = action.payload;
        const participant = state.items[participantId];
        if (participant && participant.photos) {
          participant.photos = participant.photos.filter(photo => photo.id !== photoId);
          participant.submission_status = 'pending';
          participant.submission_comment = undefined;
        }
      })
      .addCase(deletePhoto.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // updatePhotoOrder
      .addCase(updatePhotoOrder.fulfilled, (state, action) => {
        const { participantId, photoIds } = action.payload;
        const participant = state.items[participantId];
        if (participant && participant.photos) {
          const map = new Map(participant.photos.map((photo) => [photo.id, photo]));
          participant.photos = photoIds
            .map((id) => map.get(id))
            .filter((photo): photo is NonNullable<typeof photo> => !!photo);
          participant.submission_status = 'pending';
          participant.submission_comment = undefined;
        }
      })
      .addCase(updatePhotoOrder.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      .addCase(patchParticipantSubmission.fulfilled, (state, action) => {
        state.items[action.payload.id] = action.payload;
      })
      .addCase(patchParticipantSubmission.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { clearError, updateParticipantVotes } = participantsSlice.actions;
export default participantsSlice.reducer;
