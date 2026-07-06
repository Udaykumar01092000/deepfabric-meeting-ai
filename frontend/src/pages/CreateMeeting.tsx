import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store/store";
import { createMeeting, fetchMeetings } from "../store/meetingsSlice";

export default function CreateMeeting() {
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();
    const [title, setTitle] = useState("");
    const [dateTime, setDateTime] = useState(new Date().toISOString().slice(0, 16));
    const [organizer, setOrganizer] = useState("Uday Kumar");
    const [participants, setParticipants] = useState("");
    const [rawContent, setRawContent] = useState("");
    const [attachmentUrl, setAttachmentUrl] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [createdId, setCreatedId] = useState<number | null>(null);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) { setError("Title is required."); return; }
        if (!rawContent.trim()) { setError("Meeting transcript is required."); return; }

        try {
            setLoading(true);
            setError("");
            const participantsList = participants.split(",").map(p => p.trim()).filter(Boolean);
            const result = await dispatch(createMeeting({
                title: title.trim(),
                dateTime,
                organizer: organizer.trim() || "Unknown",
                participants: participantsList,
                rawContent: rawContent.trim(),
                attachmentsMetadata: attachmentUrl ? [{ name: "Attached Doc", url: attachmentUrl }] : [],
            })).unwrap();

            setCreatedId(result.meetingId);
            setSuccess(true);
            dispatch(fetchMeetings());
        } catch (err) {
            setError("Failed to create meeting. Check backend connection.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: "800px", margin: "0 auto" }} className="responsive-page animate-fade-in">
            <div style={{ marginBottom: "32px" }}>
                <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "36px", fontWeight: 800, margin: 0, letterSpacing: "-1px" }}>
                    New Meeting <span className="gradient-text">Capture</span>
                </h1>
                <p style={{ color: "var(--text-secondary)", marginTop: "6px" }}>Paste notes or type raw meeting content.</p>
            </div>

            {error && (
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", padding: "16px 24px", borderRadius: "12px", color: "#f87171", marginBottom: "24px", fontWeight: 500 }}>{error}</div>
            )}

            {success ? (
                <div className="glass-panel" style={{ padding: "48px 32px", textAlign: "center", border: "1px solid rgba(16,185,129,0.25)" }}>
                    <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(16,185,129,0.1)", border: "2px solid #10b981", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 0 20px rgba(16,185,129,0.3)" }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "28px", fontWeight: 700, margin: "0 0 8px" }}>Meeting Created!</h2>
                    <p style={{ color: "var(--text-secondary)", maxWidth: "450px", margin: "0 auto 32px", fontSize: "15px" }}>
                        "{title}" {createdId && `(ID: #${createdId})`} has been saved. You can now run AI extraction to generate action items.
                    </p>
                    <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
                        {createdId && (
                            <Link to={`/meetings/${createdId}`} className="gradient-btn" style={{ padding: "12px 24px", borderRadius: "10px", textDecoration: "none", display: "flex", alignItems: "center", gap: "8px" }}>
                                📊 View & Extract
                            </Link>
                        )}
                        <button onClick={() => { setSuccess(false); setTitle(""); setParticipants(""); setRawContent(""); setCreatedId(null); setOrganizer("Uday Kumar"); setAttachmentUrl(""); }}
                            style={{ padding: "12px 24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "var(--text-primary)", fontWeight: 600, cursor: "pointer" }}>
                            Create Another
                        </button>
                        <button onClick={() => navigate("/")} style={{ padding: "12px 24px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "var(--text-secondary)", fontWeight: 600, cursor: "pointer" }}>
                            Dashboard
                        </button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="glass-panel create-form-card" style={{ padding: "32px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="form-grid" style={{ marginBottom: "24px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", gridColumn: "1 / -1" }}>
                            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>Meeting Title</label>
                            <input type="text" placeholder="e.g. Q3 Planning Session" value={title} onChange={e => setTitle(e.target.value)} className="form-input" required disabled={loading} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>Date & Time</label>
                            <input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} className="form-input" disabled={loading} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>Organizer</label>
                            <input type="text" placeholder="e.g. Uday Kumar" value={organizer} onChange={e => setOrganizer(e.target.value)} className="form-input" disabled={loading} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", gridColumn: "1 / -1" }}>
                            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>
                                Participants <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "12px" }}>(comma separated)</span>
                            </label>
                            <input type="text" placeholder="e.g. John Doe, Sara Connor" value={participants} onChange={e => setParticipants(e.target.value)} className="form-input" disabled={loading} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", gridColumn: "1 / -1" }}>
                            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>
                                Attachment Link <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "12px" }}>(optional)</span>
                            </label>
                            <input type="url" placeholder="https://docs.google.com/..." value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)} className="form-input" disabled={loading} />
                        </div>

                        <div className="transcript-field">
                            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>
                                Transcript <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "12px" }}>(required)</span>
                            </label>
                            <textarea placeholder="Paste meeting transcript or notes here..." value={rawContent}
                                onChange={e => setRawContent(e.target.value)} className="form-input transcript-textarea"
                                required disabled={loading} />
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="submit-actions" style={{ justifyContent: "flex-end", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "24px" }}>
                        <button type="button" onClick={() => navigate("/")} style={{ padding: "12px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", color: "var(--text-secondary)", fontWeight: 600, cursor: "pointer" }}
                            disabled={loading}>Cancel</button>
                        <button type="submit" className="gradient-btn" style={{ padding: "12px 32px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px" }}
                            disabled={loading}>
                            {loading ? "⏳ Creating..." : "🤖 Create & Analyze"}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}