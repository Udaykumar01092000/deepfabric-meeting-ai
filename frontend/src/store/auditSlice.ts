import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { auditApi } from "../api/axios";

export type AuditLog = {
    id: number;
    meeting_id: number | null;
    entity_type: string;
    entity_id: number | null;
    action: string;
    old_value: any;
    new_value: any;
    changed_by: string;
    details: string;
    created_at: string;
};

type AuditState = {
    logs: AuditLog[];
    loading: boolean;
};

const initialState: AuditState = {
    logs: [],
    loading: false,
};

export const fetchAuditLogs = createAsyncThunk("audit/fetch",
    async (params?: { meetingId?: number; entityType?: string; action?: string }) => {
        const res = await auditApi.getAll(params);
        return res.data;
    });

const auditSlice = createSlice({
    name: "audit",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchAuditLogs.pending, (s) => { s.loading = true; })
            .addCase(fetchAuditLogs.fulfilled, (s, a) => { s.loading = false; s.logs = a.payload; })
            .addCase(fetchAuditLogs.rejected, (s) => { s.loading = false; });
    },
});

export default auditSlice.reducer;
