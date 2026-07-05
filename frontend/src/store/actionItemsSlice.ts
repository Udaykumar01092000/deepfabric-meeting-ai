import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { actionItemsApi } from "../api/axios";

export type ActionItem = {
    id: number;
    meeting_id: number;
    meeting_title?: string;
    extraction_run_id: number | null;
    semantic_key: string;
    task_text: string;
    owner: string;
    status: "open" | "in-progress" | "done";
    due_date: string | null;
    priority: "low" | "medium" | "high";
    confidence: number;
    source_span_start: number | null;
    source_span_end: number | null;
    source_snippet: string | null;
    is_manually_edited: boolean;
    manually_edited_at: string | null;
    version: number;
    created_at: string;
    updated_at: string;
    comments?: Comment[];
};

export type Comment = {
    id: number;
    action_item_id: number;
    user_name: string;
    content: string;
    created_at: string;
};

export type InboxData = {
    dueThisWeek: ActionItem[];
    unassigned: ActionItem[];
    followUps: any[];
    overdue: ActionItem[];
    allMyItems: ActionItem[];
    summary: {
        dueThisWeekCount: number;
        unassignedCount: number;
        overdueCount: number;
        totalOpenCount: number;
    };
};

type ActionItemsState = {
    items: ActionItem[];
    inbox: InboxData | null;
    currentItem: (ActionItem & { comments: Comment[] }) | null;
    loading: boolean;
    error: string | null;
};

const initialState: ActionItemsState = {
    items: [],
    inbox: null,
    currentItem: null,
    loading: false,
    error: null,
};

export const fetchActionItems = createAsyncThunk("actionItems/fetchAll",
    async (params?: { meetingId?: number; owner?: string; status?: string }) => {
        const res = await actionItemsApi.getAll(params);
        return res.data;
    });

export const fetchInbox = createAsyncThunk("actionItems/fetchInbox",
    async (owner: string) => {
        const res = await actionItemsApi.getInbox(owner);
        return res.data;
    });

export const fetchActionItemById = createAsyncThunk("actionItems/fetchById",
    async (id: number) => {
        const res = await actionItemsApi.getById(id);
        return res.data;
    });

export const createActionItem = createAsyncThunk("actionItems/create",
    async (data: any) => {
        const res = await actionItemsApi.create(data);
        return res.data;
    });

export const updateActionItem = createAsyncThunk("actionItems/update",
    async ({ id, data }: { id: number; data: any }) => {
        const res = await actionItemsApi.update(id, data);
        return { id, ...res.data };
    });

export const deleteActionItem = createAsyncThunk("actionItems/delete",
    async (id: number) => {
        await actionItemsApi.delete(id);
        return id;
    });

export const unlockActionItem = createAsyncThunk("actionItems/unlock",
    async (id: number) => {
        const res = await actionItemsApi.unlock(id);
        return { id, ...res.data };
    });

export const addComment = createAsyncThunk("actionItems/addComment",
    async ({ id, userName, content }: { id: number; userName: string; content: string }) => {
        const res = await actionItemsApi.addComment(id, { userName, content });
        return { actionItemId: id, ...res.data };
    });

const actionItemsSlice = createSlice({
    name: "actionItems",
    initialState,
    reducers: {
        clearItems: (s) => { s.items = []; },
        clearInbox: (s) => { s.inbox = null; },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchActionItems.pending, (s) => { s.loading = true; })
            .addCase(fetchActionItems.fulfilled, (s, a) => { s.loading = false; s.items = a.payload; })
            .addCase(fetchActionItems.rejected, (s, a) => { s.loading = false; s.error = a.error.message || "Failed"; })

            .addCase(fetchInbox.pending, (s) => { s.loading = true; })
            .addCase(fetchInbox.fulfilled, (s, a) => { s.loading = false; s.inbox = a.payload; })
            .addCase(fetchInbox.rejected, (s, a) => { s.loading = false; s.error = a.error.message || "Failed"; })

            .addCase(fetchActionItemById.fulfilled, (s, a) => { s.currentItem = a.payload; })

            .addCase(deleteActionItem.fulfilled, (s, a) => {
                s.items = s.items.filter(i => i.id !== a.payload);
            });
    },
});

export const { clearItems, clearInbox } = actionItemsSlice.actions;
export default actionItemsSlice.reducer;
