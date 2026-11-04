const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const {
    downloadCover, saveCover, findLocalCover, hasLocalCover, coverFilePath, deleteLocalCover,
    isRemoteUrl, detectImageType, ALL_TYPES, MAX_COVER_BYTES, CoverError
} = require('../utils/coverStorage');

const TEST_ID = 'test-cover-000000000000';
const pad = (header) => Buffer.concat([header, Buffer.alloc(16)]);
const JPEG = pad(Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]));
const PNG = pad(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
const WEBP = pad(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]));
const GIF = pad(Buffer.from('GIF89a'));

const fakeFetch = (status, body, contentType = 'image/jpeg') => async () => ({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h) => (h === 'content-type' ? contentType : String(body.length)) },
    arrayBuffer: async () => body
});

test.afterEach(() => deleteLocalCover(TEST_ID));

test('detectImageType reads the format from the file bytes', () => {
    assert.strictEqual(detectImageType(JPEG), 'jpg');
    assert.strictEqual(detectImageType(PNG), 'png');
    assert.strictEqual(detectImageType(WEBP), 'webp');
    assert.strictEqual(detectImageType(GIF), 'gif');
    assert.strictEqual(detectImageType(pad(Buffer.from('<html>'))), null);
});

test('downloadCover saves the image as <bookId>.<ext> and returns the /covers path', async () => {
    const result = await downloadCover('https://books.google.com/x', TEST_ID, { fetchImpl: fakeFetch(200, JPEG) });
    assert.strictEqual(result, `/covers/${TEST_ID}.jpg`);
    assert.deepStrictEqual(fs.readFileSync(coverFilePath(TEST_ID, 'jpg')), JPEG);
});

test('saving a new cover replaces the old file, even with a different extension', () => {
    saveCover(JPEG, TEST_ID);
    const result = saveCover(PNG, TEST_ID);
    assert.strictEqual(result, `/covers/${TEST_ID}.png`);
    assert.strictEqual(fs.existsSync(coverFilePath(TEST_ID, 'jpg')), false);
    assert.deepStrictEqual(findLocalCover(TEST_ID), { ext: 'png', urlPath: `/covers/${TEST_ID}.png` });

    assert.strictEqual(saveCover(WEBP, TEST_ID), `/covers/${TEST_ID}.webp`);
    assert.strictEqual(fs.existsSync(coverFilePath(TEST_ID, 'png')), false);
});

test('uploads accept only JPG, PNG and WebP up to 5 MB', () => {
    assert.throws(() => saveCover(GIF, TEST_ID), CoverError);
    assert.throws(() => saveCover(pad(Buffer.from('not an image')), TEST_ID), CoverError);
    const tooBig = Buffer.concat([JPEG, Buffer.alloc(MAX_COVER_BYTES)]);
    assert.throws(() => saveCover(tooBig, TEST_ID), /5 MB/);
    assert.strictEqual(hasLocalCover(TEST_ID), false);

    // The bulk download script also accepts GIF covers
    assert.strictEqual(saveCover(GIF, TEST_ID, { allowedTypes: ALL_TYPES }), `/covers/${TEST_ID}.gif`);
});

test('downloadCover rejects HTML pages, HTTP errors and non-http URLs without writing a file', async () => {
    await assert.rejects(
        downloadCover('https://example.com/x', TEST_ID, { fetchImpl: fakeFetch(200, pad(Buffer.from('<html>blocked</html>')), 'text/html') }),
        /did not return an image/
    );
    await assert.rejects(
        downloadCover('https://example.com/x', TEST_ID, { fetchImpl: fakeFetch(404, Buffer.alloc(0)) }),
        /HTTP 404/
    );
    await assert.rejects(downloadCover('ftp://example.com/x.jpg', TEST_ID), CoverError);
    assert.strictEqual(hasLocalCover(TEST_ID), false);
});

test('only http(s) URLs are treated as remote covers', () => {
    assert.ok(isRemoteUrl('https://books.google.com/books/content?id=1'));
    assert.ok(isRemoteUrl('http://example.com/a.jpg'));
    assert.ok(!isRemoteUrl('/covers/abc.jpg'));
    assert.ok(!isRemoteUrl('data:image/png;base64,AAAA'));
    assert.ok(!isRemoteUrl(null));
});
