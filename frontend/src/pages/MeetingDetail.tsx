import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store/store";
import { fetchMeetingById, runExtraction, updateMeeting, clearExtractionResult } from "../store/meetingsSlice";
import { actionItemsApi, decisionsApi } from "../api/axios";

type Tab = "transcript" | "actions" | "decisions" | "risks" | "history";

export default function MeetingDetail() {
    const { id } = useParams<{ id: string }>();
    const meetingId = Number(id);
    const dispatch = useDispatch<AppDispatch>();
    const { currentMeeting: meeting, loading, extracting, extractionResult } = useSelector((s: RootState) => s.meetings);

    const [activeTab, setActiveTab] = useState<Tab>("actions");
    const [editingTranscript, setEditingTranscript] = useState(false);
    const [transcriptDraft, setTranscriptDraft] = useState("");

    // Inline action item editing
    const [editingItem, setEditingItem] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ taskText: "", owner: "", status: "", dueDate: "", priority: "", version: 1 });

    // Comment state
    const [commentText, setCommentText] = useState("");
    const [activeCommentItem, setActiveCommentItem] = useState<number | null>(null);
    const [comments, setComments] = useState<any[]>([]);

    // Add item form
    const [showAddForm, setShowAddForm] = useState(false);
    const [newItem, setNewItem] = useState({ taskText: "", owner: "", dueDate: "", priority: "medium" });

    // Checkbox and merge states
    const [selectedActionIds, setSelectedActionIds] = useState<number[]>([]);
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [primaryMergeId, setPrimaryMergeId] = useState<number | null>(null);

    // Spawn follow-up states
    const [spawningDecisionId, setSpawningDecisionId] = useState<number | null>(null);
    const [spawnForm, setSpawnForm] = useState({ taskText: "", owner: "", dueDate: "", priority: "medium" });

    const handleSpawnFollowUp = async (decisionId: number) => {
        if (!spawnForm.taskText.trim()) return;
        try {
            await decisionsApi.spawnFollowUp(decisionId, {
                taskText: spawnForm.taskText,
                owner: spawnForm.owner || undefined,
                dueDate: spawnForm.dueDate || undefined,
                priority: spawnForm.priority,
            });
            setSpawningDecisionId(null);
            dispatch(fetchMeetingById(meetingId));
            alert("Follow-up task created successfully!");
        } catch (err) {
            console.error(err);
            alert("Failed to spawn follow-up task.");
        }
    };

    const handleMergeItems = async () => {
        if (!primaryMergeId) return;
        const secondaryMergeId = selectedActionIds.find(id => id !== primaryMergeId);
        if (!secondaryMergeId) return;

        try {
            await actionItemsApi.merge(primaryMergeId, secondaryMergeId);
            setShowMergeModal(false);
            setPrimaryMergeId(null);
            setSelectedActionIds([]);
            dispatch(fetchMeetingById(meetingId));
            alert("Action items merged successfully!");
        } catch (err) {
            console.error(err);
            alert("Failed to merge action items.");
        }
    };

    useEffect(() => {
        if (meetingId) dispatch(fetchMeetingById(meetingId));
    }, [meetingId, dispatch]);

    useEffect(() => {
        if (extractionResult && !extractionResult.idempotent) {
            dispatch(fetchMeetingById(meetingId));
        }
    }, [extractionResult]);

    useEffect(() => {
        if (meeting?.raw_content) setTranscriptDraft(meeting.raw_content);
    }, [meeting?.raw_content]);

    const handleSaveTranscript = async () => {
        await dispatch(updateMeeting({ id: meetingId, data: { rawContent: transcriptDraft } }));
        setEditingTranscript(false);
        dispatch(fetchMeetingById(meetingId));
    };

    const handleUpdateItem = async (itemId: number) => {
        try {
            await actionItemsApi.update(itemId, {
                taskText: editForm.taskText || undefined,
                owner: editForm.owner || undefined,
                status: editForm.status || undefined,
                dueDate: editForm.dueDate || undefined,
                priority: editForm.priority || undefined,
                version: editForm.version,
            });
            setEditingItem(null);
            dispatch(fetchMeetingById(meetingId));
        } catch (e: any) {
            console.error(e);
            if (e.response && e.response.status === 409) {
                alert(e.response.data.error || "Conflict: Another user has updated this item.");
            } else {
                alert("Failed to update action item.");
            }
        }
    };

    const handleDeleteItem = async (itemId: number) => {
        if (!window.confirm("Delete this action item?")) return;
        await actionItemsApi.delete(itemId);
        dispatch(fetchMeetingById(meetingId));
    };

    const handleUnlock = async (itemId: number) => {
        await actionItemsApi.unlock(itemId);
        dispatch(fetchMeetingById(meetingId));
    };

    const handleAddItem = async () => {
        if (!newItem.taskText.trim()) return;
        await actionItemsApi.create({
            meetingId, taskText: newItem.taskText, owner: newItem.owner || "Unassigned",
            dueDate: newItem.dueDate || undefined, priority: newItem.priority,
        });
        setShowAddForm(false);
        setNewItem({ taskText: "", owner: "", dueDate: "", priority: "medium" });
        dispatch(fetchMeetingById(meetingId));
    };

    const handleAddComment = async (itemId: number) => {
        if (!commentText.trim()) return;
        await actionItemsApi.addComment(itemId, { userName: "Uday Kumar", content: commentText });
        setCommentText("");
        const res = await actionItemsApi.getComments(itemId);
        setComments(res.data);
    };

    const loadComments = async (itemId: number) => {
        if (activeCommentItem === itemId) { setActiveCommentItem(null); return; }
        const res = await actionItemsApi.getComments(itemId);
        setComments(res.data);
        setActiveCommentItem(itemId);
    };

    const handleDeleteDecision = async (decisionId: number) => {
        await decisionsApi.delete(decisionId);
        dispatch(fetchMeetingById(meetingId));
    };

    if (loading && !meeting) {
        return (
            <div style={{ padding: "24px 48px" }}>
                <div style={{ height: "40px", width: "300px", background: "var(--bg-tertiary)", borderRadius: "8px", animation: "pulse-glow 2s infinite" }}></div>
                <div style={{ height: "400px", background: "var(--bg-tertiary)", borderRadius: "16px", marginTop: "24px", animation: "pulse-glow 2s infinite" }}></div>
            </div>
        );
    }

    if (!meeting) {
        return (
            <div style={{ padding: "48px", textAlign: "center" }}>
                <div className="glass-panel" style={{ padding: "40px", maxWidth: "500px", margin: "0 auto" }}>
                    <h3>Meeting not found</h3>
                    <Link to="/" className="gradient-btn" style={{ padding: "10px 20px", borderRadius: "8px", textDecoration: "none", marginTop: "16px", display: "inline-block" }}>
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const participants = Array.isArray(meeting.participants) ? meeting.participants : [];
    const actionItems = meeting.actionItems || [];
    const decisions = meeting.decisions || [];
    const risks = meeting.risks || [];
    const runs = meeting.extractionRuns || [];

    const tabs: { key: Tab; label: string; count: number }[] = [
        { key: "actions", label: "Action Items", count: actionItems.length },
        { key: "decisions", label: "Decisions", count: decisions.length },
        { key: "risks", label: "Risks / Blockers", count: risks.length },
        { key: "transcript", label: "Transcript", count: 0 },
        { key: "history", label: "Extraction History", count: runs.length },
    ];

    const statusColors: Record<string, string> = {
        open: "#ef4444", "in-progress": "#6366f1", done: "#10b981",
    };
    const severityColors: Record<string, string> = {
        low: "#10b981", medium: "#f59e0b", high: "#ef4444", critical: "#dc2626",
    };
    const priorityColors: Record<string, string> = {
        low: "#10b981", medium: "#6366f1", high: "#ef4444",
    };

    return (
        <div className="responsive-page animate-fade-in">
            {/* Breadcrumb */}
            <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--text-secondary)", textDecoration: "none", fontSize: "14px", marginBottom: "16px" }}>
                ← Back to Meetings
            </Link>

            {/* Header */}
            <div className="page-header" style={{ alignItems: "flex-start", gap: "24px", marginBottom: "32px" }}>
                <div>
                    <span style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1.5px", color: "var(--accent-primary)", fontWeight: 700 }}>Meeting Detail</span>
                    <h1 className="page-title" style={{ fontFamily: "var(--font-heading)", fontSize: "32px", fontWeight: 800, margin: "4px 0 0", letterSpacing: "-1px" }}>{meeting.title}</h1>
                    <div style={{ display: "flex", gap: "12px", marginTop: "12px", flexWrap: "wrap", alignItems: "center" }}>
                        <span className="badge badge-indigo">ID: #{meetingId}</span>
                        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                            📅 {new Date(meeting.date_time).toLocaleDateString(undefined, { dateStyle: "long" })}
                        </span>
                        <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                            👤 {meeting.organizer}
                        </span>
                        {participants.map((p: string, i: number) => (
                            <span key={i} className="badge badge-purple" style={{ fontSize: "11px" }}>{p}</span>
                        ))}
                    </div>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                    <button onClick={() => dispatch(runExtraction(meetingId))} disabled={extracting === meetingId}
                        className="gradient-btn" style={{ padding: "12px 20px", borderRadius: "10px", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                        {extracting === meetingId ? "⏳ Extracting..." : "🤖 Run Extraction"}
                    </button>
                </div>
            </div>

            {/* Extraction result banner */}
            {extractionResult && (
                <div className="glass-panel" style={{
                    padding: "16px 24px", marginBottom: "24px",
                    borderLeft: `4px solid ${extractionResult.idempotent ? "var(--text-muted)" : "#10b981"}`,
                }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <strong>{extractionResult.idempotent ? "No changes detected" : `Extraction Run #${extractionResult.runNumber}`}</strong>
                            {!extractionResult.idempotent && extractionResult.stats && (
                                <span style={{ marginLeft: "12px", fontSize: "13px", color: "var(--text-secondary)" }}>
                                    ✅ {extractionResult.stats.totals.created} created · 📝 {extractionResult.stats.totals.updated} updated · 🔒 {extractionResult.stats.totals.skipped} skipped · ⏭ {extractionResult.stats.totals.unchanged} unchanged
                                </span>
                            )}
                        </div>
                        <button onClick={() => dispatch(clearExtractionResult())} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>✕</button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="tabs-row">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setActiveTab(t.key)}
                        style={{
                            padding: "10px 18px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                            background: activeTab === t.key ? "var(--bg-secondary)" : "transparent",
                            color: activeTab === t.key ? "var(--text-primary)" : "var(--text-secondary)",
                            boxShadow: activeTab === t.key ? "var(--card-shadow)" : "none",
                        }}>
                        {t.label} {t.count > 0 && <span style={{ marginLeft: "6px", fontSize: "11px", opacity: 0.7 }}>({t.count})</span>}
                    </button>
                ))}
            </div>

            {/* TAB: Action Items */}
            {activeTab === "actions" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <h3 style={{ margin: 0, fontFamily: "var(--font-heading)" }}>Action Items</h3>
                        <button onClick={() => setShowAddForm(!showAddForm)} className="gradient-btn" style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px" }}>
                            + Add Item
                        </button>
                    </div>

                    {showAddForm && (
                        <div className="glass-panel" style={{ padding: "20px", marginBottom: "20px", border: "1px solid var(--border-focus)" }}>
                            <div className="add-form-grid">
                                <input placeholder="Task description..." value={newItem.taskText} onChange={e => setNewItem({ ...newItem, taskText: e.target.value })} className="form-input" style={{ gridColumn: "1 / -1" }} />
                                <select value={newItem.owner} onChange={e => setNewItem({ ...newItem, owner: e.target.value })} className="form-input" style={{ background: "var(--bg-secondary)" }}>
                                    <option value="">Select Owner</option>
                                    {participants.map((p: string) => <option key={p} value={p}>{p}</option>)}
                                    <option value="Unassigned">Unassigned</option>
                                </select>
                                <input type="date" value={newItem.dueDate} onChange={e => setNewItem({ ...newItem, dueDate: e.target.value })} className="form-input" />
                            </div>
                            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                                <button onClick={handleAddItem} className="gradient-btn" style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px" }}>Create</button>
                                <button onClick={() => setShowAddForm(false)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}>Cancel</button>
                            </div>
                        </div>
                    )}

                    {selectedActionIds.length > 0 && (
                        <div className="glass-panel" style={{ padding: "16px 20px", marginBottom: "16px", border: "1px solid var(--accent-primary)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "14px", fontWeight: 600 }}>
                                🔗 {selectedActionIds.length} item(s) selected for merging
                            </span>
                            <div style={{ display: "flex", gap: "10px" }}>
                                {selectedActionIds.length === 2 && (
                                    <button onClick={() => { setShowMergeModal(true); setPrimaryMergeId(selectedActionIds[0]); }} className="gradient-btn" style={{ padding: "6px 14px", borderRadius: "8px", fontSize: "13px" }}>
                                        Merge Selected
                                    </button>
                                )}
                                <button onClick={() => setSelectedActionIds([])} style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: "13px" }}>
                                    Clear Selection
                                </button>
                            </div>
                        </div>
                    )}

                    {actionItems.length === 0 ? (
                        <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                            No action items yet. Run extraction or add manually.
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {actionItems.map((item: any) => (
                                <div key={item.id} className="glass-panel" style={{ padding: "20px", borderLeft: `4px solid ${statusColors[item.status] || "#6366f1"}` }}>
                                    {editingItem === item.id ? (
                                        /* Editing mode */
                                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                            <input value={editForm.taskText} onChange={e => setEditForm({ ...editForm, taskText: e.target.value })} className="form-input" />
                                            <div className="edit-grid" style={{ gap: "10px" }}>
                                                <select value={editForm.owner} onChange={e => setEditForm({ ...editForm, owner: e.target.value })} className="form-input" style={{ background: "var(--bg-secondary)" }}>
                                                    {participants.map((p: string) => <option key={p} value={p}>{p}</option>)}
                                                    <option value="Unassigned">Unassigned</option>
                                                </select>
                                                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="form-input" style={{ background: "var(--bg-secondary)" }}>
                                                    <option value="open">Open</option>
                                                    <option value="in-progress">In Progress</option>
                                                    <option value="done">Done</option>
                                                </select>
                                                <input type="date" value={editForm.dueDate} onChange={e => setEditForm({ ...editForm, dueDate: e.target.value })} className="form-input" />
                                                <select value={editForm.priority} onChange={e => setEditForm({ ...editForm, priority: e.target.value })} className="form-input" style={{ background: "var(--bg-secondary)" }}>
                                                    <option value="low">Low</option>
                                                    <option value="medium">Medium</option>
                                                    <option value="high">High</option>
                                                </select>
                                            </div>
                                            <div style={{ display: "flex", gap: "8px" }}>
                                                <button onClick={() => handleUpdateItem(item.id)} className="gradient-btn" style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "12px" }}>Save</button>
                                                <button onClick={() => setEditingItem(null)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: "12px" }}>Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Display mode */
                                        <>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                                                <div style={{ display: "flex", gap: "12px", flex: 1, alignItems: "flex-start" }}>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedActionIds.includes(item.id)} 
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedActionIds([...selectedActionIds, item.id]);
                                                            } else {
                                                                setSelectedActionIds(selectedActionIds.filter(id => id !== item.id));
                                                            }
                                                        }}
                                                        style={{ marginTop: "6px", width: "16px", height: "16px", cursor: "pointer" }}
                                                    />
                                                    <div style={{ flex: 1 }}>
                                                        <p style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600, textDecoration: item.status === "done" ? "line-through" : "none", opacity: item.status === "done" ? 0.6 : 1 }}>
                                                            {item.task_text}
                                                        </p>
                                                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                                                            <span style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "20px", background: `${statusColors[item.status]}20`, color: statusColors[item.status], fontWeight: 600, border: `1px solid ${statusColors[item.status]}30` }}>
                                                                {item.status}
                                                            </span>
                                                            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>👤 {item.owner}</span>
                                                            {item.due_date && (
                                                                <span style={{ fontSize: "12px", color: new Date(item.due_date) < new Date() && item.status !== "done" ? "#ef4444" : "var(--text-muted)" }}>
                                                                    📅 {new Date(item.due_date).toLocaleDateString()}
                                                                    {new Date(item.due_date) < new Date() && item.status !== "done" && " (OVERDUE)"}
                                                                </span>
                                                            )}
                                                            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: `${priorityColors[item.priority]}15`, color: priorityColors[item.priority], fontWeight: 600 }}>
                                                                {item.priority}
                                                            </span>
                                                            {item.confidence < 1 && (
                                                                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                                                    🎯 {Math.round(item.confidence * 100)}% confidence
                                                                </span>
                                                            )}
                                                            {item.is_manually_edited && (
                                                                <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: "rgba(245,158,11,0.1)", color: "#f59e0b", fontWeight: 600 }}>
                                                                    🔒 Manually Edited
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                                                    <button onClick={() => { setEditingItem(item.id); setEditForm({ taskText: item.task_text, owner: item.owner, status: item.status, dueDate: item.due_date?.split("T")[0] || "", priority: item.priority, version: item.version }); }}
                                                        style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: "8px", color: "#a5b4fc", cursor: "pointer", padding: "6px 10px", fontSize: "11px", fontWeight: 600 }}>
                                                        ✏️ Edit
                                                    </button>
                                                    {item.is_manually_edited && (
                                                        <button onClick={() => handleUnlock(item.id)}
                                                            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "8px", color: "#f59e0b", cursor: "pointer", padding: "6px 10px", fontSize: "11px", fontWeight: 600 }}>
                                                            🔓 Unlock
                                                        </button>
                                                    )}
                                                    <button onClick={() => loadComments(item.id)}
                                                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", color: "var(--text-secondary)", cursor: "pointer", padding: "6px 10px", fontSize: "11px" }}>
                                                        💬
                                                    </button>
                                                    <button onClick={() => handleDeleteItem(item.id)}
                                                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "8px", color: "#ef4444", cursor: "pointer", padding: "6px 10px", fontSize: "11px" }}>
                                                        🗑
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Provenance */}
                                            {item.source_snippet && (
                                                <div style={{ marginTop: "12px", padding: "10px 14px", background: "var(--bg-tertiary)", borderRadius: "8px", fontSize: "12px", color: "var(--text-muted)", borderLeft: "3px solid var(--accent-primary)" }}>
                                                    <span style={{ fontWeight: 600, color: "var(--accent-primary)" }}>Source: </span>
                                                    "{item.source_snippet}"
                                                </div>
                                            )}

                                            {/* Comments */}
                                            {activeCommentItem === item.id && (
                                                <div style={{ marginTop: "12px", padding: "16px", background: "var(--bg-tertiary)", borderRadius: "10px" }}>
                                                    <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "10px", color: "var(--text-secondary)" }}>COMMENTS</div>
                                                    {comments.length === 0 && <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "0 0 12px" }}>No comments yet.</p>}
                                                    {comments.map((c: any) => (
                                                        <div key={c.id} style={{ marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                                            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-primary)" }}>{c.user_name}</div>
                                                            <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>{c.content}</div>
                                                            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{new Date(c.created_at).toLocaleString()}</div>
                                                        </div>
                                                    ))}
                                                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                                                        <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a comment..." className="form-input" style={{ flex: 1, fontSize: "13px" }} />
                                                        <button onClick={() => handleAddComment(item.id)} className="gradient-btn" style={{ padding: "8px 14px", borderRadius: "8px", fontSize: "12px" }}>Send</button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Decisions */}
            {activeTab === "decisions" && (
                <div>
                    <h3 style={{ margin: "0 0 16px", fontFamily: "var(--font-heading)" }}>Decisions</h3>
                    {decisions.length === 0 ? (
                        <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>No decisions extracted yet.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {decisions.map((d: any) => (
                                <div key={d.id} className="glass-panel" style={{ padding: "20px", borderLeft: "4px solid #10b981" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                        <div>
                                            <p style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600 }}>✅ {d.statement}</p>
                                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                                {(d.participants_involved || []).map((p: string, i: number) => (
                                                    <span key={i} className="badge badge-emerald" style={{ fontSize: "11px" }}>{p}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <button onClick={() => handleDeleteDecision(d.id)}
                                            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "8px", color: "#ef4444", cursor: "pointer", padding: "6px 10px", fontSize: "11px" }}>🗑</button>
                                    </div>
                                    {d.source_snippet && (
                                        <div style={{ marginTop: "10px", padding: "8px 12px", background: "var(--bg-tertiary)", borderRadius: "6px", fontSize: "12px", color: "var(--text-muted)", borderLeft: "3px solid #10b981" }}>
                                            "{d.source_snippet}"
                                        </div>
                                    )}

                                    {spawningDecisionId === d.id ? (
                                        <div style={{ marginTop: "16px", padding: "16px", background: "var(--bg-tertiary)", borderRadius: "8px", border: "1px solid var(--border-light)" }}>
                                            <h4 style={{ margin: "0 0 12px", fontSize: "14px", fontFamily: "var(--font-heading)" }}>Spawn Follow-up Task</h4>
                                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                                <input placeholder="Task text..." value={spawnForm.taskText} onChange={e => setSpawnForm({ ...spawnForm, taskText: e.target.value })} className="form-input" required />
                                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                                                    <select value={spawnForm.owner} onChange={e => setSpawnForm({ ...spawnForm, owner: e.target.value })} className="form-input" style={{ background: "var(--bg-secondary)" }}>
                                                        <option value="">Select Owner</option>
                                                        {participants.map((p: string) => <option key={p} value={p}>{p}</option>)}
                                                        <option value="Unassigned">Unassigned</option>
                                                    </select>
                                                    <input type="date" value={spawnForm.dueDate} onChange={e => setSpawnForm({ ...spawnForm, dueDate: e.target.value })} className="form-input" />
                                                    <select value={spawnForm.priority} onChange={e => setSpawnForm({ ...spawnForm, priority: e.target.value })} className="form-input" style={{ background: "var(--bg-secondary)" }}>
                                                        <option value="low">Low</option>
                                                        <option value="medium">Medium</option>
                                                        <option value="high">High</option>
                                                    </select>
                                                </div>
                                                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                                                    <button onClick={() => handleSpawnFollowUp(d.id)} className="gradient-btn" style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px" }}>Create Task</button>
                                                    <button onClick={() => setSpawningDecisionId(null)} style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: "12px" }}>Cancel</button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={() => { setSpawningDecisionId(d.id); setSpawnForm({ taskText: `Follow-up: ${d.statement}`, owner: "", dueDate: "", priority: "medium" }); }}
                                            style={{ marginTop: "12px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: "8px", color: "#a5b4fc", cursor: "pointer", padding: "6px 12px", fontSize: "11px", fontWeight: 600 }}>
                                            ⚡ Create Follow-up Task
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Risks */}
            {activeTab === "risks" && (
                <div>
                    <h3 style={{ margin: "0 0 16px", fontFamily: "var(--font-heading)" }}>Risks & Blockers</h3>
                    {risks.length === 0 ? (
                        <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>No risks or blockers detected.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {risks.map((r: any) => (
                                <div key={r.id} className="glass-panel" style={{ padding: "20px", borderLeft: `4px solid ${severityColors[r.severity]}` }}>
                                    <p style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600 }}>{r.description}</p>
                                    <span style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "20px", background: `${severityColors[r.severity]}20`, color: severityColors[r.severity], fontWeight: 600, textTransform: "uppercase" }}>
                                        {r.severity}
                                    </span>
                                    {r.source_snippet && (
                                        <div style={{ marginTop: "10px", padding: "8px 12px", background: "var(--bg-tertiary)", borderRadius: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                                            "{r.source_snippet}"
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Transcript */}
            {activeTab === "transcript" && (
                <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                        <h3 style={{ margin: 0, fontFamily: "var(--font-heading)" }}>Meeting Transcript</h3>
                        {editingTranscript ? (
                            <div style={{ display: "flex", gap: "8px" }}>
                                <button onClick={handleSaveTranscript} className="gradient-btn" style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "13px" }}>💾 Save & Update Hash</button>
                                <button onClick={() => { setEditingTranscript(false); setTranscriptDraft(meeting.raw_content); }}
                                    style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: "13px" }}>Cancel</button>
                            </div>
                        ) : (
                            <button onClick={() => setEditingTranscript(true)}
                                style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(99,102,241,0.2)", background: "rgba(99,102,241,0.08)", color: "#a5b4fc", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
                                ✏️ Edit Transcript
                            </button>
                        )}
                    </div>
                    <div className="glass-panel" style={{ padding: "24px" }}>
                        {editingTranscript ? (
                            <textarea value={transcriptDraft} onChange={e => setTranscriptDraft(e.target.value)} className="form-input"
                                style={{ width: "100%", boxSizing: "border-box", minHeight: "400px", resize: "vertical", fontSize: "14px", lineHeight: "1.7" }} />
                        ) : (
                            <div style={{ whiteSpace: "pre-wrap", fontSize: "14px", lineHeight: "1.7", color: "var(--text-secondary)" }}>
                                {meeting.raw_content}
                            </div>
                        )}
                    </div>
                    {meeting.content_hash && (
                        <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                            Content Hash: <code style={{ background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: "4px" }}>{meeting.content_hash.substring(0, 16)}...</code>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: Extraction History */}
            {activeTab === "history" && (
                <div>
                    <h3 style={{ margin: "0 0 16px", fontFamily: "var(--font-heading)" }}>Extraction History</h3>
                    {runs.length === 0 ? (
                        <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>No extraction runs yet.</div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {runs.map((r: any) => (
                                <div key={r.id} className="glass-panel" style={{ padding: "20px" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <div>
                                            <strong style={{ fontSize: "15px" }}>Run #{r.run_number}</strong>
                                            <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
                                                {new Date(r.created_at).toLocaleString()}
                                            </span>
                                            <span className="badge badge-indigo" style={{ marginLeft: "8px", fontSize: "10px" }}>{r.engine_used}</span>
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: "16px", marginTop: "10px", fontSize: "13px", color: "var(--text-secondary)" }}>
                                        <span>✅ {r.items_created} created</span>
                                        <span>📝 {r.items_updated} updated</span>
                                        <span>🔒 {r.items_skipped} skipped</span>
                                        <span>⏭ {r.items_unchanged} unchanged</span>
                                    </div>
                                    <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text-muted)" }}>
                                        Hash: <code style={{ background: "var(--bg-tertiary)", padding: "2px 6px", borderRadius: "4px" }}>{r.content_hash?.substring(0, 16)}...</code>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {/* Merge modal */}
            {showMergeModal && selectedActionIds.length === 2 && (
                <div style={{
                    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: "rgba(0,0,0,0.7)", zIndex: 1000,
                    display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
                }} className="animate-fade-in">
                    <div className="glass-panel" style={{ padding: "32px", maxWidth: "600px", width: "100%", border: "1px solid var(--border-light)", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
                        <h3 style={{ margin: "0 0 16px", fontFamily: "var(--font-heading)" }}>Merge Action Items</h3>
                        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "20px" }}>
                            Select the **Primary Action Item**. The secondary item's description will be appended to the primary, all comment threads will be combined, and the secondary item will be deleted.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
                            {selectedActionIds.map(id => {
                                const item = actionItems.find((a: any) => a.id === id);
                                if (!item) return null;
                                return (
                                    <label key={id} style={{
                                        display: "flex", gap: "12px", padding: "16px", borderRadius: "10px",
                                        background: primaryMergeId === id ? "rgba(99,102,241,0.08)" : "var(--bg-tertiary)",
                                        border: primaryMergeId === id ? "1px solid var(--accent-primary)" : "1px solid var(--border-light)",
                                        cursor: "pointer", alignItems: "center"
                                    }}>
                                        <input 
                                            type="radio" 
                                            name="primaryItem" 
                                            checked={primaryMergeId === id} 
                                            onChange={() => setPrimaryMergeId(id)}
                                            style={{ width: "18px", height: "18px", cursor: "pointer" }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: "14px" }}>{item.task_text}</div>
                                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                                                Owner: {item.owner} · Status: {item.status}
                                            </div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                            <button onClick={() => { setShowMergeModal(false); setPrimaryMergeId(null); }}
                                style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontWeight: 600 }}>
                                Cancel
                            </button>
                            <button 
                                onClick={handleMergeItems} 
                                disabled={!primaryMergeId}
                                className="gradient-btn" 
                                style={{ padding: "10px 24px", borderRadius: "8px", fontWeight: 600, opacity: !primaryMergeId ? 0.6 : 1 }}
                            >
                                Confirm Merge
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
