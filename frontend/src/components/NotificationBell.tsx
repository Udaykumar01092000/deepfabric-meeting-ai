import { useEffect, useState, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import type { RootState, AppDispatch } from "../store/store";
import { fetchNotifications, markNotificationRead } from "../store/notificationsSlice";

interface NotificationBellProps {
    currentUser: string;
}

export default function NotificationBell({ currentUser }: NotificationBellProps) {
    const dispatch = useDispatch<AppDispatch>();
    const { items: notifications, unreadCount } = useSelector((s: RootState) => s.notifications);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch notifications on mount and periodically every 15 seconds
    useEffect(() => {
        if (!currentUser) return;
        dispatch(fetchNotifications({ user: currentUser }));

        const interval = setInterval(() => {
            dispatch(fetchNotifications({ user: currentUser }));
        }, 15000);

        return () => clearInterval(interval);
    }, [currentUser, dispatch]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleNotificationClick = async (id: number) => {
        await dispatch(markNotificationRead(id));
        setIsOpen(false);
    };

    const getIcon = (type: string) => {
        switch (type) {
            case "assigned": return "📌";
            case "reassigned": return "🔄";
            case "due_date_change": return "📆";
            case "due_reminder_24h": return "⏳";
            case "due_reminder_3d": return "📅";
            case "overdue": return "🚨";
            case "escalation": return "🔥";
            default: return "🔔";
        }
    };

    return (
        <div ref={dropdownRef} style={{ position: "relative" }}>
            {/* Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    background: "var(--bg-tertiary)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "8px",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    position: "relative",
                    transition: "all var(--transition-fast)"
                }}
                title="Notifications"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>

                {unreadCount > 0 && (
                    <span style={{
                        position: "absolute",
                        top: "-4px",
                        right: "-4px",
                        background: "#ef4444",
                        color: "white",
                        fontSize: "10px",
                        fontWeight: "bold",
                        borderRadius: "50%",
                        minWidth: "16px",
                        height: "16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "0 4px",
                        border: "2px solid var(--bg-secondary)",
                        boxShadow: "0 0 6px rgba(239, 68, 68, 0.5)"
                    }}>
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div style={{
                    position: "absolute",
                    right: 0,
                    top: "44px",
                    width: "320px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-light)",
                    borderRadius: "12px",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
                    zIndex: 200,
                    overflow: "hidden",
                    animation: "fadeIn 0.2s ease"
                }}>
                    <div style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid var(--border-light)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                    }}>
                        <span style={{ fontWeight: 700, fontSize: "14px" }}>Notifications</span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>
                            {unreadCount} unread
                        </span>
                    </div>

                    <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                        {notifications.length === 0 ? (
                            <div style={{
                                padding: "24px",
                                textAlign: "center",
                                color: "var(--text-muted)",
                                fontSize: "13px"
                            }}>
                                No notifications yet.
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n.id}
                                    style={{
                                        padding: "12px 16px",
                                        borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
                                        background: n.is_read ? "transparent" : "rgba(99, 102, 241, 0.03)",
                                        cursor: "pointer",
                                        transition: "background 0.2s ease",
                                        display: "flex",
                                        gap: "10px"
                                    }}
                                    onClick={() => handleNotificationClick(n.id)}
                                >
                                    <div style={{ fontSize: "16px", marginTop: "2px" }}>
                                        {getIcon(n.type)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{
                                            margin: 0,
                                            fontSize: "12px",
                                            lineHeight: "1.4",
                                            fontWeight: n.is_read ? 400 : 600,
                                            color: n.is_read ? "var(--text-secondary)" : "var(--text-primary)"
                                        }}>
                                            {n.message}
                                        </p>
                                        <div style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            marginTop: "6px",
                                            fontSize: "10px",
                                            color: "var(--text-muted)"
                                        }}>
                                            <span>
                                                {n.meeting_id ? (
                                                    <Link
                                                        to={`/meetings/${n.meeting_id}`}
                                                        style={{ color: "var(--accent-primary)", textDecoration: "none" }}
                                                        onClick={() => setIsOpen(false)}
                                                    >
                                                        {n.meeting_title || "Go to Meeting"}
                                                    </Link>
                                                ) : (
                                                    <Link
                                                        to="/inbox"
                                                        style={{ color: "var(--accent-primary)", textDecoration: "none" }}
                                                        onClick={() => setIsOpen(false)}
                                                    >
                                                        Inbox
                                                    </Link>
                                                )}
                                            </span>
                                            <span>
                                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div style={{
                        padding: "8px 16px",
                        background: "var(--bg-tertiary)",
                        borderTop: "1px solid var(--border-light)",
                        textAlign: "center"
                    }}>
                        <Link
                            to="/inbox"
                            style={{
                                display: "block",
                                fontSize: "12px",
                                color: "var(--accent-primary)",
                                textDecoration: "none",
                                fontWeight: 600
                            }}
                            onClick={() => setIsOpen(false)}
                        >
                            View All in Inbox
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
