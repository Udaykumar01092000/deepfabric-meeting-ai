/**
 * Extraction Service — Rule-based NLP Engine (v1)
 * 
 * Parses meeting transcripts to extract:
 * 1. Action Items — with owner, due date, confidence, provenance
 * 2. Decisions — with participants involved
 * 3. Risks/Blockers — with severity
 * 
 * Uses pattern matching, no external AI API required.
 * 
 * AI USAGE DISCLOSURE:
 *   This service uses regex-based heuristics and pattern matching.
 *   No external LLM/AI API is called. The patterns were designed
 *   to handle common meeting transcript formats.
 */
const { computeSemanticKey } = require("./semanticMatcher");
const { parseDatePhrase } = require("./dateParser");

// ============================================================
// ACTION ITEM EXTRACTION
// ============================================================

/**
 * Action verb patterns that indicate a task assignment.
 * Each pattern captures: [speaker/owner, action phrase]
 */
const ACTION_PATTERNS = [
    // "[Name] will [verb phrase]" — most common explicit assignment
    {
        regex: /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*(?::|,)?\s*(?:I(?:'ll|'ll| will)\s+(.+?)(?:\.|$))/gim,
        getOwner: (match, speakerContext) => speakerContext || match[1],
        getText: (match) => match[2],
        confidence: 0.9,
        type: "self_assignment"
    },
    // "[Speaker]: ... I'll [do something]" or "I will [do something]"
    {
        regex: /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)[\s]*:.*?\bI(?:'ll|'ll| will)\s+(.+?)(?:\.|,\s*(?:and|but)|$)/gim,
        getOwner: (match) => match[1],
        getText: (match) => match[2],
        confidence: 0.9,
        type: "speaker_self_assign"
    },
    // "[Name] will [verb]" — third-person assignment
    {
        regex: /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+will\s+(.+?)(?:\.|,\s*(?:and|but)|$)/gim,
        getOwner: (match) => match[1],
        getText: (match) => match[2],
        confidence: 0.85,
        type: "third_person_assign"
    },
    // "[Name] should [verb]"
    {
        regex: /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+should\s+(.+?)(?:\.|,\s*(?:and|but)|$)/gim,
        getOwner: (match) => match[1],
        getText: (match) => match[2],
        confidence: 0.75,
        type: "suggestion"
    },
    // "[Name] needs to [verb]"
    {
        regex: /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+needs?\s+to\s+(.+?)(?:\.|,\s*(?:and|but)|$)/gim,
        getOwner: (match) => match[1],
        getText: (match) => match[2],
        confidence: 0.8,
        type: "requirement"
    },
    // "please [verb]" — directed at someone
    {
        regex: /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),?\s+please\s+(.+?)(?:\.|$)/gim,
        getOwner: (match) => match[1],
        getText: (match) => match[2],
        confidence: 0.8,
        type: "polite_request"
    },
    // "assign [task] to [name]" or "[name], please assign"
    {
        regex: /\bassign\s+(?:that|this|the)?\s*(?:task)?\s*to\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/gim,
        getOwner: (match) => match[1],
        getText: (match) => `Assigned task`,
        confidence: 0.7,
        type: "explicit_assign"
    },
    // "Let's [verb]" — group action
    {
        regex: /\blet(?:'s|'s)\s+(.+?)(?:\.|$)/gim,
        getOwner: () => "Team",
        getText: (match) => match[1],
        confidence: 0.6,
        type: "group_action"
    },
];

/**
 * Extract action items from transcript text.
 * Returns array of { taskText, owner, dueDate, confidence, sourceSpan, sourceSnippet, semanticKey }
 */
function extractActionItems(rawContent, participants = []) {
    if (!rawContent) return [];

    const items = [];
    const seenKeys = new Set();
    const lines = rawContent.split("\n");

    // First, build a speaker context map: line → speaker name
    const speakerMap = buildSpeakerMap(rawContent);

    for (const pattern of ACTION_PATTERNS) {
        // Reset regex lastIndex
        pattern.regex.lastIndex = 0;
        let match;

        while ((match = pattern.regex.exec(rawContent)) !== null) {
            const owner = pattern.getOwner(match, null);
            let taskText = pattern.getText(match);

            // Clean up task text
            taskText = cleanTaskText(taskText);
            if (!taskText || taskText.length < 5) continue;

            // Compute semantic key for dedup within this extraction
            const key = computeSemanticKey(taskText);
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);

            // Find source span in original text
            const spanStart = match.index;
            const spanEnd = match.index + match[0].length;

            // Extract surrounding context as source snippet
            const snippetStart = Math.max(0, spanStart - 20);
            const snippetEnd = Math.min(rawContent.length, spanEnd + 20);
            const sourceSnippet = rawContent.substring(snippetStart, snippetEnd).trim();

            // Try to extract a due date from the surrounding context
            const surroundingText = rawContent.substring(
                Math.max(0, spanStart - 50),
                Math.min(rawContent.length, spanEnd + 100)
            );
            const dateResult = parseDatePhrase(surroundingText);

            items.push({
                taskText: taskText.charAt(0).toUpperCase() + taskText.slice(1),
                owner: owner || "Unassigned",
                dueDate: dateResult.date,
                dueDateConfidence: dateResult.confidence,
                dueDatePhrase: dateResult.matchedPhrase,
                confidence: pattern.confidence,
                sourceSpanStart: spanStart,
                sourceSpanEnd: spanEnd,
                sourceSnippet: sourceSnippet,
                semanticKey: key,
                patternType: pattern.type,
            });
        }
    }

    return items;
}

// ============================================================
// DECISION EXTRACTION
// ============================================================

const DECISION_PATTERNS = [
    /\b(?:we(?:'ve|'ve)?\s+)?decided\s+(?:to\s+)?(.+?)(?:\.|$)/gim,
    /\bagreed\s+(?:on|to|that)\s+(.+?)(?:\.|$)/gim,
    /\b(?:we(?:'ll|'ll)?\s+)?go\s+with\s+(.+?)(?:\.|$)/gim,
    /\bthe\s+decision\s+is\s+(?:to\s+)?(.+?)(?:\.|$)/gim,
    /\blet(?:'s|'s)\s+(?:go\s+(?:ahead\s+)?(?:with|and)\s+)?(.+?)(?:\.|$)/gim,
    /\bwe\s+(?:should|will|are\s+going\s+to)\s+(?:go\s+(?:ahead\s+)?(?:with|and)\s+)(.+?)(?:\.|$)/gim,
    /\bfinal(?:ized?|ly)\s+(?:on|that|decided)\s+(.+?)(?:\.|$)/gim,
];

/**
 * Extract decisions from transcript text.
 * Returns array of { statement, participantsInvolved, sourceSnippet, semanticKey }
 */
function extractDecisions(rawContent, participants = []) {
    if (!rawContent) return [];

    const decisions = [];
    const seenKeys = new Set();

    for (const pattern of DECISION_PATTERNS) {
        pattern.lastIndex = 0;
        let match;

        while ((match = pattern.exec(rawContent)) !== null) {
            let statement = match[1].trim();
            if (!statement || statement.length < 5) continue;

            statement = statement.charAt(0).toUpperCase() + statement.slice(1);
            const key = computeSemanticKey(statement);
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);

            // Find participants mentioned near this decision
            const context = rawContent.substring(
                Math.max(0, match.index - 100),
                Math.min(rawContent.length, match.index + match[0].length + 100)
            );
            const involvedParticipants = findMentionedParticipants(context, participants);

            const snippetStart = Math.max(0, match.index - 20);
            const snippetEnd = Math.min(rawContent.length, match.index + match[0].length + 20);

            decisions.push({
                statement,
                participantsInvolved: involvedParticipants.length > 0 ? involvedParticipants : participants,
                sourceSnippet: rawContent.substring(snippetStart, snippetEnd).trim(),
                semanticKey: key,
            });
        }
    }

    return decisions;
}

// ============================================================
// RISK / BLOCKER EXTRACTION
// ============================================================

const RISK_PATTERNS = [
    { regex: /\b(?:blocked\s+by|blocker(?:s)?)\s*[:\-]?\s*(.+?)(?:\.|$)/gim, severity: "critical" },
    { regex: /\b(?:blocking\s+(?:issue|problem))\s*[:\-]?\s*(.+?)(?:\.|$)/gim, severity: "critical" },
    { regex: /\b(?:high\s+)?risk\s*[:\-]?\s*(.+?)(?:\.|$)/gim, severity: "high" },
    { regex: /\bconcerned?\s+(?:about|that|with)\s+(.+?)(?:\.|$)/gim, severity: "medium" },
    { regex: /\bissue\s+with\s+(.+?)(?:\.|$)/gim, severity: "medium" },
    { regex: /\bdependency\s+on\s+(.+?)(?:\.|$)/gim, severity: "medium" },
    { regex: /\bworried\s+(?:about|that)\s+(.+?)(?:\.|$)/gim, severity: "medium" },
    { regex: /\bpotential\s+(?:issue|problem|risk)\s*[:\-]?\s*(.+?)(?:\.|$)/gim, severity: "low" },
    { regex: /\bwatch\s+out\s+for\s+(.+?)(?:\.|$)/gim, severity: "low" },
];

/**
 * Extract risks and blockers from transcript text.
 * Returns array of { description, severity, sourceSnippet, semanticKey }
 */
function extractRisks(rawContent) {
    if (!rawContent) return [];

    const risks = [];
    const seenKeys = new Set();

    for (const { regex, severity } of RISK_PATTERNS) {
        regex.lastIndex = 0;
        let match;

        while ((match = regex.exec(rawContent)) !== null) {
            let description = match[1].trim();
            if (!description || description.length < 5) continue;

            description = description.charAt(0).toUpperCase() + description.slice(1);
            const key = computeSemanticKey(description);
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);

            const snippetStart = Math.max(0, match.index - 20);
            const snippetEnd = Math.min(rawContent.length, match.index + match[0].length + 20);

            risks.push({
                description,
                severity,
                sourceSnippet: rawContent.substring(snippetStart, snippetEnd).trim(),
                semanticKey: key,
            });
        }
    }

    return risks;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Build a map of character positions to speaker names.
 * Parses patterns like "John:", "Sara:", "Speaker Name:"
 */
function buildSpeakerMap(text) {
    const speakerPattern = /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*:/gm;
    const speakers = [];
    let match;

    while ((match = speakerPattern.exec(text)) !== null) {
        speakers.push({
            name: match[1],
            position: match.index,
        });
    }

    return speakers;
}

/**
 * Find which participants are mentioned in a text context.
 */
function findMentionedParticipants(context, participants) {
    if (!context || !participants) return [];
    const mentioned = [];
    const lowerContext = context.toLowerCase();

    for (const p of participants) {
        if (lowerContext.includes(p.toLowerCase()) ||
            lowerContext.includes(p.split(" ")[0].toLowerCase())) {
            mentioned.push(p);
        }
    }

    return mentioned;
}

/**
 * Clean up extracted task text.
 */
function cleanTaskText(text) {
    if (!text) return "";
    return text
        .replace(/^(the|a|an)\s+/i, "")
        .replace(/\s+/g, " ")
        .replace(/[,;:]+$/, "")
        .trim();
}

/**
 * Full extraction pipeline — runs all extractors on a transcript.
 * Returns { actionItems, decisions, risks }
 */
function extractAll(rawContent, participants = []) {
    return {
        actionItems: extractActionItems(rawContent, participants),
        decisions: extractDecisions(rawContent, participants),
        risks: extractRisks(rawContent),
    };
}

module.exports = {
    extractActionItems,
    extractDecisions,
    extractRisks,
    extractAll,
};
