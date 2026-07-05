const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { testConnection } = require("./db");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "5mb" }));

// Routes
const meetingRoutes = require("./routes/meetingRoutes");
const extractionRoutes = require("./routes/extractionRoutes");
const actionItemRoutes = require("./routes/actionItemRoutes");
const decisionRoutes = require("./routes/decisionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const auditRoutes = require("./routes/auditRoutes");

app.use("/api/meetings", meetingRoutes);
app.use("/api/meetings", extractionRoutes);   // /api/meetings/:id/extract
app.use("/api/action-items", actionItemRoutes);
app.use("/api/decisions", decisionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/audit-logs", auditRoutes);

// Users endpoint (simple)
const db = require("./db");
app.get("/api/users", async (req, res) => {
    try {
        const [rows] = await db.execute("SELECT * FROM users ORDER BY name ASC");
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// Health check
app.get("/", (req, res) => {
    res.json({ status: "ok", message: "Smart Meeting Inbox API 🚀" });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 API Base: http://localhost:${PORT}/api\n`);
    await testConnection();

    // Start background scheduler for reminders & overdue escalations
    const { checkDueReminders, checkOverdueItems } = require("./services/notificationService");
    
    // Run initial checks 5 seconds after startup
    setTimeout(async () => {
        try {
            console.log("⏰ Startup Job: Checking due reminders and overdue tasks...");
            const reminders = await checkDueReminders();
            const overdue = await checkOverdueItems(3);
            console.log(`⏰ Startup Job Done:`, { reminders, overdue });
        } catch (err) {
            console.error("❌ Startup Job Error:", err.message);
        }
    }, 5000);

    // Schedule check to run every hour
    setInterval(async () => {
        try {
            console.log("⏰ Background Job: Checking due reminders and overdue tasks...");
            const reminders = await checkDueReminders();
            const overdue = await checkOverdueItems(3);
            console.log(`⏰ Background Job Done:`, { reminders, overdue });
        } catch (err) {
            console.error("❌ Background Job Error:", err.message);
        }
    }, 1000 * 60 * 60); // 1 hour
});