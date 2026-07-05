import React, { useState, useEffect, useRef } from "react";
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

    // Live transcription simulation
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcribeTimer, setTranscribeTimer] = useState(0);
    const transcriptionIntervalRef = useRef<number | null>(null);
    const timerIntervalRef = useRef<number | null>(null);

    const mockDialogues = [
        "John: Hey team, welcome to the Q3 planning session. Let's discuss the deliverables and timelines.",
        "Sara: I think we should focus on the user dashboard redesign first. I'll handle the frontend components by Friday.",
        "John: Agreed. I will build the API layer and database migrations by next week.",
        "Sara: There's a risk that the third-party API integration might be delayed. We're blocked by their documentation updates.",
        "John: Good point. Let's decide to use a mock API in the meantime so development isn't held up.",
        "Sara: We've decided to go with React for the frontend and Express for the backend.",
        "John: Marcus should review the security requirements. Marcus needs to audit the authentication flow.",
        "Sara: I'm concerned about the deployment timeline. We need to watch out for potential CI/CD pipeline issues.",
        "John: Let's sync again on Monday. I'll prepare the architecture diagram by tomorrow.",

        "Emily: I'll finalize the UI mockups and share them with the team this afternoon.",
        "David: I'll start writing unit tests once the API endpoints are ready.",
        "John: Please make sure all pull requests are reviewed before merging into the main branch.",
        "Sara: We also need to optimize page load performance. The dashboard is taking nearly four seconds to render.",
        "Emily: I'll compress the images and introduce lazy loading for non-critical assets.",
        "Marcus: Security audit should include JWT validation, password policies, and rate limiting.",
        "John: Great suggestion. Let's also enable request logging for debugging purposes.",
        "David: Should we add Redis caching for frequently accessed dashboard data?",
        "John: Yes, that's a good idea. It should reduce database load significantly.",
        "Sara: I'll benchmark the application before and after implementing caching.",
        "Emily: The design team requested dark mode support. Can we include it in this sprint?",
        "John: Let's move dark mode to the next sprint since it's not a high priority.",
        "Marcus: We also need to review GDPR compliance before the production release.",
        "David: The QA team reported a bug where notifications are duplicated after refreshing the page.",
        "Sara: I'll investigate that issue after completing the dashboard widgets.",
        "John: Please update the Jira tickets as you complete each task.",
        "Emily: Client feedback is positive overall, but they want larger charts and improved accessibility.",
        "Marcus: Accessibility testing should include keyboard navigation and screen reader support.",
        "David: I'll configure GitHub Actions to automate testing and deployment.",
        "John: Let's target feature freeze by the end of next Wednesday.",
        "Sara: We still need confirmation from the product team regarding user roles and permissions.",
        "Emily: I'll schedule a meeting with the product owner tomorrow morning.",
        "Marcus: Don't forget to rotate API keys before the staging deployment.",
        "David: Database backup completed successfully last night.",
        "John: Excellent. Please verify the restore process as well.",
        "Sara: Should we notify stakeholders about the revised delivery schedule?",
        "John: Yes. I'll send an update email immediately after this meeting.",
        "Emily: I'll prepare the release notes before deployment.",
        "Marcus: Final penetration testing is scheduled for Friday afternoon.",
        "John: Perfect. If everything passes QA, we'll deploy to production next Monday."
    ];

    const simulateLiveTranscription = () => {
        if (isTranscribing) return;
        setIsTranscribing(true);
        setRawContent("");
        setTranscribeTimer(0);
        setError("");
        if (!title) setTitle("Q3 Planning Session & Architecture Review");
        if (!participants) setParticipants("John Doe, Sara Connor, Marcus Vance");

        timerIntervalRef.current = window.setInterval(() => {
            setTranscribeTimer(prev => prev + 1);
        }, 1000);

        let dialogueIndex = 0;
        let charIndex = 0;
        let currentText = "";

        transcriptionIntervalRef.current = window.setInterval(() => {
            if (dialogueIndex >= mockDialogues.length) {
                stopTranscription();
                return;
            }
            const currentLine = mockDialogues[dialogueIndex];
            if (charIndex < currentLine.length) {
                currentText += currentLine[charIndex];
                setRawContent(currentText);
                charIndex++;
            } else {
                currentText += "\n\n";
                setRawContent(currentText);
                dialogueIndex++;
                charIndex = 0;
            }
        }, 30);
    };

    const stopTranscription = () => {
        if (transcriptionIntervalRef.current) clearInterval(transcriptionIntervalRef.current);
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        setIsTranscribing(false);
    };

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

    useEffect(() => {
        return () => {
            if (transcriptionIntervalRef.current) clearInterval(transcriptionIntervalRef.current);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        };
    }, []);

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60).toString().padStart(2, "0");
        const s = (sec % 60).toString().padStart(2, "0");
        return `${m}:${s}`;
    };

    return (
        <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 24px 48px" }} className="animate-fade-in">
            <div style={{ marginBottom: "32px" }}>
                <h1 style={{ fontFamily: "var(--font-heading)", fontSize: "36px", fontWeight: 800, margin: 0, letterSpacing: "-1px" }}>
                    New Meeting <span className="gradient-text">Capture</span>
                </h1>
                <p style={{ color: "var(--text-secondary)", marginTop: "6px" }}>Paste notes, simulate voice transcription, or type raw meeting content.</p>
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
                <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: "32px", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", gridColumn: "1 / -1" }}>
                            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>Meeting Title</label>
                            <input type="text" placeholder="e.g. Q3 Planning Session" value={title} onChange={e => setTitle(e.target.value)} className="form-input" required disabled={isTranscribing} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>Date & Time</label>
                            <input type="datetime-local" value={dateTime} onChange={e => setDateTime(e.target.value)} className="form-input" disabled={isTranscribing} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>Organizer</label>
                            <input type="text" placeholder="e.g. Uday Kumar" value={organizer} onChange={e => setOrganizer(e.target.value)} className="form-input" disabled={isTranscribing} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", gridColumn: "1 / -1" }}>
                            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>
                                Participants <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "12px" }}>(comma separated)</span>
                            </label>
                            <input type="text" placeholder="e.g. John Doe, Sara Connor" value={participants} onChange={e => setParticipants(e.target.value)} className="form-input" disabled={isTranscribing} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", gridColumn: "1 / -1" }}>
                            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)" }}>
                                Attachment Link <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "12px" }}>(optional)</span>
                            </label>
                            <input type="url" placeholder="https://docs.google.com/..." value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)} className="form-input" disabled={isTranscribing} />
                        </div>
                    </div>

                    {/* Transcript input section */}
                    <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent-primary)", textTransform: "uppercase", letterSpacing: "1px" }}>Transcript</span>
                            <button type="button" onClick={isTranscribing ? stopTranscription : simulateLiveTranscription}
                                style={{
                                    display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderRadius: "20px",
                                    border: isTranscribing ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(99,102,241,0.4)",
                                    background: isTranscribing ? "rgba(239,68,68,0.1)" : "rgba(99,102,241,0.05)",
                                    color: isTranscribing ? "#f87171" : "#a5b4fc", fontSize: "12px", fontWeight: 600, cursor: "pointer"
                                }}>
                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: isTranscribing ? "#ef4444" : "#6366f1", display: "inline-block", animation: isTranscribing ? "pulse-glow 1s infinite" : "none" }}></span>
                                {isTranscribing ? `Recording... (${formatTime(transcribeTimer)})` : "🎤 Simulate Live Voice"}
                            </button>
                        </div>

                        {isTranscribing && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", height: "40px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.04)", marginBottom: "16px" }}>
                                <div className="wave-bar"></div><div className="wave-bar"></div><div className="wave-bar"></div><div className="wave-bar"></div><div className="wave-bar"></div>
                                <span style={{ marginLeft: "12px", fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>Capturing audio...</span>
                            </div>
                        )}

                        <textarea placeholder="Paste meeting transcript here or use the live simulation above..." value={rawContent}
                            onChange={e => setRawContent(e.target.value)} className="form-input"
                            style={{ width: "100%", boxSizing: "border-box", minHeight: "200px", resize: "vertical", fontSize: "14px", lineHeight: "1.6" }}
                            required disabled={isTranscribing} />
                    </div>

                    {/* Submit */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "16px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "24px" }}>
                        <button type="button" onClick={() => navigate("/")} style={{ padding: "12px 24px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", color: "var(--text-secondary)", fontWeight: 600, cursor: "pointer" }}
                            disabled={loading || isTranscribing}>Cancel</button>
                        <button type="submit" className="gradient-btn" style={{ padding: "12px 32px", borderRadius: "10px", display: "flex", alignItems: "center", gap: "8px" }}
                            disabled={loading || isTranscribing}>
                            {loading ? "⏳ Creating..." : "🤖 Create & Analyze"}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}