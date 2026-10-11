/**
 * Deterministic helper to generate stable "demo" ratings and counts
 * based on MongoDB ObjectIds. This ensures consistency across different API calls.
 */
const getStableMetrics = (id) => {
    if (!id) return { rating: 4.5, ratingCount: 150 };

    const idStr = id.toString();
    const lastChar = idStr[idStr.length - 1];
    const lastTwo = idStr.slice(-2);

    // Generate a rating between 4.3 and 5.0
    // parseInt(lastChar, 16) gives 0-15. We want 0-7 to map to 0.0-0.7.
    const ratingBase = (parseInt(lastChar, 16) % 8) * 0.1;
    const rating = 4.3 + ratingBase;

    // Generate a count between 100 and 300
    // parseInt(lastTwo, 16) gives 0-255.
    const count = (parseInt(lastTwo, 16) % 201) + 100;

    return {
        rating: Math.round(rating * 10) / 10,
        ratingCount: count
    };
};

/**
 * Normalizes and validates an optional external purchase URL.
 * Empty/missing values are treated as "no purchase URL" (null).
 * Only well-formed http:// and https:// URLs are accepted; unsafe
 * schemes (javascript:, data:, file:, etc.) and malformed URLs are rejected.
 */
const normalizePurchaseUrl = (value) => {
    if (value === undefined || value === null) return { ok: true, value: null };
    if (typeof value !== 'string') {
        return { ok: false, message: 'Purchase URL must be a text value' };
    }

    const trimmed = value.trim();
    if (trimmed === '') return { ok: true, value: null };

    let parsed;
    try {
        parsed = new URL(trimmed);
    } catch (e) {
        return { ok: false, message: 'Purchase URL must be a valid URL' };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { ok: false, message: 'Purchase URL must start with http:// or https://' };
    }

    return { ok: true, value: trimmed };
}

module.exports = { getStableMetrics, normalizePurchaseUrl };
