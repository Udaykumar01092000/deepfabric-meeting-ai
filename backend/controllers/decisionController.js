/**
 * Decision Controller — CRUD for decisions
 */
const db = require("../db");
const { computeSemanticKey } = require("../services/semanticMatcher");
const { logAudit } = require("../services/auditService");

const getDecisions = async (req, res) => {
    try {
        const { meetingId } = req.query;
        let query = `SELECT d.*, m.title as meeting_title FROM decisions d
                     LEFT JOIN meetings m ON d.meeting_id = m.id WHERE 1=1`;
        const params = [];
        if (meetingId) { query += " AND d.meeting_id = ?"; params.push(meetingId); }
        query += " ORDER BY d.created_at DESC";
        const [rows] = await db.execute(query, params);
        const parsed = rows.map(d => ({
            ...d, participants_involved: safeJsonParse(d.participants_involved, []),
        }));
        res.json(parsed);
    } catch (error) {
        console.error("getDecisions error:", error);
        res.status(500).json({ error: "Failed to fetch decisions" });
    }
};

const createDecision = async (req, res) => {
    try {
        const { meetingId, statement, participantsInvolved } = req.body;
        if (!meetingId || !statement) return res.status(400).json({ error: "meetingId and statement required" });
        const key = computeSemanticKey(statement);
        const [result] = await db.execute(
            `INSERT INTO decisions (meeting_id, semantic_key, statement, participants_involved, is_manually_edited)
             VALUES (?, ?, ?, ?, TRUE)`,
            [meetingId, key, statement, JSON.stringify(participantsInvolved || [])]
        );
        await logAudit({ meetingId, entityType: "decision", entityId: result.insertId, action: "CREATED", 
            newValue: { statement }, changedBy: "user", details: "Manually created decision" });
        res.status(201).json({ message: "Decision created", id: result.insertId });
    } catch (error) {
        console.error("createDecision error:", error);
        res.status(500).json({ error: "Failed to create decision" });
    }
};

const updateDecision = async (req, res) => {
    try {
        const { id } = req.params;
        const { statement, participantsInvolved } = req.body;
        await db.execute(
            `UPDATE decisions SET statement = COALESCE(?, statement), 
             participants_involved = COALESCE(?, participants_involved),
             is_manually_edited = TRUE WHERE id = ?`,
            [statement || null, participantsInvolved ? JSON.stringify(participantsInvolved) : null, id]
        );
        res.json({ message: "Decision updated" });
    } catch (error) {
        console.error("updateDecision error:", error);
        res.status(500).json({ error: "Failed to update decision" });
    }
};

const deleteDecision = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute("DELETE FROM decisions WHERE id = ?", [id]);
        res.json({ message: "Decision deleted" });
    } catch (error) {
        console.error("deleteDecision error:", error);
        res.status(500).json({ error: "Failed to delete decision" });
    }
};

function safeJsonParse(v, f=[]) { if(Array.isArray(v)) return v; if(!v) return f; try{return JSON.parse(v)}catch{return f} }

module.exports = { getDecisions, createDecision, updateDecision, deleteDecision };
