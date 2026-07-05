import axios from "axios";

const API = axios.create({
    baseURL: "http://localhost:5000/api",
});

// ============================================================
// MEETINGS
// ============================================================
export const meetingsApi = {
    getAll: () => API.get("/meetings"),
    getById: (id: number) => API.get(`/meetings/${id}`),
    create: (data: {
        title: string;
        dateTime?: string;
        organizer?: string;
        participants: string[] | string;
        rawContent: string;
        attachmentsMetadata?: any[];
    }) => API.post("/meetings", data),
    update: (id: number, data: any) => API.put(`/meetings/${id}`, data),
    delete: (id: number) => API.delete(`/meetings/${id}`),
};

// ============================================================
// EXTRACTION
// ============================================================
export const extractionApi = {
    run: (meetingId: number) => API.post(`/meetings/${meetingId}/extract`),
    getRuns: (meetingId: number) => API.get(`/meetings/${meetingId}/extraction-runs`),
    resolveConflict: (meetingId: number, data: any) =>
        API.post(`/meetings/${meetingId}/resolve-conflict`, data),
};

// ============================================================
// ACTION ITEMS
// ============================================================
export const actionItemsApi = {
    getAll: (params?: { meetingId?: number; owner?: string; status?: string }) =>
        API.get("/action-items", { params }),
    getInbox: (owner: string) =>
        API.get("/action-items/inbox", { params: { owner } }),
    getById: (id: number) => API.get(`/action-items/${id}`),
    create: (data: {
        meetingId: number;
        taskText: string;
        owner?: string;
        dueDate?: string;
        priority?: string;
    }) => API.post("/action-items", data),
    update: (id: number, data: any) => API.put(`/action-items/${id}`, data),
    delete: (id: number) => API.delete(`/action-items/${id}`),
    unlock: (id: number) => API.put(`/action-items/${id}/unlock`),
    merge: (primaryId: number, secondaryId: number) => API.post("/action-items/merge", { primaryId, secondaryId }),
    addComment: (id: number, data: { userName: string; content: string }) =>
        API.post(`/action-items/${id}/comments`, data),
    getComments: (id: number) => API.get(`/action-items/${id}/comments`),
};

// ============================================================
// DECISIONS
// ============================================================
export const decisionsApi = {
    getAll: (meetingId?: number) =>
        API.get("/decisions", { params: meetingId ? { meetingId } : {} }),
    create: (data: any) => API.post("/decisions", data),
    update: (id: number, data: any) => API.put(`/decisions/${id}`, data),
    delete: (id: number) => API.delete(`/decisions/${id}`),
    spawnFollowUp: (decisionId: number, data: { taskText: string; owner?: string; dueDate?: string; priority?: string }) =>
        API.post(`/decisions/${decisionId}/spawn-task`, data),
};

// ============================================================
// NOTIFICATIONS
// ============================================================
export const notificationsApi = {
    get: (user: string, unreadOnly = false) =>
        API.get("/notifications", { params: { user, unreadOnly: unreadOnly.toString() } }),
    markRead: (id: number) => API.put(`/notifications/${id}/read`),
    checkReminders: () => API.post("/notifications/check-reminders"),
};

// ============================================================
// AUDIT LOGS
// ============================================================
export const auditApi = {
    getAll: (params?: { meetingId?: number; entityType?: string; action?: string }) =>
        API.get("/audit-logs", { params }),
};

// ============================================================
// USERS
// ============================================================
export const usersApi = {
    getAll: () => API.get("/users"),
};

export default API;