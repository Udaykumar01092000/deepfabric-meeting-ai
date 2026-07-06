import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store/store";
import { fetchMeetings, runExtraction, deleteMeeting, clearExtractionResult } from "../store/meetingsSlice";

export default function Meetings() {
    const dispatch = useDispatch<AppDispatch>();
    const { list: meetings, loading, error, extracting, extractionResult } = useSelector(
        (state: RootState) => state.meetings
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTranscript, setSelectedTranscript] = useState<string | null>(null);
    const [selectedTitle, setSelectedTitle] = useState<string | null>(null);

    useEffect(() => { dispatch(fetchMeetings()); }, [dispatch]);

    useEffect(() => {
        if (extractionResult) {
            // Re-fetch to update counts
            dispatch(fetchMeetings());
        }
    }, [extractionResult, dispatch]);

    const handleExtract = async (id: number) => {
        dispatch(runExtraction(id));
    };

    const handleDelete = async (id: number) => {
        if (window.confirm("Delete this meeting and all extracted data?")) {
            dispatch(deleteMeeting(id));
        }
    };

    const totalMeetings = meetings.length;
    const totalActionItems = meetings.reduce((s, m) => s + (m.action_item_count || 0), 0);
    const totalDecisions = meetings.reduce((s, m) => s + (m.decision_count || 0), 0);
    const totalExtractions = meetings.reduce((s, m) => s + (m.extraction_run_count || 0), 0);

    const filteredMeetings = meetings.filter(m =>
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (Array.isArray(m.participants) ? m.participants.join(",") : "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getInitials = (name: string) =>
        name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

    const getColor = (name: string) => {
        const colors = [
            "linear-gradient(135deg, #6366f1, #4f46e5)", "linear-gradient(135deg, #ec4899, #db2777)",
            "linear-gradient(135deg, #10b981, #059669)", "linear-gradient(135deg, #f59e0b, #d97706)",
            "linear-gradient(135deg, #8b5cf6, #7c3aed)", "linear-gradient(135deg, #06b6d4, #0891b2)"
        ];
        let h = 0;
        for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
        return colors[Math.abs(h) % colors.length];
    };

    if (loading && meetings.length === 0) {
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "24px 48px" }}>
                <div style={{ height: "40px", width: "200px", background: "var(--bg-tertiary)", borderRadius: "8px", animation: "pulse-glow 2s infinite" }}></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="glass-panel" style={{ height: "240px", padding: "24px", animation: "pulse-glow 2s infinite" }}></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="responsive-page animate-fade-in">
            {/* Extraction result toast */}
            {extractionResult && (
                <div style={{
                    position: "fixed", top: "90px", right: "24px", zIndex: 300,
                    background: extractionResult.idempotent ? "var(--bg-secondary)" : "#10b981",
                    color: extractionResult.idempotent ? "var(--text-primary)" : "white",
                    border: extractionResult.idempotent ? "1px solid var(--border-light)" : "none",
                    padding: "16px 24px", borderRadius: "12px", maxWidth: "400px",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.3)", animation: "fadeIn 0.3s ease"
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "12px" }}>
                        <div>
                            <div style={{ fontWeight: 700, marginBottom: "4px" }}>
                                {extractionResult.idempotent ? "📋 No Changes" : "✨ Extraction Complete"}
                            </div>
                            <div style={{ fontSize: "13px", opacity: 0.9 }}>
                                {extractionResult.idempotent
                                    ? "Content unchanged since last extraction."
                                    : `Run #${extractionResult.runNumber}: ${extractionResult.stats?.totals?.created || 0} created, ${extractionResult.stats?.totals?.updated || 0} updated, ${extractionResult.stats?.totals?.skipped || 0} skipped`
                                }
                            </div>
                            {extractionResult.conflicts && extractionResult.conflicts.length > 0 && (
                                <div style={{ marginTop: "6px", fontSize: "12px", color: "#fbbf24" }}>
                                    ⚠️ {extractionResult.conflicts.length} conflict(s) need review
                                </div>
                            )}
                        </div>
                        <button onClick={() => dispatch(clearExtractionResult())} style={{
                            background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "18px", opacity: 0.7
                        }}>✕</button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="dashboard-hero glass-panel">
                <div>
                    <div className="eyebrow">Meeting Intelligence</div>
                    <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "36px", fontWeight: 800, margin: 0, letterSpacing: "-1px" }}>
                        Meetings <span className="gradient-text">Dashboard</span>
                    </h1>
                    <p style={{ color: "var(--text-secondary)", marginTop: "8px", maxWidth: "640px", lineHeight: 1.6 }}>
                        Manage, analyze, and extract action items from your conversations with a calm, premium workspace.
                    </p>
                </div>
                <Link to="/create" className="dashboard-cta">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    <span>New Meeting</span>
                </Link>
            </div>

            {/* Stats */}
            <div className="stats-grid" style={{ marginBottom: "40px" }}>
                {[
                    { label: "Total Meetings", value: totalMeetings, color: "#6366f1", icon: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"] },
                    { label: "Action Items", value: totalActionItems, color: "#a855f7", icon: ["M9 11l3 3L22 4", "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"] },
                    { label: "Decisions", value: totalDecisions, color: "#10b981", icon: ["M5 12l5 5L20 7", "M3 5h18"] },
                    { label: "Extractions", value: totalExtractions, color: "#f59e0b", icon: ["M12 3v12", "M12 15l-4-4", "M12 15l4-4", "M3 21h18"] },
                ].map((stat, i) => (
                    <div key={i} className="glass-panel stat-card">
                        <div className="stat-icon-wrap" style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}30` }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={stat.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {Array.isArray(stat.icon) ? stat.icon.map((path, index) => <path key={index} d={path} />) : <path d={stat.icon} />}
                            </svg>
                        </div>
                        <div>
                            <div className="stat-value">{stat.value}</div>
                            <div className="stat-label">{stat.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", padding: "16px 24px", borderRadius: "12px", color: "#f87171", marginBottom: "32px", fontWeight: 500 }}>
                    ⚠️ {error}
                </div>
            )}

            {/* Search */}
            <div className="dashboard-search">
                <input type="text" placeholder="Search meetings by title or participants..." value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)} className="form-input dashboard-search-input" />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                    style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }}>
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
            </div>

            {/* Meeting Cards */}
            {filteredMeetings.length === 0 ? (
                <div className="glass-panel" style={{ padding: "80px 40px", textAlign: "center", color: "var(--text-secondary)" }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1" style={{ marginBottom: "16px" }}>
                        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="13" x2="15" y2="13" />
                    </svg>
                    <h3 style={{ fontSize: "20px", color: "var(--text-primary)", margin: "0 0 8px" }}>No meetings found</h3>
                    <p style={{ maxWidth: "400px", margin: "0 auto", fontSize: "14px" }}>
                        {searchQuery ? "No meetings match your search." : "Create your first meeting to begin."}
                    </p>
                </div>
            ) : (
                <div className="meeting-grid">
                    {filteredMeetings.map((m) => {
                        const parts = Array.isArray(m.participants) ? m.participants : [];
                        return (
                            <div key={m.id} className="glass-panel animate-fade-in meeting-card">
                                <div>
                                    <div className="meeting-card-header">
                                        <h3 className="meeting-card-title">{m.title}</h3>
                                        <span className="badge badge-indigo">#{m.id}</span>
                                    </div>

                                    <div className="meeting-card-date">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                                        </svg>
                                        {m.date_time ? new Date(m.date_time).toLocaleDateString(undefined, { dateStyle: "medium" }) : "Today"}
                                    </div>

                                    <div className="metric-pills">
                                        {m.action_item_count > 0 && <span className="metric-pill badge-purple">📋 {m.action_item_count} actions</span>}
                                        {m.decision_count > 0 && <span className="metric-pill badge-emerald">✅ {m.decision_count} decisions</span>}
                                        {m.risk_count > 0 && <span className="metric-pill badge-amber">⚠️ {m.risk_count} risks</span>}
                                        {m.extraction_run_count > 0 && <span className="metric-pill badge-indigo">🔄 {m.extraction_run_count} runs</span>}
                                    </div>

                                    <div style={{ marginBottom: "16px" }}>
                                        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Participants</div>
                                        <div className="participant-list">
                                            {parts.length > 0 ? parts.map((p, idx) => (
                                                <div key={idx} className="participant-pill">
                                                    <div className="avatar-bubble" style={{ background: getColor(p) }}>
                                                        {getInitials(p)}
                                                    </div>
                                                    {p}
                                                </div>
                                            )) : <span style={{ fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>No participants</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="card-actions">
                                    <button onClick={() => { setSelectedTranscript(m.raw_content); setSelectedTitle(m.title); }} className="card-action-btn secondary">
                                        📄 Transcript
                                    </button>

                                    <Link to={`/meetings/${m.id}`} className="card-action-btn primary">
                                        📊 Details
                                    </Link>

                                    <button onClick={() => handleExtract(m.id)} disabled={extracting === m.id} className={`card-action-btn accent ${extracting === m.id ? "disabled" : ""}`} style={{ opacity: extracting === m.id ? 0.8 : 1 }}>
                                        {extracting === m.id ? "⏳..." : "🤖 Extract"}
                                    </button>

                                    <button onClick={() => handleDelete(m.id)} className="card-action-btn danger">
                                        🗑
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Transcript Modal */}
            {selectedTranscript !== null && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "var(--modal-overlay)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: "24px" }}
                    onClick={() => { setSelectedTranscript(null); setSelectedTitle(null); }}>
                    <div className="glass-panel" style={{ width: "100%", maxWidth: "650px", maxHeight: "80vh", overflowY: "auto", padding: "32px", background: "var(--bg-secondary)", border: "1px solid var(--border-light)" }}
                        onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border-light)", paddingBottom: "16px" }}>
                            <div>
                                <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "var(--accent-primary)", fontWeight: 600 }}>Meeting Transcript</span>
                                <h3 style={{ fontSize: "22px", margin: "4px 0 0", fontFamily: "var(--font-heading)" }}>{selectedTitle}</h3>
                            </div>
                            <button onClick={() => { setSelectedTranscript(null); setSelectedTitle(null); }}
                                style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-light)", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", cursor: "pointer" }}>
                                ✕
                            </button>
                        </div>
                        <div style={{ padding: "20px", background: "var(--bg-tertiary)", border: "1px solid var(--border-light)", borderRadius: "12px", color: "var(--text-secondary)", fontSize: "15px", lineHeight: "1.7", whiteSpace: "pre-wrap", maxHeight: "450px", overflowY: "auto" }}>
                            {selectedTranscript}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}