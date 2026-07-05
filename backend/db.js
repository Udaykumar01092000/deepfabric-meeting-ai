const mysql = require("mysql2");
require("dotenv").config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "meeting_ai",
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Enable multiple statements for migration
    multipleStatements: true,
});

const db = pool.promise();

// Test connection on startup
async function testConnection() {
    try {
        const [rows] = await db.query("SELECT 1 + 1 AS result");
        console.log("✅ MySQL connection established successfully");
        return true;
    } catch (error) {
        console.error("❌ MySQL connection failed:", error.message);
        return false;
    }
}

module.exports = db;
module.exports.testConnection = testConnection;