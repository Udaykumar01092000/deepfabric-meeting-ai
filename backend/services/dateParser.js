/**
 * Date Parser Service
 * 
 * Parses natural language date expressions from meeting transcripts.
 * Handles: "by Friday", "next week", "tomorrow", "end of month", "July 15th", etc.
 * 
 * Returns { date: "YYYY-MM-DD", confidence: 0.0-1.0, matchedPhrase: "..." }
 */

/**
 * Parse a natural language date phrase relative to a reference date.
 * @param {string} phrase - The text containing a date reference
 * @param {Date} referenceDate - The date to calculate relative dates from (defaults to now)
 * @returns {{ date: string|null, confidence: number, matchedPhrase: string }}
 */
function parseDatePhrase(phrase, referenceDate = new Date()) {
    if (!phrase || typeof phrase !== "string") {
        return { date: null, confidence: 0, matchedPhrase: "" };
    }

    const text = phrase.toLowerCase().trim();
    const ref = new Date(referenceDate);

    // === EXPLICIT DATE PATTERNS ===

    // "July 15th", "March 3rd", "Jan 20"
    const monthDayPattern = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(st|nd|rd|th)?\b/i;
    const monthDayMatch = text.match(monthDayPattern);
    if (monthDayMatch) {
        const monthStr = monthDayMatch[1];
        const day = parseInt(monthDayMatch[2]);
        const monthIndex = getMonthIndex(monthStr);
        if (monthIndex !== -1 && day >= 1 && day <= 31) {
            const year = ref.getFullYear();
            const targetDate = new Date(year, monthIndex, day);
            // If date is in the past, assume next year
            if (targetDate < ref) targetDate.setFullYear(year + 1);
            return {
                date: formatDate(targetDate),
                confidence: 0.95,
                matchedPhrase: monthDayMatch[0]
            };
        }
    }

    // "2026-07-15" or "07/15/2026"
    const isoPattern = /\b(\d{4})-(\d{2})-(\d{2})\b/;
    const isoMatch = text.match(isoPattern);
    if (isoMatch) {
        return {
            date: isoMatch[0],
            confidence: 1.0,
            matchedPhrase: isoMatch[0]
        };
    }

    // === RELATIVE DATE PATTERNS ===

    // "today"
    if (/\btoday\b/.test(text)) {
        return { date: formatDate(ref), confidence: 0.9, matchedPhrase: "today" };
    }

    // "tomorrow"
    if (/\btomorrow\b/.test(text)) {
        const d = new Date(ref);
        d.setDate(d.getDate() + 1);
        return { date: formatDate(d), confidence: 0.95, matchedPhrase: "tomorrow" };
    }

    // "day after tomorrow"
    if (/\bday after tomorrow\b/.test(text)) {
        const d = new Date(ref);
        d.setDate(d.getDate() + 2);
        return { date: formatDate(d), confidence: 0.9, matchedPhrase: "day after tomorrow" };
    }

    // "by Friday", "on Monday", "this Wednesday", "next Tuesday"
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayPattern = /\b(?:by|on|this|next)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
    const dayMatch = text.match(dayPattern);
    if (dayMatch) {
        const targetDay = dayNames.indexOf(dayMatch[1].toLowerCase());
        const isNext = text.includes("next");
        const d = getNextDayOfWeek(ref, targetDay, isNext);
        return {
            date: formatDate(d),
            confidence: 0.85,
            matchedPhrase: dayMatch[0]
        };
    }

    // Just a day name without prefix: "Friday", "Monday"
    const simpleDayPattern = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
    const simpleDayMatch = text.match(simpleDayPattern);
    if (simpleDayMatch) {
        const targetDay = dayNames.indexOf(simpleDayMatch[1].toLowerCase());
        const d = getNextDayOfWeek(ref, targetDay, false);
        return {
            date: formatDate(d),
            confidence: 0.7,
            matchedPhrase: simpleDayMatch[0]
        };
    }

    // "next week"
    if (/\bnext week\b/.test(text)) {
        const d = new Date(ref);
        d.setDate(d.getDate() + 7);
        return { date: formatDate(d), confidence: 0.7, matchedPhrase: "next week" };
    }

    // "this week", "end of week", "by end of week", "eow"
    if (/\b(this week|end of week|eow|by eow)\b/.test(text)) {
        const d = getNextDayOfWeek(ref, 5, false); // Friday
        return { date: formatDate(d), confidence: 0.75, matchedPhrase: text.match(/\b(this week|end of week|eow|by eow)\b/)[0] };
    }

    // "end of month", "eom", "by end of month"
    if (/\b(end of month|eom|by eom)\b/.test(text)) {
        const d = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
        return { date: formatDate(d), confidence: 0.7, matchedPhrase: text.match(/\b(end of month|eom|by eom)\b/)[0] };
    }

    // "in N days"
    const inDaysPattern = /\bin\s+(\d+)\s+days?\b/;
    const inDaysMatch = text.match(inDaysPattern);
    if (inDaysMatch) {
        const d = new Date(ref);
        d.setDate(d.getDate() + parseInt(inDaysMatch[1]));
        return { date: formatDate(d), confidence: 0.9, matchedPhrase: inDaysMatch[0] };
    }

    // "in N weeks"
    const inWeeksPattern = /\bin\s+(\d+)\s+weeks?\b/;
    const inWeeksMatch = text.match(inWeeksPattern);
    if (inWeeksMatch) {
        const d = new Date(ref);
        d.setDate(d.getDate() + parseInt(inWeeksMatch[1]) * 7);
        return { date: formatDate(d), confidence: 0.85, matchedPhrase: inWeeksMatch[0] };
    }

    // No date found
    return { date: null, confidence: 0, matchedPhrase: "" };
}

/**
 * Scan a full text and extract all date references.
 */
function extractDatesFromText(text, referenceDate = new Date()) {
    if (!text) return [];

    // Split into sentences and try to find dates in each
    const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 0);
    const results = [];

    for (const sentence of sentences) {
        const result = parseDatePhrase(sentence, referenceDate);
        if (result.date && result.confidence > 0) {
            results.push({
                ...result,
                sentence: sentence.trim()
            });
        }
    }

    return results;
}

// === HELPER FUNCTIONS ===

function getMonthIndex(monthStr) {
    const months = {
        "january": 0, "jan": 0,
        "february": 1, "feb": 1,
        "march": 2, "mar": 2,
        "april": 3, "apr": 3,
        "may": 4,
        "june": 5, "jun": 5,
        "july": 6, "jul": 6,
        "august": 7, "aug": 7,
        "september": 8, "sep": 8,
        "october": 9, "oct": 9,
        "november": 10, "nov": 10,
        "december": 11, "dec": 11
    };
    return months[monthStr.toLowerCase()] ?? -1;
}

function getNextDayOfWeek(fromDate, targetDay, forceNextWeek) {
    const d = new Date(fromDate);
    const currentDay = d.getDay();
    let daysToAdd = (targetDay - currentDay + 7) % 7;

    if (daysToAdd === 0 && !forceNextWeek) {
        daysToAdd = 0; // Same day = today
    }
    if (daysToAdd === 0 && forceNextWeek) {
        daysToAdd = 7;
    }
    if (forceNextWeek && daysToAdd < 7) {
        daysToAdd += 7;
    }

    d.setDate(d.getDate() + daysToAdd);
    return d;
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

module.exports = {
    parseDatePhrase,
    extractDatesFromText,
};
