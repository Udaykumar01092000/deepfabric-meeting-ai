import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store/store";
import { fetchInbox } from "../store/actionItemsSlice";
import { usersApi, actionItemsApi } from "../api/axios";

export default function Inbox() {
    const dispatch = useDispatch<AppDispatch>();
    const { inbox, loading } = useSelector((s: RootState) => s.actionItems);
    const [currentUser, setCurrentUser] = useState(() => {
        return localStorage.getItem("currentUser") || "Uday Kumar";
    });
    const [users, setUsers] = useState<any[]>([]);
    const [activeSection, setActiveSection] = useState<"due" | "overdue" | "unassigned" | "all" | "followups">("due");

    useEffect(() => {
        usersApi.getAll().then(res => setUsers(res.data)).catch(() => {});
    }, []);

    // Listen for global user change events
    useEffect(() => {
        const handleUserChanged = () => {
            setCurrentUser(localStorage.getItem("currentUser") || "Uday Kumar");
        };
        window.addEventListener("currentUserChanged", handleUserChanged);
        return () => window.removeEventListener("currentUserChanged", handleUserChanged);
    }, []);

    useEffect(() => {
        dispatch(fetchInbox(currentUser));
    }, [currentUser, dispatch]);

    const handleUserChange = (newUser: string) => {
        setCurrentUser(newUser);
        localStorage.setItem("currentUser", newUser);
        window.dispatchEvent(new Event("currentUserChanged"));
    };

    const handleStatusChange = async (itemId: number, newStatus: string) => {
        await actionItemsApi.update(itemId, { status: newStatus });
        dispatch(fetchInbox(currentUser));
    };

    const handleClaimItem = async (itemId: number) => {
        await actionItemsApi.update(itemId, { owner: currentUser });
        dispatch(fetchInbox(currentUser));
    };

    if (loading && !inbox) {
        return (
            <div style={{ padding: "24px 48px" }}>
                <div style={{ height: "40px", width: "300px", background: "var(--bg-tertiary)", borderRadius: "8px", animation: "pulse-glow 2s infinite" }}></div>
                <div style={{ height: "200px", background: "var(--bg-tertiary)", borderRadius: "16px", marginTop: "24px", animation: "pulse-glow 2s infinite" }}></div>
            </div>
        );
    }

    const sections: { key: typeof activeSection; label: string; count: number; color: string }[] = [
        { key: "due", label: "Due This Week", count: inbox?.summary?.dueThisWeekCount || 0, color: "#6366f1" },
        { key: "overdue", label: "Overdue", count: inbox?.summary?.overdueCount || 0, color: "#ef4444" },
        { key: "unassigned", label: "Unassigned", count: inbox?.summary?.unassignedCount || 0, color: "#f59e0b" },
        { key: "all", label: "All My Items", count: inbox?.summary?.totalOpenCount || 0, color: "#a855f7" },
        { key: "followups", label: "Follow-ups", count: inbox?.followUps?.length || 0, color: "#10b981" },
    ];

    const getItems = () => {
        if (!inbox) return [];
        switch (activeSection) {
            case "due": return inbox.dueThisWeek;
            case "overdue": return inbox.overdue;
            case "unassigned": return inbox.unassigned;
            case "all": return inbox.allMyItems;
            default: return [];
        }
    };

    const items = getItems();
    const statusColors: Record<string, string> = { open: "#ef4444", "in-progress": "#6366f1", done: "#10b981" };

    return (
        <div className="responsive-page animate-fade-in">
            {/* Header */}
            <div className="page-header" style={{ marginBottom: "32px" }}>
                <div>
                    <h1 className="page-title" style={{ fontFamily: "var(--font-heading)", fontWeight: 800, margin: 0, letterSpacing: "-1px" }}>
                        My <span className="gradient-text">Inbox</span>
                    </h1>
                    <p className="page-subtitle" style={{ color: "var(--text-secondary)", marginTop: "6px" }}>
                        Personal action items, due tasks, and follow-ups across all meetings.
                    </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>Viewing as:</span>
                    <select value={currentUser} onChange={e => handleUserChange(e.target.value)} className="form-input"
                        style={{ background: "var(--bg-secondary)", fontSize: "14px", fontWeight: 600, minWidth: "160px" }}>
                        {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                        {users.length === 0 && <option value={currentUser}>{currentUser}</option>}
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="summary-grid" style={{ gap: "16px", marginBottom: "32px" }}>
                {sections.map(s => (
                    <button key={s.key} onClick={() => setActiveSection(s.key)}
                        className="glass-panel" style={{
                            padding: "20px", cursor: "pointer", textAlign: "left",
                            border: activeSection === s.key ? `2px solid ${s.color}` : "1px solid var(--border-light)",
                            background: activeSection === s.key ? `${s.color}08` : "var(--card-bg)",
                        }}>
                        <div style={{ fontSize: "28px", fontWeight: 700, color: s.color }}>{s.count}</div>
                        <div style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: 500, marginTop: "4px" }}>{s.label}</div>
                    </button>
                ))}
            </div>

            {/* Items list */}
            {activeSection === "followups" ? (
                <div>
                    <h3 style={{ margin: "0 0 16px", fontFamily: "var(--font-heading)" }}>Follow-ups from Decisions</h3>
                    {(inbox?.followUps || []).length === 0 ? (
                        <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>No follow-up action items created from decisions yet.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {(inbox?.followUps || []).map((item: any) => (
                                <div key={item.id} className="glass-panel" style={{ padding: "20px", borderLeft: "4px solid #10b981" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>📌 {item.task_text}</p>
                                            {item.decision_statement && (
                                                <div style={{ fontSize: "13px", color: "var(--text-secondary)", background: "rgba(16,185,129,0.04)", border: "1px solid rgba(16,185,129,0.1)", borderRadius: "8px", padding: "10px 14px", margin: "10px 0 12px" }}>
                                                    <strong>Originated from Decision:</strong> "{item.decision_statement}"
                                                </div>
                                            )}
                                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                                                <span style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "20px", background: `${statusColors[item.status]}20`, color: statusColors[item.status], fontWeight: 600 }}>
                                                    {item.status}
                                                </span>
                                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>👤 {item.owner}</span>
                                                {item.due_date && (
                                                    <span style={{ fontSize: "12px", color: new Date(item.due_date) < new Date() && item.status !== "done" ? "#ef4444" : "var(--text-muted)" }}>
                                                        📅 {new Date(item.due_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                                <Link to={`/meetings/${item.meeting_id}`} style={{ fontSize: "12px", color: "var(--accent-primary)", textDecoration: "none" }}>
                                                    📋 {item.meeting_title || `Meeting #${item.meeting_id}`}
                                                </Link>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                                            {item.status === "open" && (
                                                <button onClick={() => handleStatusChange(item.id, "in-progress")}
                                                    style={{ padding: "6px 12px", borderRadius: "8px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)", color: "#a5b4fc", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>
                                                    ⚡ Start
                                                </button>
                                            )}
                                            {item.status === "in-progress" && (
                                                <button onClick={() => handleStatusChange(item.id, "done")}
                                                    style={{ padding: "6px 12px", borderRadius: "8px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", color: "#10b981", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>
                                                    ✓ Done
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div>
                    <h3 style={{ margin: "0 0 16px", fontFamily: "var(--font-heading)" }}>
                        {sections.find(s => s.key === activeSection)?.label}
                    </h3>
                    {items.length === 0 ? (
                        <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                            {activeSection === "due" && "🎉 Nothing due this week!"}
                            {activeSection === "overdue" && "✅ No overdue items!"}
                            {activeSection === "unassigned" && "👍 All items are assigned."}
                            {activeSection === "all" && "📭 No open items."}
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {items.map((item: any) => (
                                <div key={item.id} className="glass-panel" style={{ padding: "20px", borderLeft: `4px solid ${statusColors[item.status] || "#6366f1"}` }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600 }}>{item.task_text}</p>
                                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                                                <span style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "20px", background: `${statusColors[item.status]}20`, color: statusColors[item.status], fontWeight: 600 }}>
                                                    {item.status}
                                                </span>
                                                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>👤 {item.owner}</span>
                                                {item.due_date && (
                                                    <span style={{ fontSize: "12px", color: new Date(item.due_date) < new Date() && item.status !== "done" ? "#ef4444" : "var(--text-muted)" }}>
                                                        📅 {new Date(item.due_date).toLocaleDateString()}
                                                    </span>
                                                )}
                                                <Link to={`/meetings/${item.meeting_id}`} style={{ fontSize: "12px", color: "var(--accent-primary)", textDecoration: "none" }}>
                                                    📋 {item.meeting_title || `Meeting #${item.meeting_id}`}
                                                </Link>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                                            {activeSection === "unassigned" && (
                                                <button onClick={() => handleClaimItem(item.id)}
                                                    className="gradient-btn" style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "11px" }}>
                                                    🙋 Claim
                                                </button>
                                            )}
                                            {item.status === "open" && (
                                                <button onClick={() => handleStatusChange(item.id, "in-progress")}
                                                    style={{ padding: "6px 12px", borderRadius: "8px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)", color: "#a5b4fc", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>
                                                    ⚡ Start
                                                </button>
                                            )}
                                            {item.status === "in-progress" && (
                                                <button onClick={() => handleStatusChange(item.id, "done")}
                                                    style={{ padding: "6px 12px", borderRadius: "8px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", color: "#10b981", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>
                                                    ✓ Done
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
