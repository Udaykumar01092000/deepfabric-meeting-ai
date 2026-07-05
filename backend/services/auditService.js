/**
 * Audit Service
 * 
 * Logs all entity changes with old/new values for full traceability.
 */
const db = require("../db");

/**
 * Log an audit event.
 * @param {object} params
 * @param {number} params.meetingId - Related meeting ID (nullable)
 * @param {string} params.entityType - 'action_item', 'decision', 'risk', 'meeting', 'extraction_run'
 * @param {number} params.entityId - ID of the entity (nullable)
 * @param {string} params.action - 'CREATED', 'UPDATED', 'DELETED', 'EXTRACTION_RUN', 'SKIPPED_MANUAL_EDIT'
 * @param {object} params.oldValue - Previous state (nullable)
 * @param {object} params.newValue - New state (nullable)
 * @param {string} params.changedBy - Who made the change (default: 'system')
 * @param {string} params.details - Human-readable description
 */
async function logAudit({
    meetingId = null,
    entityType,
    entityId = null,
    action,
    oldValue = null,
    newValue = null,
    changedBy = "system",
    details = "",
}) {
    try {
        await db.execute(
            `INSERT INTO audit_logs 
                (meeting_id, entity_type, entity_id, action, old_value, new_value, changed_by, details)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                meetingId,
                entityType,
                entityId,
                action,
                oldValue ? JSON.stringify(oldValue) : null,
                newValue ? JSON.stringify(newValue) : null,
                changedBy,
                details,
            ]
        );
    } catch (error) {
        console.error("⚠️ Audit log write failed:", error.message);
        // Don't throw — audit failures should not break the main flow
    }
}

async function getAuditLogs(meetingId, limit = 100) {
    const parsedLimit = parseInt(limit, 10) || 100;
    const [rows] = await db.execute(
        `SELECT * FROM audit_logs 
         WHERE meeting_id = ? 
         ORDER BY created_at DESC 
         LIMIT ${parsedLimit}`,
        [meetingId]
    );
    return rows;
}

/**
 * Get all audit logs with optional filters.
 */
async function getAllAuditLogs({ entityType, action, limit = 200 } = {}) {
    let query = "SELECT * FROM audit_logs WHERE 1=1";
    const params = [];

    if (entityType) {
        query += " AND entity_type = ?";
        params.push(entityType);
    }
    if (action) {
        query += " AND action = ?";
        params.push(action);
    }

    const parsedLimit = parseInt(limit, 10) || 200;
    query += ` ORDER BY created_at DESC LIMIT ${parsedLimit}`;

    const [rows] = await db.execute(query, params);
    return rows;
}

module.exports = {
    logAudit,
    getAuditLogs,
    getAllAuditLogs,
};
