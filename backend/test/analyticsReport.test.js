const test = require('node:test');
const assert = require('node:assert');
const { csvField, toCsv } = require('../utils/analyticsReport');

const data = {
    totalUsers: 1522,
    totalBooks: 2999,
    totalRatings: 40554,
    popularGenres: [{ genre: 'Fiction', ratingCount: 24867 }],
    mostRatedBooks: [{ rank: 1, title: 'Leon the Lion', author: 'Julie Mannino', ratingCount: 54 }],
    highestRatedBooks: [{ rank: 1, title: 'Ghost (Track, #1)', author: 'Jason Reynolds', averageRating: 4.8 }]
};

test('csvField quotes values containing commas, quotes or line breaks', () => {
    assert.strictEqual(csvField('Plain title'), 'Plain title');
    assert.strictEqual(csvField('Ghost (Track, #1)'), '"Ghost (Track, #1)"');
    assert.strictEqual(csvField('The "Best" Book'), '"The ""Best"" Book"');
    assert.strictEqual(csvField('Line\nBreak'), '"Line\nBreak"');
    assert.strictEqual(csvField(54), '54');
});

test('toCsv keeps titles with commas in a single column', () => {
    const csv = toCsv(data, '2026-10-14');
    assert.match(csv, /^1,"Ghost \(Track, #1\)",Jason Reynolds,4\.8$/m);
    assert.doesNotMatch(csv, /GENRE DISTRIBUTION/);
});
