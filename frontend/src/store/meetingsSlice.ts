import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { meetingsApi, extractionApi } from "../api/axios";

export type Meeting = {
    id: number;
    title: string;
    date_time: string;
    organizer: string;
    participants: string[];
    raw_content: string;
    attachments_metadata: any[];
    content_hash: string;
    action_item_count: number;
    decision_count: number;
    risk_count: number;
    extraction_run_count: number;
    created_at: string;
    updated_at: string;
};

export type ExtractionResult = {
    message: string;
    extractionRunId?: number;
    runNumber?: number;
    idempotent?: boolean;
    stats?: any;
    conflicts?: any[];
};

type MeetingsState = {
    list: Meeting[];
    currentMeeting: any | null;
    loading: boolean;
    extracting: number | null;
    extractionResult: ExtractionResult | null;
    error: string | null;
};

const initialState: MeetingsState = {
    list: [],
    currentMeeting: null,
    loading: false,
    extracting: null,
    extractionResult: null,
    error: null,
};

export const fetchMeetings = createAsyncThunk("meetings/fetchAll", async () => {
    const res = await meetingsApi.getAll();
    return res.data;
});

export const fetchMeetingById = createAsyncThunk("meetings/fetchById", async (id: number) => {
    const res = await meetingsApi.getById(id);
    return res.data;
});

export const createMeeting = createAsyncThunk("meetings/create", async (data: any) => {
    const res = await meetingsApi.create(data);
    return res.data;
});

export const updateMeeting = createAsyncThunk("meetings/update", async ({ id, data }: { id: number; data: any }) => {
    const res = await meetingsApi.update(id, data);
    return res.data;
});

export const deleteMeeting = createAsyncThunk("meetings/delete", async (id: number) => {
    await meetingsApi.delete(id);
    return id;
});

export const runExtraction = createAsyncThunk("meetings/extract", async (meetingId: number) => {
    const res = await extractionApi.run(meetingId);
    return { meetingId, result: res.data };
});

const meetingsSlice = createSlice({
    name: "meetings",
    initialState,
    reducers: {
        clearExtractionResult: (state) => {
            state.extractionResult = null;
        },
        clearCurrentMeeting: (state) => {
            state.currentMeeting = null;
        },
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchMeetings.pending, (s) => { s.loading = true; s.error = null; })
            .addCase(fetchMeetings.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; })
            .addCase(fetchMeetings.rejected, (s, a) => { s.loading = false; s.error = a.error.message || "Failed to fetch meetings"; })

            .addCase(fetchMeetingById.pending, (s) => { s.loading = true; })
            .addCase(fetchMeetingById.fulfilled, (s, a) => { s.loading = false; s.currentMeeting = a.payload; })
            .addCase(fetchMeetingById.rejected, (s, a) => { s.loading = false; s.error = a.error.message || "Failed"; })

            .addCase(createMeeting.fulfilled, () => { /* Re-fetch list after */ })
            .addCase(deleteMeeting.fulfilled, (s, a) => { s.list = s.list.filter(m => m.id !== a.payload); })

            .addCase(runExtraction.pending, (s, a) => { s.extracting = a.meta.arg; s.extractionResult = null; })
            .addCase(runExtraction.fulfilled, (s, a) => { s.extracting = null; s.extractionResult = a.payload.result; })
            .addCase(runExtraction.rejected, (s, a) => { s.extracting = null; s.error = a.error.message || "Extraction failed"; });
    },
});

export const { clearExtractionResult, clearCurrentMeeting, clearError } = meetingsSlice.actions;
export default meetingsSlice.reducer;
