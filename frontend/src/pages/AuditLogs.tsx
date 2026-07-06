import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store/store";
import { fetchAuditLogs } from "../store/auditSlice";

export default function AuditLogs() {
    const dispatch = useDispatch<AppDispatch>();
    const { logs, loading } = useSelector((s: RootState) => s.audit);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterType, setFilterType] = useState<"ALL" | "CREATED" | "UPDATED" | "DELETED" | "EXTRACTION">("ALL");

    useEffect(() => { dispatch(fetchAuditLogs()); }, [dispatch]);

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (log.details || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.entity_type.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;

        if (filterType === "ALL") return true;
        if (filterType === "EXTRACTION") return log.action.includes("EXTRACTION");
        return log.action === filterType;
    });

    const getActionColor = (action: string) => {
        if (action === "CREATED") return "#10b981";
        if (action === "UPDATED") return "#6366f1";
        if (action === "DELETED") return "#ef4444";
        if (action.includes("EXTRACTION")) return "#a855f7";
        if (action.includes("SKIPPED")) return "#f59e0b";
        return "var(--text-muted)";
    };

    const getActionIcon = (action: string) => {
        if (action === "CREATED") return "✅";
        if (action === "UPDATED") return "📝";
        if (action === "DELETED") return "🗑";
        if (action.includes("EXTRACTION")) return "🤖";
        if (action.includes("SKIPPED")) return "🔒";
        return "📋";
    };

    return (
        <div style={{ maxWidth: "1000px", margin: "0 auto" }} className="responsive-page animate-fade-in">
            <div className="page-header" style={{ marginBottom: "32px" }}>
                <div>
                    <h1 className="page-title" style={{ fontFamily: "var(--font-heading)", fontWeight: 800, margin: 0, letterSpacing: "-1px" }}>
                        Audit <span className="gradient-text">Trail</span>
                    </h1>
                    <p style={{ color: "var(--text-secondary)", marginTop: "6px" }}>
                        Complete change history across all meetings, extractions, and entity modifications.
                    </p>
                </div>
                <button onClick={() => dispatch(fetchAuditLogs())}
                    style={{ padding: "10px 18px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc", borderRadius: "10px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>
                    🔄 Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="filter-bar" style={{ marginBottom: "32px" }}>
                <div className="search-shell" style={{ position: "relative", flex: 1, minWidth: "260px", marginBottom: 0 }}>
                    <input type="text" placeholder="Search by action, entity type, or details..." value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)} className="form-input"
                        style={{ width: "100%", boxSizing: "border-box", paddingLeft: "40px" }} />
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5"
                        style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }}>
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                </div>
                <div className="filter-chip-group">
                    {(["ALL", "CREATED", "UPDATED", "DELETED", "EXTRACTION"] as const).map(t => (
                        <button key={t} onClick={() => setFilterType(t)}
                            style={{
                                padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 500, cursor: "pointer", border: "none",
                                background: filterType === t ? "var(--bg-secondary)" : "transparent",
                                color: filterType === t ? "var(--text-primary)" : "var(--text-secondary)",
                                boxShadow: filterType === t ? "var(--card-shadow)" : "none",
                            }}>
                            {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
                <span className="badge badge-indigo">Total: {filteredLogs.length}</span>
                <span className="badge badge-emerald">Creates: {logs.filter(l => l.action === "CREATED").length}</span>
                <span className="badge badge-purple">Updates: {logs.filter(l => l.action === "UPDATED").length}</span>
                <span className="badge badge-amber">Extractions: {logs.filter(l => l.action.includes("EXTRACTION")).length}</span>
            </div>

            {/* Timeline */}
            {loading ? (
                <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Loading audit logs...</div>
            ) : filteredLogs.length === 0 ? (
                <div className="glass-panel" style={{ padding: "60px 40px", textAlign: "center", color: "var(--text-secondary)" }}>
                    <h4 style={{ margin: "0 0 4px", color: "var(--text-primary)" }}>No audit events found</h4>
                    <p style={{ fontSize: "13px", margin: 0 }}>Create meetings and run extractions to generate audit trail entries.</p>
                </div>
            ) : (
                <div style={{ position: "relative", paddingLeft: "32px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ position: "absolute", left: "11px", top: "10px", bottom: "10px", width: "2px", background: "linear-gradient(180deg, var(--accent-primary), rgba(99,102,241,0.05))", opacity: 0.5 }}></div>
                    {filteredLogs.map(log => {
                        const color = getActionColor(log.action);
                        const icon = getActionIcon(log.action);
                        let oldVal: any = null;
                        let newVal: any = null;
                        try { if (log.old_value) oldVal = typeof log.old_value === "string" ? JSON.parse(log.old_value) : log.old_value; } catch {}
                        try { if (log.new_value) newVal = typeof log.new_value === "string" ? JSON.parse(log.new_value) : log.new_value; } catch {}

                        return (
                            <div key={log.id} style={{ position: "relative" }} className="animate-fade-in">
                                <div style={{ position: "absolute", left: "-31px", top: "4px", width: "20px", height: "20px", borderRadius: "50%", background: "var(--bg-primary)", border: `3px solid ${color}`, boxShadow: `0 0 10px ${color}40`, zIndex: 2 }}></div>
                                <div className="glass-panel" style={{ padding: "16px 20px", background: "rgba(255,255,255,0.015)", border: "1px solid rgba(255,255,255,0.04)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", minWidth: 0 }}>
                                            <span style={{ fontSize: "16px", flexShrink: 0 }}>{icon}</span>
                                            <span style={{ fontSize: "14px", fontWeight: 700, color, wordBreak: "break-word" }}>{log.action}</span>
                                            <span className="badge badge-indigo" style={{ fontSize: "10px", flexShrink: 0 }}>{log.entity_type}</span>
                                            {log.entity_id && <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>#{log.entity_id}</span>}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end", minWidth: 0 }}>
                                            <span style={{ fontSize: "12px", color: "var(--text-muted)", wordBreak: "break-word" }}>{log.changed_by}</span>
                                            <span style={{ fontSize: "11px", color: "var(--text-muted)", wordBreak: "break-word" }}>
                                                {new Date(log.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    {log.details && (
                                        <p style={{ margin: "8px 0 0", fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                                            {log.details}
                                        </p>
                                    )}

                                    {/* Show old → new diff */}
                                    {(oldVal || newVal) && (
                                        <div style={{ marginTop: "10px", display: "flex", gap: "12px", fontSize: "12px", flexWrap: "wrap" }}>
                                            {oldVal && (
                                                <div style={{ padding: "8px 12px", background: "rgba(239,68,68,0.06)", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.1)", flex: 1, minWidth: "200px" }}>
                                                    <div style={{ fontWeight: 700, color: "#ef4444", marginBottom: "4px" }}>Before</div>
                                                    {Object.entries(oldVal).map(([k, v]) => (
                                                        <div key={k} style={{ color: "var(--text-muted)" }}><span style={{ fontWeight: 600 }}>{k}:</span> {String(v)}</div>
                                                    ))}
                                                </div>
                                            )}
                                            {newVal && (
                                                <div style={{ padding: "8px 12px", background: "rgba(16,185,129,0.06)", borderRadius: "6px", border: "1px solid rgba(16,185,129,0.1)", flex: 1, minWidth: "200px" }}>
                                                    <div style={{ fontWeight: 700, color: "#10b981", marginBottom: "4px" }}>After</div>
                                                    {Object.entries(newVal).map(([k, v]) => (
                                                        <div key={k} style={{ color: "var(--text-muted)" }}><span style={{ fontWeight: 600 }}>{k}:</span> {String(v)}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {log.meeting_id && (
                                        <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--accent-primary)" }}>
                                            📋 Meeting #{log.meeting_id}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}