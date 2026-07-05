/**
 * Semantic Matcher Service
 * 
 * Provides deterministic matching for idempotent extraction:
 * - computeSemanticKey(): Normalizes text → sorted words → SHA-256 hash
 * - computeContentHash(): SHA-256 of full transcript for change detection
 * - levenshteinSimilarity(): Fuzzy matching for near-duplicate detection
 * - normalizeOwnerName(): Resolves nickname variants against participant list
 */
const crypto = require("crypto");

// Common English stopwords to remove during normalization
const STOPWORDS = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "dare", "ought",
    "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
    "as", "into", "through", "during", "before", "after", "above", "below",
    "between", "out", "off", "over", "under", "again", "further", "then",
    "once", "here", "there", "when", "where", "why", "how", "all", "both",
    "each", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "just",
    "don", "now", "and", "but", "or", "if", "this", "that", "these",
    "those", "i", "me", "my", "we", "our", "you", "your", "he", "him",
    "his", "she", "her", "it", "its", "they", "them", "their", "what",
    "which", "who", "whom", "am"
]);

/**
 * Generate a stable semantic key from a text string.
 * Process:
 *  1. Lowercase
 *  2. Remove punctuation
 *  3. Split into words
 *  4. Remove stopwords
 *  5. Sort alphabetically
 *  6. SHA-256 hash
 * 
 * This ensures "Build the APIs" and "build APIs" produce the same key.
 */
function computeSemanticKey(text) {
    if (!text || typeof text !== "string") return "";

    const normalized = text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")   // Remove punctuation
        .split(/\s+/)                    // Split on whitespace
        .filter(w => w.length > 0 && !STOPWORDS.has(w))  // Remove stopwords
        .sort()                          // Sort alphabetically for order-independence
        .join(" ");

    return crypto.createHash("sha256").update(normalized).digest("hex").substring(0, 32);
}

/**
 * Compute SHA-256 hash of the full raw content.
 * Used to detect if transcript has changed between extraction runs.
 */
function computeContentHash(rawContent) {
    if (!rawContent) return "";
    return crypto.createHash("sha256").update(rawContent.trim()).digest("hex");
}

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,  // substitution
                    matrix[i][j - 1] + 1,       // insertion
                    matrix[i - 1][j] + 1        // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

/**
 * Compute similarity ratio between two strings (0.0 to 1.0).
 * 1.0 = identical, 0.0 = completely different.
 */
function levenshteinSimilarity(str1, str2) {
    if (!str1 && !str2) return 1.0;
    if (!str1 || !str2) return 0.0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1.0;

    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;

    const distance = levenshteinDistance(s1, s2);
    return 1.0 - distance / maxLen;
}

/**
 * Normalize an owner name by fuzzy-matching against the participant list.
 * Handles cases like "Jon" → "Jonathan", "Sara" → "Sarah".
 * 
 * Returns { name: resolvedName, confidence: 0.0-1.0 }
 */
function normalizeOwnerName(name, participantsList) {
    if (!name || !participantsList || participantsList.length === 0) {
        return { name: name || "Unassigned", confidence: 0.5 };
    }

    const cleanName = name.trim();

    // Exact match first
    for (const p of participantsList) {
        if (p.toLowerCase() === cleanName.toLowerCase()) {
            return { name: p, confidence: 1.0 };
        }
    }

    // First name match
    for (const p of participantsList) {
        const firstName = p.split(" ")[0];
        if (firstName.toLowerCase() === cleanName.toLowerCase()) {
            return { name: p, confidence: 0.95 };
        }
    }

    // Fuzzy match — find the best match above threshold
    let bestMatch = null;
    let bestSimilarity = 0;

    for (const p of participantsList) {
        // Compare against full name and first name
        const fullSim = levenshteinSimilarity(cleanName, p);
        const firstNameSim = levenshteinSimilarity(cleanName, p.split(" ")[0]);
        const sim = Math.max(fullSim, firstNameSim);

        if (sim > bestSimilarity) {
            bestSimilarity = sim;
            bestMatch = p;
        }
    }

    if (bestSimilarity >= 0.7 && bestMatch) {
        return { name: bestMatch, confidence: bestSimilarity };
    }

    // No good match found — keep original
    return { name: cleanName, confidence: 0.5 };
}

/**
 * Compare two semantic keys to determine if they refer to the same entity.
 * Returns: 'exact' | 'similar' | 'different'
 */
function compareSemanticKeys(key1, key2, text1, text2) {
    if (key1 === key2) return "exact";

    // If keys don't match, do fuzzy text comparison
    const similarity = levenshteinSimilarity(text1 || "", text2 || "");
    if (similarity >= 0.8) return "similar";

    return "different";
}

module.exports = {
    computeSemanticKey,
    computeContentHash,
    levenshteinDistance,
    levenshteinSimilarity,
    normalizeOwnerName,
    compareSemanticKeys,
};
