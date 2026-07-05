/**
 * Notification Service
 * 
 * Creates idempotent notifications for:
 * - Newly assigned/reassigned action items
 * - Due date reminders (24h, 3d)
 * - Overdue items
 * - Escalation (overdue by N days → notify organizer)
 * 
 * Idempotency is enforced via UNIQUE idempotency_key on the notifications table.
 * Key format: `${actionItemId}:${type}:${contextId}`
 */
const db = require("../db");

/**
 * Create a notification, skipping if the idempotency key already exists.
 * Returns true if created, false if duplicate.
 */
async function createNotification({
    userName,
    meetingId = null,
    actionItemId = null,
    type,
    message,
    idempotencyKey,
}) {
    try {
        const [result] = await db.execute(
            `INSERT IGNORE INTO notifications 
                (user_name, meeting_id, action_item_id, type, message, idempotency_key)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userName, meetingId, actionItemId, type, message, idempotencyKey]
        );
        if (result && result.affectedRows > 0) {
            await simulateExternalNotification(userName, type, message);
        }
        return true;
    } catch (error) {
        // Duplicate key means notification already exists — that's fine
        if (error.code === "ER_DUP_ENTRY") return false;
        console.error("⚠️ Notification creation failed:", error.message);
        return false;
    }
}

/**
 * Notify owner when an action item is assigned or reassigned.
 */
async function notifyAssignment(actionItem, meetingId, extractionRunId, isReassign = false) {
    if (!actionItem.owner || actionItem.owner === "Unassigned") return;

    const type = isReassign ? "reassigned" : "assigned";
    const key = `${actionItem.id}:${type}:${extractionRunId || "manual"}`;
    const message = isReassign
        ? `You've been reassigned to: "${actionItem.task_text || actionItem.taskText}"`
        : `New action item assigned to you: "${actionItem.task_text || actionItem.taskText}"`;

    await createNotification({
        userName: actionItem.owner,
        meetingId,
        actionItemId: actionItem.id,
        type,
        message,
        idempotencyKey: key,
    });
}

/**
 * Check all action items for upcoming due dates and create reminders.
 * Called periodically or after extraction.
 */
async function checkDueReminders() {
    try {
        // 24-hour reminders
        const [dueSoon] = await db.execute(
            `SELECT ai.*, m.title as meeting_title 
             FROM action_items ai 
             LEFT JOIN meetings m ON ai.meeting_id = m.id
             WHERE ai.status != 'done' 
               AND ai.due_date IS NOT NULL
               AND ai.due_date = CURDATE() + INTERVAL 1 DAY
               AND ai.owner != 'Unassigned'`
        );

        for (const item of dueSoon) {
            await createNotification({
                userName: item.owner,
                meetingId: item.meeting_id,
                actionItemId: item.id,
                type: "due_reminder_24h",
                message: `Due tomorrow: "${item.task_text}" (from ${item.meeting_title || "meeting"})`,
                idempotencyKey: `${item.id}:due_reminder_24h:${item.due_date}`,
            });
        }

        // 3-day reminders
        const [due3Days] = await db.execute(
            `SELECT ai.*, m.title as meeting_title 
             FROM action_items ai 
             LEFT JOIN meetings m ON ai.meeting_id = m.id
             WHERE ai.status != 'done' 
               AND ai.due_date IS NOT NULL
               AND ai.due_date = CURDATE() + INTERVAL 3 DAY
               AND ai.owner != 'Unassigned'`
        );

        for (const item of due3Days) {
            await createNotification({
                userName: item.owner,
                meetingId: item.meeting_id,
                actionItemId: item.id,
                type: "due_reminder_3d",
                message: `Due in 3 days: "${item.task_text}" (from ${item.meeting_title || "meeting"})`,
                idempotencyKey: `${item.id}:due_reminder_3d:${item.due_date}`,
            });
        }

        return { reminders24h: dueSoon.length, reminders3d: due3Days.length };
    } catch (error) {
        console.error("⚠️ Due reminder check failed:", error.message);
        return { reminders24h: 0, reminders3d: 0 };
    }
}

/**
 * Check for overdue items and notify owners + escalate to organizer.
 * Escalation triggers when overdue by more than `escalationDays` days.
 */
async function checkOverdueItems(escalationDays = 3) {
    try {
        const [overdue] = await db.execute(
            `SELECT ai.*, m.title as meeting_title, m.organizer
             FROM action_items ai 
             LEFT JOIN meetings m ON ai.meeting_id = m.id
             WHERE ai.status != 'done' 
               AND ai.due_date IS NOT NULL
               AND ai.due_date < CURDATE()
               AND ai.owner != 'Unassigned'`
        );

        let notified = 0;
        let escalated = 0;

        for (const item of overdue) {
            const daysOverdue = Math.floor(
                (Date.now() - new Date(item.due_date).getTime()) / (1000 * 60 * 60 * 24)
            );

            // Notify owner
            const ownerCreated = await createNotification({
                userName: item.owner,
                meetingId: item.meeting_id,
                actionItemId: item.id,
                type: "overdue",
                message: `OVERDUE (${daysOverdue}d): "${item.task_text}"`,
                // Use week number so we don't spam daily, but send weekly reminders
                idempotencyKey: `${item.id}:overdue:week-${Math.floor(daysOverdue / 7)}`,
            });
            if (ownerCreated) notified++;

            // Escalation — notify organizer if overdue by N+ days
            if (daysOverdue >= escalationDays && item.organizer) {
                const escCreated = await createNotification({
                    userName: item.organizer,
                    meetingId: item.meeting_id,
                    actionItemId: item.id,
                    type: "escalation",
                    message: `ESCALATION: "${item.task_text}" assigned to ${item.owner} is ${daysOverdue}d overdue`,
                    idempotencyKey: `${item.id}:escalation:week-${Math.floor(daysOverdue / 7)}`,
                });
                if (escCreated) escalated++;
            }
        }

        return { overdue: overdue.length, notified, escalated };
    } catch (error) {
        console.error("⚠️ Overdue check failed:", error.message);
        return { overdue: 0, notified: 0, escalated: 0 };
    }
}

/**
 * Get notifications for a user.
 */
async function getNotifications(userName, unreadOnly = false) {
    let query = `SELECT n.*, m.title as meeting_title 
                 FROM notifications n 
                 LEFT JOIN meetings m ON n.meeting_id = m.id
                 WHERE n.user_name = ?`;
    const params = [userName];

    if (unreadOnly) {
        query += " AND n.is_read = FALSE";
    }

    query += " ORDER BY n.created_at DESC LIMIT 50";

    const [rows] = await db.execute(query, params);
    return rows;
}

/**
 * Mark notification as read.
 */
async function markAsRead(notificationId) {
    await db.execute(
        "UPDATE notifications SET is_read = TRUE WHERE id = ?",
        [notificationId]
    );
}

/**
 * Simulate email and push notification delivery.
 */
async function simulateExternalNotification(userName, type, message) {
    try {
        const [users] = await db.execute("SELECT email FROM users WHERE name = ?", [userName]);
        const email = users.length > 0 && users[0].email ? users[0].email : `${userName.toLowerCase().replace(/\s+/g, "")}@example.com`;
        
        console.log(`\n============================================================`);
        console.log(`✉️ [SIMULATED EMAIL SENT]`);
        console.log(`   To:      ${email}`);
        console.log(`   Subject: Smart Meeting Inbox - Action Required (${type})`);
        console.log(`   Message: ${message}`);
        console.log(`============================================================`);
        
        console.log(`📱 [SIMULATED PUSH NOTIFICATION SENT]`);
        console.log(`   To:      ${userName}`);
        console.log(`   Alert:   ${message}`);
        console.log(`============================================================\n`);
    } catch (err) {
        console.error("⚠️ External notification simulation failed:", err.message);
    }
}

module.exports = {
    createNotification,
    notifyAssignment,
    checkDueReminders,
    checkOverdueItems,
    getNotifications,
    markAsRead,
    simulateExternalNotification,
};
