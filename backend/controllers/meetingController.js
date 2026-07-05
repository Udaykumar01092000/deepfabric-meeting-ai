/**
 * Meeting Controller — Full CRUD
 */
const db = require("../db");
const { computeContentHash } = require("../services/semanticMatcher");
const { logAudit } = require("../services/auditService");

/**
 * POST /api/meetings — Create a new meeting
 */
const createMeeting = async (req, res) => {
    try {
        const { title, dateTime, organizer, participants, rawContent, attachmentsMetadata } = req.body;

        if (!title || !rawContent) {
            return res.status(400).json({ error: "Title and rawContent are required." });
        }

        const participantsJson = Array.isArray(participants) ? participants : 
            (typeof participants === "string" ? participants.split(",").map(p => p.trim()).filter(Boolean) : []);
        
        const contentHash = computeContentHash(rawContent);

        const [result] = await db.execute(
            `INSERT INTO meetings (title, date_time, organizer, participants, raw_content, attachments_metadata, content_hash)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                title,
                dateTime || new Date(),
                organizer || "Unknown",
                JSON.stringify(participantsJson),
                rawContent,
                attachmentsMetadata ? JSON.stringify(attachmentsMetadata) : null,
                contentHash,
            ]
        );

        await logAudit({
            meetingId: result.insertId,
            entityType: "meeting",
            entityId: result.insertId,
            action: "CREATED",
            newValue: { title, participants: participantsJson, organizer },
            details: `Meeting "${title}" created with ${participantsJson.length} participants`,
        });

        res.status(201).json({
            message: "Meeting created successfully",
            meetingId: result.insertId,
        });
    } catch (error) {
        console.error("createMeeting error:", error);
        res.status(500).json({ error: "Failed to create meeting" });
    }
};

/**
 * GET /api/meetings — List all meetings
 */
const getAllMeetings = async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT m.*, 
                    (SELECT COUNT(*) FROM action_items WHERE meeting_id = m.id) as action_item_count,
                    (SELECT COUNT(*) FROM decisions WHERE meeting_id = m.id) as decision_count,
                    (SELECT COUNT(*) FROM risks_blockers WHERE meeting_id = m.id) as risk_count,
                    (SELECT COUNT(*) FROM extraction_runs WHERE meeting_id = m.id) as extraction_run_count
             FROM meetings m 
             ORDER BY m.created_at DESC`
        );

        // Parse JSON fields
        const meetings = rows.map(m => ({
            ...m,
            participants: safeJsonParse(m.participants, []),
            attachments_metadata: safeJsonParse(m.attachments_metadata, []),
        }));

        res.json(meetings);
    } catch (error) {
        console.error("getAllMeetings error:", error);
        res.status(500).json({ error: "Failed to fetch meetings" });
    }
};

/**
 * GET /api/meetings/:id — Get single meeting with all extracted entities
 */
const getMeetingById = async (req, res) => {
    try {
        const { id } = req.params;

        const [meetings] = await db.execute("SELECT * FROM meetings WHERE id = ?", [id]);
        if (meetings.length === 0) {
            return res.status(404).json({ error: "Meeting not found" });
        }

        const meeting = meetings[0];
        meeting.participants = safeJsonParse(meeting.participants, []);
        meeting.attachments_metadata = safeJsonParse(meeting.attachments_metadata, []);

        // Fetch related entities
        const [actionItems] = await db.execute(
            "SELECT * FROM action_items WHERE meeting_id = ? ORDER BY created_at ASC", [id]
        );
        const [decisions] = await db.execute(
            "SELECT * FROM decisions WHERE meeting_id = ? ORDER BY created_at ASC", [id]
        );
        const [risks] = await db.execute(
            "SELECT * FROM risks_blockers WHERE meeting_id = ? ORDER BY created_at ASC", [id]
        );
        const [extractionRuns] = await db.execute(
            "SELECT * FROM extraction_runs WHERE meeting_id = ? ORDER BY created_at DESC", [id]
        );

        // Parse JSON fields in decisions
        const parsedDecisions = decisions.map(d => ({
            ...d,
            participants_involved: safeJsonParse(d.participants_involved, []),
        }));

        res.json({
            ...meeting,
            actionItems,
            decisions: parsedDecisions,
            risks,
            extractionRuns,
        });
    } catch (error) {
        console.error("getMeetingById error:", error);
        res.status(500).json({ error: "Failed to fetch meeting" });
    }
};

/**
 * PUT /api/meetings/:id — Update meeting
 */
const updateMeeting = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, dateTime, organizer, participants, rawContent, attachmentsMetadata } = req.body;

        // Fetch existing meeting for audit comparison
        const [existing] = await db.execute("SELECT * FROM meetings WHERE id = ?", [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: "Meeting not found" });
        }

        const oldMeeting = existing[0];
        const participantsJson = Array.isArray(participants) ? participants :
            (typeof participants === "string" ? participants.split(",").map(p => p.trim()).filter(Boolean) : 
             safeJsonParse(oldMeeting.participants, []));

        const newContentHash = rawContent ? computeContentHash(rawContent) : oldMeeting.content_hash;

        await db.execute(
            `UPDATE meetings SET 
                title = COALESCE(?, title),
                date_time = COALESCE(?, date_time),
                organizer = COALESCE(?, organizer),
                participants = ?,
                raw_content = COALESCE(?, raw_content),
                attachments_metadata = COALESCE(?, attachments_metadata),
                content_hash = ?
             WHERE id = ?`,
            [
                title || null,
                dateTime || null,
                organizer || null,
                JSON.stringify(participantsJson),
                rawContent || null,
                attachmentsMetadata ? JSON.stringify(attachmentsMetadata) : null,
                newContentHash,
                id,
            ]
        );

        await logAudit({
            meetingId: parseInt(id),
            entityType: "meeting",
            entityId: parseInt(id),
            action: "UPDATED",
            oldValue: { title: oldMeeting.title, content_hash: oldMeeting.content_hash },
            newValue: { title: title || oldMeeting.title, content_hash: newContentHash },
            details: `Meeting updated${rawContent && newContentHash !== oldMeeting.content_hash ? " (transcript changed)" : ""}`,
        });

        res.json({ message: "Meeting updated successfully" });
    } catch (error) {
        console.error("updateMeeting error:", error);
        res.status(500).json({ error: "Failed to update meeting" });
    }
};

/**
 * DELETE /api/meetings/:id — Delete meeting (cascades to all entities)
 */
const deleteMeeting = async (req, res) => {
    try {
        const { id } = req.params;
        const [existing] = await db.execute("SELECT title FROM meetings WHERE id = ?", [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: "Meeting not found" });
        }

        await db.execute("DELETE FROM meetings WHERE id = ?", [id]);

        // Audit log (meeting_id SET NULL due to CASCADE)
        await logAudit({
            meetingId: null,
            entityType: "meeting",
            entityId: parseInt(id),
            action: "DELETED",
            oldValue: { title: existing[0].title },
            details: `Meeting "${existing[0].title}" deleted with all associated data`,
        });

        res.json({ message: "Meeting deleted successfully" });
    } catch (error) {
        console.error("deleteMeeting error:", error);
        res.status(500).json({ error: "Failed to delete meeting" });
    }
};

function safeJsonParse(val, fallback = []) {
    if (Array.isArray(val)) return val;
    if (!val) return fallback;
    try { return JSON.parse(val); } catch { return fallback; }
}

module.exports = {
    createMeeting,
    getAllMeetings,
    getMeetingById,
    updateMeeting,
    deleteMeeting,
};