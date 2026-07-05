/**
 * Database Migration Script
 * Reads schema.sql and executes it against the MySQL database.
 * Usage: node migrate.js
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();

async function migrate() {
    console.log("🔄 Starting database migration...\n");

    // Connect without specifying a database first (to create it if needed)
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "",
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
        multipleStatements: true,
    });

    try {
        // Read the schema file
        const schemaPath = path.join(__dirname, "schema.sql");
        const schema = fs.readFileSync(schemaPath, "utf-8");

        console.log("📄 Read schema.sql successfully");
        console.log(`📊 Schema size: ${(schema.length / 1024).toFixed(1)} KB\n`);

        // Execute the full schema
        await connection.query(schema);

        console.log("✅ All tables created/verified successfully!\n");

        // Verify tables exist
        const dbName = process.env.DB_NAME || "meeting_ai";
        const [tables] = await connection.query(
            `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?`,
            [dbName]
        );

        console.log(`📋 Tables in '${dbName}' database:`);
        tables.forEach((t) => {
            console.log(`   ✓ ${t.TABLE_NAME}`);
        });

        console.log(`\n🎉 Migration complete! ${tables.length} tables ready.`);
    } catch (error) {
        console.error("❌ Migration failed:", error.message);
        if (error.sqlMessage) {
            console.error("   SQL Error:", error.sqlMessage);
        }
        process.exit(1);
    } finally {
        await connection.end();
    }
}

migrate();
