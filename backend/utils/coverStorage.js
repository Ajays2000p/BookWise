/**
 * utils/coverStorage.js
 * Saves book cover images to backend/public/covers/<bookId>.<ext> so they can be
 * served locally (offline) from Express at /covers/<bookId>.<ext>.
 */
const fs = require('fs');
const path = require('path');

const COVERS_DIR = path.join(__dirname, '..', 'public', 'covers');
const COVERS_URL_PREFIX = '/covers/';
const MAX_COVER_BYTES = 5 * 1024 * 1024;

// Formats admins may upload or link; downloads of Google covers also accept GIF
const UPLOAD_TYPES = ['jpg', 'png', 'webp'];
const ALL_TYPES = ['jpg', 'png', 'webp', 'gif'];
const MIME_BY_TYPE = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const TYPE_LABELS = { jpg: 'JPG', png: 'PNG', webp: 'WebP', gif: 'GIF' };

// Validation problems the admin can fix (bad type, too large, bad URL) → HTTP 400
class CoverError extends Error {}

const coverFilePath = (bookId, ext = 'jpg') => path.join(COVERS_DIR, `${bookId}.${ext}`);
const coverUrlPath = (bookId, ext = 'jpg') => `${COVERS_URL_PREFIX}${bookId}.${ext}`;

const isRemoteUrl = (url) => typeof url === 'string' && /^https?:\/\//i.test(url.trim());
const isLocalCoverPath = (url) => typeof url === 'string' && url.startsWith(COVERS_URL_PREFIX);

// Identify the image format from its bytes, never from a file name or header
const detectImageType = (buf) => {
    if (!buf || buf.length < 12) return null;
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'jpg';
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'png';
    if (buf.subarray(0, 4).toString('latin1') === 'GIF8') return 'gif';
    if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
    return null;
};

/** The saved cover file for a book, whatever its extension, or null. */
const findLocalCover = (bookId) => {
    for (const ext of ALL_TYPES) {
        try {
            if (fs.statSync(coverFilePath(bookId, ext)).size > 0) return { ext, urlPath: coverUrlPath(bookId, ext) };
        } catch {
            // Not saved with this extension
        }
    }
    return null;
};

const hasLocalCover = (bookId) => findLocalCover(bookId) !== null;

const deleteLocalCover = (bookId) => {
    for (const ext of ALL_TYPES) {
        try {
            fs.unlinkSync(coverFilePath(bookId, ext));
        } catch {
            // No cover with this extension
        }
    }
};

/**
 * Save image bytes as the book's cover, replacing any previous cover file.
 * Writes to a temp file first, so an interrupted save never leaves a partial file.
 * Resolves to the relative URL path, e.g. "/covers/<bookId>.png".
 */
const saveCover = (buf, bookId, { allowedTypes = UPLOAD_TYPES } = {}) => {
    if (buf.length > MAX_COVER_BYTES) throw new CoverError('Cover image must be 5 MB or smaller');
    const ext = detectImageType(buf);
    if (!ext || !allowedTypes.includes(ext)) {
        const names = allowedTypes.map(t => TYPE_LABELS[t]);
        throw new CoverError(`Cover must be a ${names.slice(0, -1).join(', ')} or ${names[names.length - 1]} image`);
    }

    fs.mkdirSync(COVERS_DIR, { recursive: true });
    const finalPath = coverFilePath(bookId, ext);
    const tempPath = `${finalPath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, buf);
    for (const other of ALL_TYPES) {
        if (other !== ext) {
            try { fs.unlinkSync(coverFilePath(bookId, other)); } catch { /* none */ }
        }
    }
    fs.renameSync(tempPath, finalPath);

    return coverUrlPath(bookId, ext);
};

/** Download a cover image once and save it locally. Throws on failure. */
const downloadCover = async (url, bookId, { timeoutMs = 15000, allowedTypes = UPLOAD_TYPES, fetchImpl = fetch } = {}) => {
    if (!isRemoteUrl(url)) throw new CoverError('Cover URL must start with http:// or https://');

    let res;
    try {
        res = await fetchImpl(url.trim(), {
            redirect: 'follow',
            signal: AbortSignal.timeout(timeoutMs),
            headers: { 'User-Agent': 'Mozilla/5.0 (BookWise cover downloader)' }
        });
    } catch (err) {
        throw new CoverError(`Could not reach the image URL (${err.message})`);
    }
    if (!res.ok) throw new CoverError(`Image URL returned HTTP ${res.status}`);

    const declared = Number(res.headers.get('content-length'));
    if (declared > MAX_COVER_BYTES) throw new CoverError('Cover image must be 5 MB or smaller');

    const buf = Buffer.from(await res.arrayBuffer());
    if (!detectImageType(buf)) {
        throw new CoverError(`URL did not return an image (${res.headers.get('content-type') || 'unknown type'}, ${buf.length} bytes)`);
    }
    return saveCover(buf, bookId, { allowedTypes });
};

module.exports = {
    COVERS_DIR,
    MAX_COVER_BYTES,
    UPLOAD_TYPES,
    ALL_TYPES,
    MIME_BY_TYPE,
    CoverError,
    coverFilePath,
    coverUrlPath,
    isRemoteUrl,
    isLocalCoverPath,
    detectImageType,
    findLocalCover,
    hasLocalCover,
    deleteLocalCover,
    saveCover,
    downloadCover
};
