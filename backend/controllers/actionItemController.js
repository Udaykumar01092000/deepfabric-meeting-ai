/**
 * Action Item Controller — Full CRUD + Inbox + Comments
 */
const db = require("../db");
const { computeSemanticKey } = require("../services/semanticMatcher");
const { logAudit } = require("../services/auditService");
const { notifyAssignment } = require("../services/notificationService");

/**
 * GET /api/action-items — List action items with optional filters
 * Query params: meetingId, owner, status, dueBefore, dueAfter
 */
const getActionItems = async (req, res) => {
    try {
        const { meetingId, owner, status, dueBefore, dueAfter } = req.query;
        let query = `SELECT ai.*, m.title as meeting_title 
                     FROM action_items ai 
                     LEFT JOIN meetings m ON ai.meeting_id = m.id
                     WHERE 1=1`;
        const params = [];

        if (meetingId) { query += " AND ai.meeting_id = ?"; params.push(meetingId); }
        if (owner) { query += " AND ai.owner = ?"; params.push(owner); }
        if (status) { query += " AND ai.status = ?"; params.push(status); }
        if (dueBefore) { query += " AND ai.due_date <= ?"; params.push(dueBefore); }
        if (dueAfter) { query += " AND ai.due_date >= ?"; params.push(dueAfter); }

        query += " ORDER BY ai.created_at DESC";
        const [rows] = await db.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error("getActionItems error:", error);
        res.status(500).json({ error: "Failed to fetch action items" });
    }
};

/**
 * GET /api/action-items/inbox — Personal inbox view
 * Query params: owner (required)
 * Returns: myDueThisWeek, unassigned, followUpsFromDecisions, overdue
 */
const getInbox = async (req, res) => {
    try {
        const owner = req.query.owner;
        if (!owner) {
            return res.status(400).json({ error: "owner query parameter is required" });
        }

        // My actions due this week
        const [dueThisWeek] = await db.execute(
            `SELECT ai.*, m.title as meeting_title FROM action_items ai 
             LEFT JOIN meetings m ON ai.meeting_id = m.id
             WHERE ai.owner = ? AND ai.status != 'done'
               AND ai.due_date BETWEEN CURDATE() AND CURDATE() + INTERVAL 7 DAY
             ORDER BY ai.due_date ASC`,
            [owner]
        );

        // Unassigned actions needing owner
        const [unassigned] = await db.execute(
            `SELECT ai.*, m.title as meeting_title FROM action_items ai 
             LEFT JOIN meetings m ON ai.meeting_id = m.id
             WHERE (ai.owner = 'Unassigned' OR ai.owner = '' OR ai.owner IS NULL)
               AND ai.status != 'done'
             ORDER BY ai.created_at DESC`
        );

        // Follow-ups from decisions (tasks linked to decisions assigned to this user)
        const [followUps] = await db.execute(
            `SELECT ai.*, d.statement as decision_statement, m.title as meeting_title FROM action_items ai 
             INNER JOIN decisions d ON ai.decision_id = d.id
             LEFT JOIN meetings m ON ai.meeting_id = m.id
             WHERE ai.owner = ? AND ai.status != 'done'
             ORDER BY ai.due_date ASC, ai.created_at DESC`,
            [owner]
        );

        // Overdue items
        const [overdue] = await db.execute(
            `SELECT ai.*, m.title as meeting_title FROM action_items ai 
             LEFT JOIN meetings m ON ai.meeting_id = m.id
             WHERE ai.owner = ? AND ai.status != 'done'
               AND ai.due_date < CURDATE()
             ORDER BY ai.due_date ASC`,
            [owner]
        );

        // All my items
        const [allMyItems] = await db.execute(
            `SELECT ai.*, m.title as meeting_title FROM action_items ai 
             LEFT JOIN meetings m ON ai.meeting_id = m.id
             WHERE ai.owner = ? AND ai.status != 'done'
             ORDER BY ai.due_date ASC`,
            [owner]
        );

        // No parsing needed for action items
        const parsedFollowUps = followUps;

        res.json({
            dueThisWeek,
            unassigned,
            followUps: parsedFollowUps,
            overdue,
            allMyItems,
            summary: {
                dueThisWeekCount: dueThisWeek.length,
                unassignedCount: unassigned.length,
                overdueCount: overdue.length,
                totalOpenCount: allMyItems.length,
            },
        });
    } catch (error) {
        console.error("getInbox error:", error);
        res.status(500).json({ error: "Failed to load inbox" });
    }
};

/**
 * GET /api/action-items/:id — Get single action item with comments
 */
const getActionItemById = async (req, res) => {
    try {
        const { id } = req.params;
        const [items] = await db.execute(
            `SELECT ai.*, m.title as meeting_title FROM action_items ai 
             LEFT JOIN meetings m ON ai.meeting_id = m.id
             WHERE ai.id = ?`,
            [id]
        );
        if (items.length === 0) return res.status(404).json({ error: "Action item not found" });

        const [comments] = await db.execute(
            "SELECT * FROM comments WHERE action_item_id = ? ORDER BY created_at ASC",
            [id]
        );

        res.json({ ...items[0], comments });
    } catch (error) {
        console.error("getActionItemById error:", error);
        res.status(500).json({ error: "Failed to fetch action item" });
    }
};

/**
 * POST /api/action-items — Create action item manually
 */
const createActionItem = async (req, res) => {
    try {
        const { meetingId, taskText, owner, dueDate, priority, status } = req.body;
        if (!meetingId || !taskText) {
            return res.status(400).json({ error: "meetingId and taskText are required" });
        }

        const semanticKey = computeSemanticKey(taskText);

        const [result] = await db.execute(
            `INSERT INTO action_items 
                (meeting_id, semantic_key, task_text, owner, status, due_date, priority, confidence, is_manually_edited)
             VALUES (?, ?, ?, ?, ?, ?, ?, 1.00, TRUE)`,
            [meetingId, semanticKey, taskText, owner || "Unassigned", status || "open", dueDate || null, priority || "medium"]
        );

        await logAudit({
            meetingId, entityType: "action_item", entityId: result.insertId,
            action: "CREATED", newValue: { taskText, owner, dueDate },
            changedBy: owner || "user", details: "Manually created action item",
        });

        if (owner && owner !== "Unassigned") {
            await notifyAssignment({ id: result.insertId, owner, taskText }, meetingId, null);
        }

        res.status(201).json({ message: "Action item created", id: result.insertId });
    } catch (error) {
        console.error("createActionItem error:", error);
        res.status(500).json({ error: "Failed to create action item" });
    }
};

/**
 * PUT /api/action-items/:id — Update action item (marks as manually edited)
 */
const updateActionItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { taskText, owner, status, dueDate, priority, version } = req.body;

        // Fetch existing for audit diff and version matching
        const [existing] = await db.execute("SELECT * FROM action_items WHERE id = ?", [id]);
        if (existing.length === 0) return res.status(404).json({ error: "Action item not found" });

        const old = existing[0];

        // Optimistic locking: if version is provided, ensure it matches the database version
        if (version !== undefined && parseInt(version) !== old.version) {
            return res.status(409).json({
                error: "Conflict detected: This action item has been modified by another user. Please refresh and try again.",
                currentVersion: old.version
            });
        }

        const newOwner = owner !== undefined ? owner : old.owner;
        const newSemanticKey = taskText ? computeSemanticKey(taskText) : old.semantic_key;

        await db.execute(
            `UPDATE action_items SET 
                task_text = COALESCE(?, task_text),
                semantic_key = ?,
                owner = COALESCE(?, owner),
                status = COALESCE(?, status),
                due_date = COALESCE(?, due_date),
                priority = COALESCE(?, priority),
                is_manually_edited = TRUE,
                manually_edited_at = NOW(),
                version = version + 1
             WHERE id = ?`,
            [taskText || null, newSemanticKey, owner || null, status || null, dueDate || null, priority || null, id]
        );

        await logAudit({
            meetingId: old.meeting_id, entityType: "action_item", entityId: parseInt(id),
            action: "UPDATED",
            oldValue: { task_text: old.task_text, owner: old.owner, status: old.status, due_date: old.due_date },
            newValue: { task_text: taskText || old.task_text, owner: newOwner, status: status || old.status, due_date: dueDate || old.due_date },
            changedBy: "user", details: "Manual edit by user",
        });

        // Notify if owner changed
        if (owner && owner !== old.owner) {
            await notifyAssignment({ id: parseInt(id), owner, task_text: taskText || old.task_text }, old.meeting_id, null, true);
        }

        res.json({ message: "Action item updated (marked as manually edited)" });
    } catch (error) {
        console.error("updateActionItem error:", error);
        res.status(500).json({ error: "Failed to update action item" });
    }
};

/**
 * DELETE /api/action-items/:id
 */
const deleteActionItem = async (req, res) => {
    try {
        const { id } = req.params;
        const [existing] = await db.execute("SELECT * FROM action_items WHERE id = ?", [id]);
        if (existing.length === 0) return res.status(404).json({ error: "Action item not found" });

        await db.execute("DELETE FROM action_items WHERE id = ?", [id]);

        await logAudit({
            meetingId: existing[0].meeting_id, entityType: "action_item", entityId: parseInt(id),
            action: "DELETED", oldValue: { task_text: existing[0].task_text, owner: existing[0].owner },
            changedBy: "user", details: `Deleted action item: "${existing[0].task_text}"`,
        });

        res.json({ message: "Action item deleted" });
    } catch (error) {
        console.error("deleteActionItem error:", error);
        res.status(500).json({ error: "Failed to delete action item" });
    }
};

/**
 * PUT /api/action-items/:id/unlock — Unlock a manually edited item for re-extraction
 */
const unlockActionItem = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute(
            "UPDATE action_items SET is_manually_edited = FALSE, manually_edited_at = NULL WHERE id = ?",
            [id]
        );
        res.json({ message: "Action item unlocked for re-extraction" });
    } catch (error) {
        console.error("unlockActionItem error:", error);
        res.status(500).json({ error: "Failed to unlock" });
    }
};

/**
 * POST /api/action-items/:id/comments — Add a comment
 */
const addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { userName, content } = req.body;

        if (!content) return res.status(400).json({ error: "Content is required" });

        const [result] = await db.execute(
            "INSERT INTO comments (action_item_id, user_name, content) VALUES (?, ?, ?)",
            [id, userName || "Anonymous", content]
        );

        res.status(201).json({ message: "Comment added", id: result.insertId });
    } catch (error) {
        console.error("addComment error:", error);
        res.status(500).json({ error: "Failed to add comment" });
    }
};

/**
 * GET /api/action-items/:id/comments — Get comments
 */
const getComments = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute(
            "SELECT * FROM comments WHERE action_item_id = ? ORDER BY created_at ASC",
            [id]
        );
        res.json(rows);
    } catch (error) {
        console.error("getComments error:", error);
        res.status(500).json({ error: "Failed to fetch comments" });
    }
};

const mergeActionItems = async (req, res) => {
    try {
        const { primaryId, secondaryId } = req.body;
        if (!primaryId || !secondaryId) {
            return res.status(400).json({ error: "primaryId and secondaryId are required" });
        }

        const [primaryRows] = await db.execute("SELECT * FROM action_items WHERE id = ?", [primaryId]);
        const [secondaryRows] = await db.execute("SELECT * FROM action_items WHERE id = ?", [secondaryId]);

        if (primaryRows.length === 0 || secondaryRows.length === 0) {
            return res.status(404).json({ error: "One or both action items not found" });
        }

        const primary = primaryRows[0];
        const secondary = secondaryRows[0];

        const mergedText = `${primary.task_text} (Merged with: ${secondary.task_text})`;
        const newSemanticKey = computeSemanticKey(mergedText);

        await db.execute(
            `UPDATE action_items SET 
                task_text = ?, 
                semantic_key = ?, 
                is_manually_edited = TRUE, 
                manually_edited_at = NOW(), 
                version = version + 1 
             WHERE id = ?`,
            [mergedText, newSemanticKey, primaryId]
        );

        await db.execute(
            "UPDATE comments SET action_item_id = ? WHERE action_item_id = ?",
            [primaryId, secondaryId]
        );

        await logAudit({
            meetingId: primary.meeting_id,
            entityType: "action_item",
            entityId: parseInt(primaryId),
            action: "UPDATED",
            oldValue: { task_text: primary.task_text, version: primary.version },
            newValue: { task_text: mergedText, version: primary.version + 1 },
            changedBy: "user",
            details: `Action item ID ${secondaryId} was merged into this item.`,
        });

        await logAudit({
            meetingId: secondary.meeting_id,
            entityType: "action_item",
            entityId: parseInt(secondaryId),
            action: "DELETED",
            oldValue: { task_text: secondary.task_text },
            changedBy: "user",
            details: `Deleted as part of merge into action item ID ${primaryId}.`,
        });

        await db.execute("DELETE FROM action_items WHERE id = ?", [secondaryId]);

        res.json({ message: "Action items merged successfully", primaryId });
    } catch (error) {
        console.error("mergeActionItems error:", error);
        res.status(500).json({ error: "Failed to merge action items" });
    }
};

const spawnFollowUpFromDecision = async (req, res) => {
    try {
        const decisionId = parseInt(req.params.id);
        const { taskText, owner, dueDate, priority } = req.body;

        if (!taskText) {
            return res.status(400).json({ error: "taskText is required" });
        }

        const [decisions] = await db.execute("SELECT * FROM decisions WHERE id = ?", [decisionId]);
        if (decisions.length === 0) {
            return res.status(404).json({ error: "Decision not found" });
        }
        const decision = decisions[0];

        const semanticKey = computeSemanticKey(taskText);

        const [result] = await db.execute(
            `INSERT INTO action_items 
                (meeting_id, decision_id, semantic_key, task_text, owner, status, due_date, priority, confidence, is_manually_edited)
             VALUES (?, ?, ?, ?, ?, 'open', ?, ?, 1.00, TRUE)`,
            [decision.meeting_id, decisionId, semanticKey, taskText, owner || "Unassigned", dueDate || null, priority || "medium"]
        );

        await logAudit({
            meetingId: decision.meeting_id,
            entityType: "action_item",
            entityId: result.insertId,
            action: "CREATED",
            newValue: { taskText, owner, dueDate, decisionId },
            changedBy: "user",
            details: `Created as a follow-up from decision ID ${decisionId}: "${decision.statement}"`,
        });

        if (owner && owner !== "Unassigned") {
            await notifyAssignment({ id: result.insertId, owner, taskText }, decision.meeting_id, null);
        }

        res.status(201).json({ message: "Follow-up action item created", id: result.insertId });
    } catch (error) {
        console.error("spawnFollowUpFromDecision error:", error);
        res.status(500).json({ error: "Failed to spawn follow-up task" });
    }
};

function safeJsonParse(val, fallback = []) {
    if (Array.isArray(val)) return val;
    if (!val) return fallback;
    try { return JSON.parse(val); } catch { return fallback; }
}

module.exports = {
    getActionItems,
    getInbox,
    getActionItemById,
    createActionItem,
    updateActionItem,
    deleteActionItem,
    unlockActionItem,
    addComment,
    getComments,
    mergeActionItems,
    spawnFollowUpFromDecision,
};
