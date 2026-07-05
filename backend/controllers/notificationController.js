/**
 * Notification Controller
 */
const { getNotifications, markAsRead, checkDueReminders, checkOverdueItems } = require("../services/notificationService");

const getUserNotifications = async (req, res) => {
    try {
        const { user } = req.query;
        if (!user) return res.status(400).json({ error: "user query parameter is required" });
        const unreadOnly = req.query.unreadOnly === "true";
        const notifications = await getNotifications(user, unreadOnly);
        res.json(notifications);
    } catch (error) {
        console.error("getUserNotifications error:", error);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
};

const markNotificationRead = async (req, res) => {
    try {
        await markAsRead(req.params.id);
        res.json({ message: "Notification marked as read" });
    } catch (error) {
        console.error("markNotificationRead error:", error);
        res.status(500).json({ error: "Failed to mark notification" });
    }
};

const triggerReminderCheck = async (req, res) => {
    try {
        const reminders = await checkDueReminders();
        const overdue = await checkOverdueItems(req.body.escalationDays || 3);
        res.json({ reminders, overdue });
    } catch (error) {
        console.error("triggerReminderCheck error:", error);
        res.status(500).json({ error: "Failed to check reminders" });
    }
};

module.exports = { getUserNotifications, markNotificationRead, triggerReminderCheck };
