import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { notificationsApi } from "../api/axios";

export type Notification = {
    id: number;
    user_name: string;
    meeting_id: number | null;
    meeting_title?: string;
    action_item_id: number | null;
    type: string;
    message: string;
    is_read: boolean;
    created_at: string;
};

type NotificationsState = {
    items: Notification[];
    loading: boolean;
    unreadCount: number;
};

const initialState: NotificationsState = {
    items: [],
    loading: false,
    unreadCount: 0,
};

export const fetchNotifications = createAsyncThunk("notifications/fetch",
    async ({ user, unreadOnly }: { user: string; unreadOnly?: boolean }) => {
        const res = await notificationsApi.get(user, unreadOnly);
        return res.data;
    });

export const markNotificationRead = createAsyncThunk("notifications/markRead",
    async (id: number) => {
        await notificationsApi.markRead(id);
        return id;
    });

const notificationsSlice = createSlice({
    name: "notifications",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchNotifications.fulfilled, (s, a) => {
                s.items = a.payload;
                s.unreadCount = a.payload.filter((n: Notification) => !n.is_read).length;
            })
            .addCase(markNotificationRead.fulfilled, (s, a) => {
                const n = s.items.find(i => i.id === a.payload);
                if (n) { n.is_read = true; s.unreadCount = Math.max(0, s.unreadCount - 1); }
            });
    },
});

export default notificationsSlice.reducer;
