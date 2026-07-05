-- Smart Meeting Inbox — Database Schema
-- Run: mysql -u root -p < schema.sql
-- Or use: npm run migrate

CREATE DATABASE IF NOT EXISTS meeting_ai;
USE meeting_ai;

-- Drop existing tables to ensure schema modifications are applied
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS risks_blockers;
DROP TABLE IF EXISTS action_items;
DROP TABLE IF EXISTS decisions;
DROP TABLE IF EXISTS extraction_runs;
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS tasks;

-- ============================================================
-- USERS TABLE
-- Simple user registry for owner assignment & notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    role ENUM('member', 'organizer', 'admin') DEFAULT 'member',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MEETINGS TABLE
-- Core meeting records with raw transcript content
-- ============================================================
CREATE TABLE IF NOT EXISTS meetings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    organizer VARCHAR(100) DEFAULT 'Unknown',
    participants JSON,                          -- ["John Doe", "Sara Connor"]
    raw_content TEXT NOT NULL,                   -- The pasted notes / transcript
    attachments_metadata JSON,                  -- [{"name": "doc.pdf", "url": "..."}]
    content_hash VARCHAR(64),                   -- SHA-256 of raw_content for idempotency
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- EXTRACTION RUNS TABLE
-- Each time we run extraction on a meeting, we log it here
-- ============================================================
CREATE TABLE IF NOT EXISTS extraction_runs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id INT NOT NULL,
    run_number INT NOT NULL DEFAULT 1,
    content_hash VARCHAR(64) NOT NULL,          -- Hash of raw_content at time of extraction
    engine_used VARCHAR(50) DEFAULT 'rule-based-nlp-v1',
    items_created INT DEFAULT 0,
    items_updated INT DEFAULT 0,
    items_skipped INT DEFAULT 0,                -- Manually edited items that were skipped
    items_unchanged INT DEFAULT 0,
    raw_input_snapshot TEXT,                     -- Snapshot of raw_content at extraction time
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    INDEX idx_meeting_run (meeting_id, run_number)
);

-- ============================================================
-- DECISIONS TABLE
-- Extracted decisions with provenance
-- ============================================================
CREATE TABLE IF NOT EXISTS decisions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id INT NOT NULL,
    extraction_run_id INT,
    semantic_key VARCHAR(128) NOT NULL,
    statement TEXT NOT NULL,
    participants_involved JSON,                 -- ["John", "Sara"]
    source_snippet TEXT,
    is_manually_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (extraction_run_id) REFERENCES extraction_runs(id) ON DELETE SET NULL,
    INDEX idx_meeting_decisions (meeting_id),
    INDEX idx_decision_key (semantic_key)
);

-- ============================================================
-- ACTION ITEMS TABLE
-- Extracted tasks with stable IDs, provenance, and dedup keys
-- ============================================================
CREATE TABLE IF NOT EXISTS action_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id INT NOT NULL,
    extraction_run_id INT,                      -- NULL if manually created
    decision_id INT DEFAULT NULL,               -- Linked decision if follow-up
    semantic_key VARCHAR(128) NOT NULL,          -- Normalized hash for dedup
    task_text TEXT NOT NULL,
    owner VARCHAR(100) DEFAULT 'Unassigned',
    status ENUM('open', 'in-progress', 'done') DEFAULT 'open',
    due_date DATE,
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    confidence DECIMAL(3,2) DEFAULT 1.00,       -- 0.00 to 1.00
    source_span_start INT,                      -- Character offset start in raw_content
    source_span_end INT,                        -- Character offset end in raw_content
    source_snippet TEXT,                         -- The matched text from transcript
    is_manually_edited BOOLEAN DEFAULT FALSE,
    manually_edited_at DATETIME,
    version INT DEFAULT 1,                      -- For last-write-wins conflict resolution
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (extraction_run_id) REFERENCES extraction_runs(id) ON DELETE SET NULL,
    FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE SET NULL,
    INDEX idx_meeting_items (meeting_id),
    INDEX idx_semantic_key (semantic_key),
    INDEX idx_owner (owner),
    INDEX idx_status (status),
    INDEX idx_due_date (due_date),
    INDEX idx_decision_id (decision_id)
);

-- ============================================================
-- RISKS / BLOCKERS TABLE
-- Extracted risks with severity
-- ============================================================
CREATE TABLE IF NOT EXISTS risks_blockers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id INT NOT NULL,
    extraction_run_id INT,
    semantic_key VARCHAR(128) NOT NULL,
    description TEXT NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    source_snippet TEXT,
    is_manually_edited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (extraction_run_id) REFERENCES extraction_runs(id) ON DELETE SET NULL,
    INDEX idx_meeting_risks (meeting_id)
);

-- ============================================================
-- COMMENTS TABLE
-- Simple comment thread per action item
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action_item_id INT NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (action_item_id) REFERENCES action_items(id) ON DELETE CASCADE,
    INDEX idx_action_comments (action_item_id)
);

-- ============================================================
-- AUDIT LOGS TABLE
-- Complete change trail for all entities
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id INT,
    entity_type VARCHAR(50) NOT NULL,           -- 'action_item', 'decision', 'risk', 'meeting', 'extraction_run'
    entity_id INT,
    action VARCHAR(50) NOT NULL,                -- 'CREATED', 'UPDATED', 'DELETED', 'EXTRACTION_RUN', 'SKIPPED_MANUAL_EDIT'
    old_value JSON,
    new_value JSON,
    changed_by VARCHAR(100) DEFAULT 'system',
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL,
    INDEX idx_audit_meeting (meeting_id),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_action (action)
);

-- ============================================================
-- NOTIFICATIONS TABLE
-- In-app notifications with idempotency
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(100) NOT NULL,
    meeting_id INT,
    action_item_id INT,
    type ENUM('assigned', 'reassigned', 'due_reminder_24h', 'due_reminder_3d', 'overdue', 'escalation') NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    idempotency_key VARCHAR(255) UNIQUE,        -- Prevents duplicate notifications
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL,
    FOREIGN KEY (action_item_id) REFERENCES action_items(id) ON DELETE SET NULL,
    INDEX idx_notif_user (user_name),
    INDEX idx_notif_read (is_read)
);

-- ============================================================
-- SEED DATA: Default users for demo
-- ============================================================
INSERT IGNORE INTO users (name, email, role) VALUES
    ('Uday Kumar', 'uday@example.com', 'admin'),
    ('Sara Connor', 'sara@example.com', 'member'),
    ('John Doe', 'john@example.com', 'member'),
    ('Alex Mercer', 'alex@example.com', 'member'),
    ('Marcus Vance', 'marcus@example.com', 'member');
