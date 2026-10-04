require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Book = require('../models/Book');

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPublicationDate(title, author) {
    const cleanTitle = title.replace(/\(.*?\)/g, '').trim();

    // 1. Try CrossRef API
    try {
        const url = `https://api.crossref.org/works?query.title=${encodeURIComponent(cleanTitle)}&query.author=${encodeURIComponent(author)}&rows=1`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'BookWise/1.0 (mailto:admin@BookWise.org)' },
            signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
            const data = await res.json();
            const item = data.message?.items?.[0];
            const year = item?.published?.['date-parts']?.[0]?.[0] || item?.created?.['date-parts']?.[0]?.[0] || item?.issued?.['date-parts']?.[0]?.[0];
            if (year && year >= 1800 && year <= 2026) {
                return String(year);
            }
        }
    } catch (err) {
        // Fallthrough
    }

    // 2. Try Google Books API as fallback
    try {
        const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
        const keyParam = apiKey ? `&key=${apiKey}` : '';
        const url = `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(cleanTitle)}+inauthor:${encodeURIComponent(author)}${keyParam}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
            const data = await res.json();
            const date = data.items?.[0]?.volumeInfo?.publishedDate;
            if (date) return date;
        }
    } catch (err) {
        // Fallthrough
    }

    return null;
}

async function migratePublishedDates() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB for Published Date Migration...');

        // Reset books where publishedDate = "2020-01-01"
        await Book.updateMany({ publishedDate: "2020-01-01" }, { $set: { publishedDate: null, dateMigrationAttempted: false } });

        const books = await Book.find({ dateMigrationAttempted: { $ne: true } });
        console.log(`Found ${books.length} books to process for real publication dates.`);

        let successCount = 0;
        let nullCount = 0;
        const batchSize = 10;

        for (let i = 0; i < books.length; i += batchSize) {
            const batch = books.slice(i, i + batchSize);

            await Promise.all(batch.map(async (book) => {
                const realDate = await fetchPublicationDate(book.title, book.author);
                if (realDate) {
                    book.publishedDate = realDate;
                    successCount++;
                } else {
                    book.publishedDate = null;
                    nullCount++;
                }
                book.dateMigrationAttempted = true;
                await book.save();
            }));

            const processed = Math.min(i + batchSize, books.length);
            console.log(`Processed [${processed}/${books.length}] books... (Found: ${successCount}, Unavailable: ${nullCount})`);

            await delay(100);
        }

        console.log("\n==============================================");
        console.log("PUBLISHED DATE MIGRATION COMPLETE!");
        console.log(`Successfully mapped real dates: ${successCount}`);
        console.log(`Unavailable / set to null: ${nullCount}`);
        console.log("==============================================");

        process.exit(0);
    } catch (err) {
        console.error('Migration execution error:', err);
        process.exit(1);
    }
}

migratePublishedDates();
