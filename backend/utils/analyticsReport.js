/**
 * utils/analyticsReport.js
 * Renders the admin analytics export as CSV.
 *
 * data: { totalUsers, totalBooks, totalRatings, popularGenres, mostRatedBooks, highestRatedBooks }
 */

// Quote fields containing commas, quotes or line breaks (RFC 4180)
const csvField = (value) => {
    const s = String(value ?? '');
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const csvRow = (...fields) => fields.map(csvField).join(',') + '\n';

const toCsv = (data, dateStr) => {
    let csv = 'BookWise Analytics Export\n';
    csv += csvRow('Generated Date: ' + dateStr) + '\n';

    csv += '=== OVERVIEW STATISTICS ===\n';
    csv += csvRow('Total Users', data.totalUsers);
    csv += csvRow('Total Books', data.totalBooks);
    csv += csvRow('Total Ratings', data.totalRatings) + '\n';

    csv += '=== MOST POPULAR GENRES (by Ratings) ===\n';
    csv += csvRow('Genre', 'Rating Count');
    data.popularGenres.forEach(g => { csv += csvRow(g.genre, g.ratingCount); });
    csv += '\n';

    csv += '=== TOP 10 MOST RATED BOOKS ===\n';
    csv += csvRow('Rank', 'Book Title', 'Author', 'Ratings Count');
    data.mostRatedBooks.forEach(b => { csv += csvRow(b.rank, b.title, b.author, b.ratingCount); });
    csv += '\n';

    csv += '=== TOP 10 HIGHEST RATED BOOKS ===\n';
    csv += csvRow('Rank', 'Book Title', 'Author', 'Average Rating');
    data.highestRatedBooks.forEach(b => { csv += csvRow(b.rank, b.title, b.author, b.averageRating); });

    return csv;
};

module.exports = { csvField, toCsv };
