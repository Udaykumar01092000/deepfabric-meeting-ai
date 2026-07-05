/**
 * Audit Controller
 */
const { getAuditLogs, getAllAuditLogs } = require("../services/auditService");

const getAuditLogsByMeeting = async (req, res) => {
    try {
        const { meetingId } = req.query;
        if (meetingId) {
            const logs = await getAuditLogs(meetingId);
            return res.json(logs);
        }
        const { entityType, action } = req.query;
        const logs = await getAllAuditLogs({ entityType, action });
        res.json(logs);
    } catch (error) {
        console.error("getAuditLogs error:", error);
        res.status(500).json({ error: "Failed to fetch audit logs" });
    }
};

module.exports = { getAuditLogsByMeeting };
