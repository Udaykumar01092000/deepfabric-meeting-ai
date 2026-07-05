/**
 * Extraction Controller
 * 
 * Orchestrates the core extraction pipeline:
 * 1. Fetch meeting's raw_content
 * 2. Check content_hash — if unchanged, skip (idempotency)
 * 3. Run NLP extraction engine
 * 4. For each extracted item, compute semantic_key
 * 5. Match against existing items:
 *    - Exact key match → update (unless manually edited → skip)
 *    - Similar key (Levenshtein > 0.8) → flag for confirmation
 *    - No match → insert new
 * 6. Record extraction_run with stats
 * 7. Create audit_log entries
 * 8. Generate idempotent notifications
 */
const db = require("../db");
const { extractAll } = require("../services/extractionService");
const { computeContentHash, computeSemanticKey, normalizeOwnerName, compareSemanticKeys } = require("../services/semanticMatcher");
const { logAudit } = require("../services/auditService");
const { notifyAssignment, checkDueReminders } = require("../services/notificationService");

/**
 * POST /api/meetings/:id/extract
 * Main extraction endpoint.
 */
const runExtraction = async (req, res) => {
    try {
        const meetingId = parseInt(req.params.id);

        // 1. Fetch the meeting
        const [meetings] = await db.execute("SELECT * FROM meetings WHERE id = ?", [meetingId]);
        if (meetings.length === 0) {
            return res.status(404).json({ error: "Meeting not found" });
        }

        const meeting = meetings[0];
        const rawContent = meeting.raw_content;
        const participants = safeJsonParse(meeting.participants, []);

        // 2. Content hash check — idempotency guard
        const currentHash = computeContentHash(rawContent);
        const [lastRun] = await db.execute(
            `SELECT * FROM extraction_runs 
             WHERE meeting_id = ? 
             ORDER BY run_number DESC LIMIT 1`,
            [meetingId]
        );

        if (lastRun.length > 0 && lastRun[0].content_hash === currentHash) {
            return res.json({
                message: "Content unchanged since last extraction — no re-processing needed.",
                idempotent: true,
                lastRunId: lastRun[0].id,
                lastRunAt: lastRun[0].created_at,
            });
        }

        // 3. Run NLP extraction
        const extracted = extractAll(rawContent, participants);

        // 4. Get existing entities for this meeting
        const [existingActions] = await db.execute(
            "SELECT * FROM action_items WHERE meeting_id = ?", [meetingId]
        );
        const [existingDecisions] = await db.execute(
            "SELECT * FROM decisions WHERE meeting_id = ?", [meetingId]
        );
        const [existingRisks] = await db.execute(
            "SELECT * FROM risks_blockers WHERE meeting_id = ?", [meetingId]
        );

        // 5. Determine next run number
        const runNumber = lastRun.length > 0 ? lastRun[0].run_number + 1 : 1;

        // 6. Create extraction_run record
        const [runResult] = await db.execute(
            `INSERT INTO extraction_runs 
                (meeting_id, run_number, content_hash, engine_used, raw_input_snapshot)
             VALUES (?, ?, ?, ?, ?)`,
            [meetingId, runNumber, currentHash, "rule-based-nlp-v1", rawContent]
        );
        const extractionRunId = runResult.insertId;

        // 7. Process action items with dedup
        const actionResults = await processActionItems(
            extracted.actionItems, existingActions, meetingId, extractionRunId, participants
        );

        // 8. Process decisions with dedup
        const decisionResults = await processDecisions(
            extracted.decisions, existingDecisions, meetingId, extractionRunId
        );

        // 9. Process risks with dedup
        const riskResults = await processRisks(
            extracted.risks, existingRisks, meetingId, extractionRunId
        );

        // 10. Update extraction_run stats
        const totalCreated = actionResults.created + decisionResults.created + riskResults.created;
        const totalUpdated = actionResults.updated + decisionResults.updated + riskResults.updated;
        const totalSkipped = actionResults.skipped + decisionResults.skipped + riskResults.skipped;
        const totalUnchanged = actionResults.unchanged + decisionResults.unchanged + riskResults.unchanged;

        await db.execute(
            `UPDATE extraction_runs 
             SET items_created = ?, items_updated = ?, items_skipped = ?, items_unchanged = ?
             WHERE id = ?`,
            [totalCreated, totalUpdated, totalSkipped, totalUnchanged, extractionRunId]
        );

        // 11. Audit log for the extraction run itself
        await logAudit({
            meetingId,
            entityType: "extraction_run",
            entityId: extractionRunId,
            action: "EXTRACTION_RUN",
            newValue: {
                runNumber,
                created: totalCreated,
                updated: totalUpdated,
                skipped: totalSkipped,
                unchanged: totalUnchanged,
            },
            details: `Extraction run #${runNumber}: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped (manual edits), ${totalUnchanged} unchanged`,
        });

        // 12. Check for due reminders after extraction
        await checkDueReminders();

        // 13. Build response
        res.json({
            message: "Extraction completed successfully",
            extractionRunId,
            runNumber,
            stats: {
                actionItems: actionResults,
                decisions: decisionResults,
                risks: riskResults,
                totals: { created: totalCreated, updated: totalUpdated, skipped: totalSkipped, unchanged: totalUnchanged },
            },
            conflicts: [
                ...actionResults.conflicts,
                ...decisionResults.conflicts,
                ...riskResults.conflicts,
            ],
        });
    } catch (error) {
        console.error("runExtraction error:", error);
        res.status(500).json({ error: "Extraction failed: " + error.message });
    }
};

/**
 * Process extracted action items against existing ones.
 * Returns { created, updated, skipped, unchanged, conflicts: [] }
 */
async function processActionItems(extractedItems, existingItems, meetingId, extractionRunId, participants) {
    const stats = { created: 0, updated: 0, skipped: 0, unchanged: 0, conflicts: [] };

    for (const item of extractedItems) {
        // Normalize the owner against participant list
        const ownerResult = normalizeOwnerName(item.owner, participants);
        item.owner = ownerResult.name;

        // Find matching existing item
        const matchResult = findMatch(item, existingItems);

        if (matchResult.type === "exact") {
            const existing = matchResult.match;

            // Check if manually edited — protect it
            if (existing.is_manually_edited) {
                stats.skipped++;
                await logAudit({
                    meetingId, entityType: "action_item", entityId: existing.id,
                    action: "SKIPPED_MANUAL_EDIT",
                    oldValue: { task_text: existing.task_text, owner: existing.owner },
                    newValue: { task_text: item.taskText, owner: item.owner },
                    details: `Re-extraction skipped: item was manually edited at ${existing.manually_edited_at}`,
                });
                continue;
            }

            // Check if anything actually changed
            const hasChanges = existing.task_text !== item.taskText ||
                existing.owner !== item.owner ||
                (item.dueDate && existing.due_date !== item.dueDate);

            if (!hasChanges) {
                stats.unchanged++;
                continue;
            }

            // Update existing item
            await db.execute(
                `UPDATE action_items SET 
                    task_text = ?, owner = ?, due_date = COALESCE(?, due_date),
                    confidence = ?, source_span_start = ?, source_span_end = ?,
                    source_snippet = ?, extraction_run_id = ?, version = version + 1
                 WHERE id = ?`,
                [
                    item.taskText, item.owner, item.dueDate,
                    item.confidence, item.sourceSpanStart, item.sourceSpanEnd,
                    item.sourceSnippet, extractionRunId, existing.id,
                ]
            );

            await logAudit({
                meetingId, entityType: "action_item", entityId: existing.id,
                action: "UPDATED",
                oldValue: { task_text: existing.task_text, owner: existing.owner, due_date: existing.due_date },
                newValue: { task_text: item.taskText, owner: item.owner, due_date: item.dueDate },
                details: `Updated by extraction run #${extractionRunId}`,
            });

            // Notify if owner changed
            if (existing.owner !== item.owner) {
                await notifyAssignment({ ...item, id: existing.id, task_text: item.taskText }, meetingId, extractionRunId, true);
            }

            stats.updated++;

        } else if (matchResult.type === "similar") {
            // Fuzzy match — flag as conflict for user confirmation
            stats.conflicts.push({
                entityType: "action_item",
                existingId: matchResult.match.id,
                existingText: matchResult.match.task_text,
                newText: item.taskText,
                similarity: matchResult.similarity,
                newOwner: item.owner,
                existingOwner: matchResult.match.owner,
            });
            stats.skipped++;

        } else {
            // No match — insert new
            const [insertResult] = await db.execute(
                `INSERT INTO action_items 
                    (meeting_id, extraction_run_id, semantic_key, task_text, owner, status, 
                     due_date, priority, confidence, source_span_start, source_span_end, source_snippet)
                 VALUES (?, ?, ?, ?, ?, 'open', ?, 'medium', ?, ?, ?, ?)`,
                [
                    meetingId, extractionRunId, item.semanticKey,
                    item.taskText, item.owner, item.dueDate,
                    item.confidence, item.sourceSpanStart, item.sourceSpanEnd,
                    item.sourceSnippet,
                ]
            );

            await logAudit({
                meetingId, entityType: "action_item", entityId: insertResult.insertId,
                action: "CREATED",
                newValue: { task_text: item.taskText, owner: item.owner, due_date: item.dueDate },
                details: `Created by extraction run #${extractionRunId}`,
            });

            // Notify assigned owner
            await notifyAssignment(
                { id: insertResult.insertId, owner: item.owner, taskText: item.taskText },
                meetingId, extractionRunId
            );

            stats.created++;
        }
    }

    return stats;
}

/**
 * Process extracted decisions.
 */
async function processDecisions(extractedDecisions, existingDecisions, meetingId, extractionRunId) {
    const stats = { created: 0, updated: 0, skipped: 0, unchanged: 0, conflicts: [] };

    for (const item of extractedDecisions) {
        const matchResult = findMatch(
            { semanticKey: item.semanticKey, taskText: item.statement },
            existingDecisions.map(d => ({ ...d, task_text: d.statement }))
        );

        if (matchResult.type === "exact") {
            const existing = matchResult.match;
            if (existing.is_manually_edited) { stats.skipped++; continue; }
            if (existing.statement === item.statement) { stats.unchanged++; continue; }

            await db.execute(
                `UPDATE decisions SET statement = ?, participants_involved = ?, 
                 source_snippet = ?, extraction_run_id = ? WHERE id = ?`,
                [item.statement, JSON.stringify(item.participantsInvolved),
                 item.sourceSnippet, extractionRunId, existing.id]
            );
            stats.updated++;
        } else if (matchResult.type === "similar") {
            stats.conflicts.push({
                entityType: "decision", existingId: matchResult.match.id,
                existingText: matchResult.match.statement, newText: item.statement,
                similarity: matchResult.similarity,
            });
            stats.skipped++;
        } else {
            await db.execute(
                `INSERT INTO decisions (meeting_id, extraction_run_id, semantic_key, statement, 
                 participants_involved, source_snippet) VALUES (?, ?, ?, ?, ?, ?)`,
                [meetingId, extractionRunId, item.semanticKey, item.statement,
                 JSON.stringify(item.participantsInvolved), item.sourceSnippet]
            );
            stats.created++;
        }
    }

    return stats;
}

/**
 * Process extracted risks.
 */
async function processRisks(extractedRisks, existingRisks, meetingId, extractionRunId) {
    const stats = { created: 0, updated: 0, skipped: 0, unchanged: 0, conflicts: [] };

    for (const item of extractedRisks) {
        const matchResult = findMatch(
            { semanticKey: item.semanticKey, taskText: item.description },
            existingRisks.map(r => ({ ...r, task_text: r.description }))
        );

        if (matchResult.type === "exact") {
            const existing = matchResult.match;
            if (existing.is_manually_edited) { stats.skipped++; continue; }
            if (existing.description === item.description) { stats.unchanged++; continue; }

            await db.execute(
                `UPDATE risks_blockers SET description = ?, severity = ?, 
                 source_snippet = ?, extraction_run_id = ? WHERE id = ?`,
                [item.description, item.severity, item.sourceSnippet, extractionRunId, existing.id]
            );
            stats.updated++;
        } else if (matchResult.type === "similar") {
            stats.conflicts.push({
                entityType: "risk", existingId: matchResult.match.id,
                existingText: matchResult.match.description, newText: item.description,
                similarity: matchResult.similarity,
            });
            stats.skipped++;
        } else {
            await db.execute(
                `INSERT INTO risks_blockers (meeting_id, extraction_run_id, semantic_key, 
                 description, severity, source_snippet) VALUES (?, ?, ?, ?, ?, ?)`,
                [meetingId, extractionRunId, item.semanticKey, item.description,
                 item.severity, item.sourceSnippet]
            );
            stats.created++;
        }
    }

    return stats;
}

/**
 * Find matching item using semantic key (exact) then Levenshtein (fuzzy).
 * Returns { type: 'exact'|'similar'|'none', match: existingItem, similarity }
 */
function findMatch(newItem, existingItems) {
    // Try exact semantic key match first
    for (const existing of existingItems) {
        if (existing.semantic_key === newItem.semanticKey) {
            return { type: "exact", match: existing, similarity: 1.0 };
        }
    }

    // Try fuzzy text match
    const { levenshteinSimilarity } = require("../services/semanticMatcher");
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const existing of existingItems) {
        const sim = levenshteinSimilarity(
            newItem.taskText || "",
            existing.task_text || ""
        );
        if (sim > bestSimilarity) {
            bestSimilarity = sim;
            bestMatch = existing;
        }
    }

    if (bestSimilarity >= 0.8 && bestMatch) {
        return { type: "similar", match: bestMatch, similarity: bestSimilarity };
    }

    return { type: "none", match: null, similarity: 0 };
}

/**
 * GET /api/meetings/:id/extraction-runs — List extraction history
 */
const getExtractionRuns = async (req, res) => {
    try {
        const { id } = req.params;
        const [runs] = await db.execute(
            `SELECT * FROM extraction_runs WHERE meeting_id = ? ORDER BY run_number DESC`,
            [id]
        );
        res.json(runs);
    } catch (error) {
        console.error("getExtractionRuns error:", error);
        res.status(500).json({ error: "Failed to fetch extraction runs" });
    }
};

/**
 * POST /api/meetings/:id/resolve-conflict — Resolve a fuzzy match conflict
 */
const resolveConflict = async (req, res) => {
    try {
        const { entityType, existingId, action, newText, newOwner } = req.body;
        // action: 'merge' | 'keep_both' | 'replace'

        if (entityType === "action_item") {
            if (action === "replace") {
                await db.execute(
                    "UPDATE action_items SET task_text = ?, owner = COALESCE(?, owner) WHERE id = ?",
                    [newText, newOwner, existingId]
                );
            } else if (action === "keep_both") {
                // Create a new item (the extracted one)
                const meetingId = req.params.id;
                const key = computeSemanticKey(newText);
                await db.execute(
                    `INSERT INTO action_items (meeting_id, semantic_key, task_text, owner, status)
                     VALUES (?, ?, ?, ?, 'open')`,
                    [meetingId, key, newText, newOwner || "Unassigned"]
                );
            }
            // 'merge' = do nothing (keep existing)
        }

        res.json({ message: `Conflict resolved: ${action}` });
    } catch (error) {
        console.error("resolveConflict error:", error);
        res.status(500).json({ error: "Failed to resolve conflict" });
    }
};

function safeJsonParse(val, fallback = []) {
    if (Array.isArray(val)) return val;
    if (!val) return fallback;
    try { return JSON.parse(val); } catch { return fallback; }
}

module.exports = {
    runExtraction,
    getExtractionRuns,
    resolveConflict,
};
