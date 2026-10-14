const test = require('node:test');
const assert = require('node:assert');
const { fetchMlRecommendationIds, mergeRecommendations } = require('../utils/recommendationHelpers');

const book = (id, score) => ({ _id: id, title: `Book ${id}`, compositeScore: score });
const scored = [book('a', 9), book('b', 8), book('c', 7), book('d', 6), book('e', 5)];

test('ML-ranked books come first, genre-scored books fill the rest', () => {
    const { books, mlCount } = mergeRecommendations(['d', 'b'], scored, 4);
    assert.deepStrictEqual(books.map(b => b._id), ['d', 'b', 'a', 'c']);
    assert.strictEqual(mlCount, 2);
});

test('ML ids not among candidates (rated / not interested) are skipped', () => {
    const { books, mlCount } = mergeRecommendations(['zzz', 'c'], scored, 3);
    assert.deepStrictEqual(books.map(b => b._id), ['c', 'a', 'b']);
    assert.strictEqual(mlCount, 1);
});

test('no ML results falls back to pure genre ranking', () => {
    const { books, mlCount } = mergeRecommendations([], scored, 3);
    assert.deepStrictEqual(books.map(b => b._id), ['a', 'b', 'c']);
    assert.strictEqual(mlCount, 0);
});

test('ML results are capped at the limit without duplicates', () => {
    const { books, mlCount } = mergeRecommendations(['a', 'a', 'b', 'c', 'd'], scored, 2);
    assert.deepStrictEqual(books.map(b => b._id), ['a', 'b']);
    assert.strictEqual(mlCount, 2);
});

test('fetchMlRecommendationIds returns algorithm and ids from the ML service', async () => {
    const fakeFetch = async (url) => {
        assert.match(url, /\/recommend\/personalized\?userId=u1&limit=40$/);
        return { ok: true, json: async () => ({ algorithm: 'ALS', bookIds: ['x', 'y'] }) };
    };
    assert.deepStrictEqual(await fetchMlRecommendationIds('u1', 40, fakeFetch), { algorithm: 'ALS', bookIds: ['x', 'y'] });
});

test('fetchMlRecommendationIds returns null when the ML service is down or has no result', async () => {
    const down = async () => { throw new Error('ECONNREFUSED'); };
    const error = async () => ({ ok: false });
    const empty = async () => ({ ok: true, json: async () => ({ algorithm: null, bookIds: [] }) });
    assert.strictEqual(await fetchMlRecommendationIds('u1', 40, down), null);
    assert.strictEqual(await fetchMlRecommendationIds('u1', 40, error), null);
    assert.strictEqual(await fetchMlRecommendationIds('u1', 40, empty), null);
});
