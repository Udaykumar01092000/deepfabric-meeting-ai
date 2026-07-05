import { configureStore } from "@reduxjs/toolkit";
import meetingsReducer from "./meetingsSlice";
import actionItemsReducer from "./actionItemsSlice";
import notificationsReducer from "./notificationsSlice";
import auditReducer from "./auditSlice";

export const store = configureStore({
    reducer: {
        meetings: meetingsReducer,
        actionItems: actionItemsReducer,
        notifications: notificationsReducer,
        audit: auditReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
