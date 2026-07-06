const { levenshteinSimilarity } = require('./semanticMatcher');

const normalizeOwnerTokens = (value) =>
    String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean);

const isUnassignedOwner = (owner) => {
    if (!owner) return true;
    const normalized = String(owner).trim();
    return normalized === '' || normalized === 'Unassigned' || normalized.toLowerCase() === 'unassigned';
};

const matchesOwner = (storedOwner, selectedOwner) => {
    if (!storedOwner || !selectedOwner) return false;

    const stored = String(storedOwner).trim();
    const selected = String(selectedOwner).trim();
    if (!stored || !selected) return false;

    if (stored.toLowerCase() === selected.toLowerCase()) return true;

    const storedTokens = normalizeOwnerTokens(stored);
    const selectedTokens = normalizeOwnerTokens(selected);

    if (storedTokens.length && selectedTokens.length) {
        const shared = storedTokens.filter(token => selectedTokens.includes(token));
        if (shared.length) return true;
        if (storedTokens[0] && selectedTokens[0] && storedTokens[0] === selectedTokens[0]) return true;
    }

    const storedCompact = stored.replace(/\s+/g, '');
    const selectedCompact = selected.replace(/\s+/g, '');
    if (storedCompact && selectedCompact && storedCompact.toLowerCase() === selectedCompact.toLowerCase()) return true;

    return levenshteinSimilarity(stored, selected) >= 0.75;
};

module.exports = { matchesOwner, isUnassignedOwner, normalizeOwnerTokens };
