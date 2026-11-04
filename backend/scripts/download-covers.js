/**
 * scripts/download-covers.js
 * One-time (safely re-runnable) download of original book covers for offline use.
 *
 * For every book whose original cover is an internet URL (e.g. books.google.com):
 *   1. saves the image to backend/public/covers/<bookId>.jpg
 *      (Google covers are JPEG; another format keeps its own extension, e.g. .png)
 *   2. sets realCoverImage = "/covers/<bookId>.jpg" and keeps the source in originalCoverUrl
 * Books without an original cover keep their canvas-generated cover (thumbnailUrl).
 * Books already showing a local cover, including ones uploaded by an admin, are left alone.
 *
 * Usage (from the backend folder):
 *   node scripts/download-covers.js                 download all missing covers
 *   node scripts/download-covers.js --dry-run       only report what would happen
 *   node scripts/download-covers.js --limit 20      process at most 20 books
 *   node scripts/download-covers.js --concurrency 4 parallel downloads (default 6)
 *   node scripts/download-covers.js --restore backups/covers-backup-<time>.json
 *                                                   put realCoverImage back as in a backup
 *
 * Re-running skips books whose file already exists. Before changing anything, the
 * current realCoverImage / originalCoverUrl values are saved to backend/backups/.
 * Failed downloads are listed in backend/logs/cover-download-failures-<time>.log.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Book = require('../models/Book');
const {
    COVERS_DIR, ALL_TYPES, isRemoteUrl, isLocalCoverPath, findLocalCover, downloadCover
} = require('../utils/coverStorage');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const LOG_DIR = path.join(__dirname, '..', 'logs');

const args = process.argv.slice(2);
const argValue = (name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
const DRY_RUN = args.includes('--dry-run');
const LIMIT = parseInt(argValue('--limit'), 10) || Infinity;
const CONCURRENCY = Math.max(1, parseInt(argValue('--concurrency'), 10) || 6);
const RESTORE_FILE = argValue('--restore');
const ATTEMPTS = 3;

const timestamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const downloadWithRetry = async (url, bookId) => {
    let lastErr;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        try {
            return await downloadCover(url, bookId, { allowedTypes: ALL_TYPES });
        } catch (err) {
            lastErr = err;
            if (attempt < ATTEMPTS) {
                // Back off longer when rate limited
                await sleep(/HTTP 429/.test(err.message) ? 5000 * attempt : 1000 * attempt);
            }
        }
    }
    throw lastErr;
};

// Run worker over items with a fixed number of parallel tasks
const runPool = async (items, worker) => {
    let next = 0;
    const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
        while (next < items.length) {
            const item = items[next++];
            await worker(item);
        }
    });
    await Promise.all(runners);
};

const backupCoverFields = (books) => {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const file = path.join(BACKUP_DIR, `covers-backup-${timestamp()}.json`);
    const data = books.map(b => ({
        _id: String(b._id),
        title: b.title,
        realCoverImage: b.realCoverImage ?? null,
        originalCoverUrl: b.originalCoverUrl ?? null
    }));
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return file;
};

const restore = async (file) => {
    const entries = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
    const ops = entries.map(e => ({
        updateOne: {
            filter: { _id: e._id },
            update: { $set: { realCoverImage: e.realCoverImage, originalCoverUrl: e.originalCoverUrl } }
        }
    }));
    const result = await Book.bulkWrite(ops, { ordered: false });
    console.log(`Restored cover fields for ${result.modifiedCount} of ${entries.length} books from ${file}`);
    console.log('Downloaded files in public/covers were left in place.');
};

const main = async () => {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB:', mongoose.connection.name);

    if (RESTORE_FILE) {
        await restore(RESTORE_FILE);
        return;
    }

    const books = await Book.find({}, '_id title realCoverImage originalCoverUrl').lean();

    // Books already showing a local cover (downloaded earlier or uploaded by an admin) are
    // left alone. Others download from the saved original, else a remote realCoverImage.
    const withSource = [];
    let alreadyLocal = 0;
    let noOriginal = 0;
    for (const b of books) {
        if (isLocalCoverPath(b.realCoverImage) && findLocalCover(b._id)) {
            alreadyLocal++;
            continue;
        }
        const source = isRemoteUrl(b.originalCoverUrl) ? b.originalCoverUrl
            : isRemoteUrl(b.realCoverImage) ? b.realCoverImage
            : null;
        if (source) withSource.push({ book: b, source });
        else noOriginal++;
    }

    const toProcess = withSource.slice(0, LIMIT);

    console.log(`Books: ${books.length} | already local: ${alreadyLocal} | to download: ${withSource.length} | no original cover (keep canvas cover): ${noOriginal}`);
    console.log(`Processing ${toProcess.length} into ${COVERS_DIR}`);

    if (DRY_RUN) {
        console.log('Dry run: nothing downloaded or changed.');
        return;
    }

    const backupFile = backupCoverFields(books);
    console.log(`Backup of current cover fields: ${backupFile}`);

    const stats = { downloaded: 0, skipped: 0, linked: 0, failed: 0 };
    const failures = [];
    let done = 0;

    await runPool(toProcess, async ({ book, source }) => {
        const id = String(book._id);
        try {
            // A file saved by an earlier, interrupted run only needs linking
            const existing = findLocalCover(id);
            let localPath;
            if (existing) {
                localPath = existing.urlPath;
                stats.skipped++;
            } else {
                localPath = await downloadWithRetry(source, id);
                stats.downloaded++;
            }
            if (book.realCoverImage !== localPath || book.originalCoverUrl !== source) {
                await Book.updateOne({ _id: book._id }, { $set: { realCoverImage: localPath, originalCoverUrl: source } });
                stats.linked++;
            }
        } catch (err) {
            // realCoverImage is left unchanged, so this book still shows its online cover
            // (or the canvas cover when offline)
            stats.failed++;
            failures.push({ _id: id, title: book.title, url: source, error: err.message });
        }

        done++;
        if (done % 100 === 0 || done === toProcess.length) {
            console.log(`  ${done}/${toProcess.length} — downloaded ${stats.downloaded}, skipped ${stats.skipped}, failed ${stats.failed}`);
        }
    });

    console.log(`\nDone. Downloaded: ${stats.downloaded} | already had file: ${stats.skipped} | database updated: ${stats.linked} | failed: ${stats.failed}`);

    if (failures.length > 0) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        const logFile = path.join(LOG_DIR, `cover-download-failures-${timestamp()}.log`);
        fs.writeFileSync(logFile, failures.map(f => `${f._id}\t${f.title}\t${f.url}\t${f.error}`).join('\n') + '\n');
        console.log(`Failed downloads listed in: ${logFile}`);
        console.log('Re-run the script to retry them; finished covers are skipped.');
    }
};

main()
    .catch(err => {
        console.error('Cover download failed:', err);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
