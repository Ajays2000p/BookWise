export interface Book {
  id: string;
  title: string;
  author: string;
  genre: string[];
  description: string;
  coverUrl: string;
  realCoverImage?: string;
  averageRating: number;
  ratingCount: number;
  publishedDate: string;
  pages: number;
  popularityScore?: number;
  purchaseUrl?: string;
  matchScore?: number;
  recommendationReason?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  joinedDate: string;
  isAdmin: boolean;
  role?: string;
}

export interface Rating {
  id: string;
  userId: string;
  bookId: string;
  rating: number;
  createdAt: string;
}

const genres = [
  "Fiction", "Mystery", "Romance",
  "Fantasy", "Horror", "Biography", "History",
  "Psychology", "Adventure", "Drama"
];

import rawEnrichedData from "../data/enriched.json";

// Process raw data to match Book interface
const processedBooks: Book[] = (rawEnrichedData as any[]).map((rawBook: any, index: number) => ({
  id: String(index + 1),
  title: rawBook.title || "Unknown Title",
  author: rawBook.author || "Unknown Author",
  genre: rawBook.genres || ["Unknown"],
  description: rawBook.description || "No description available.",
  coverUrl: rawBook.realCoverImage || rawBook.thumbnailUrl || "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=400&fit=crop",
  averageRating: rawBook.rating || 0,
  ratingCount: rawBook.ratingCount || 0,
  publishedDate: "2020-01-01", // Default fallback if not in JSON
  pages: 300,                  // Default fallback
  popularityScore: rawBook.popularityScore || 0,
  matchScore: Math.floor(50 + Math.random() * 50), // Mock match score
  recommendationReason: "We think you'll like this",
}));

export const mockBooks: Book[] = processedBooks;


export const mockUser: User = {
  id: "user-1",
  name: "Alex Johnson",
  email: "alex@example.com",
  avatar: "",
  joinedDate: "2024-06-15",
  isAdmin: false,
};

export const mockRatings: Rating[] = [
  { id: "r1", userId: "user-1", bookId: "1", rating: 4, createdAt: "2024-12-01" },
  { id: "r2", userId: "user-1", bookId: "3", rating: 5, createdAt: "2024-12-05" },
  { id: "r3", userId: "user-1", bookId: "5", rating: 5, createdAt: "2024-12-10" },
  { id: "r4", userId: "user-1", bookId: "9", rating: 4, createdAt: "2025-01-02" },
];

export function getBooksByGenre(genre: string): Book[] {
  return mockBooks.filter((b) => b.genre.includes(genre));
}

export function getPopularBooks(): Book[] {
  return [...mockBooks].sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0)).slice(0, 6);
}

export function getRecommendedBooks(): Book[] {
  return [...mockBooks].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0)).slice(0, 6);
}

export function getSimilarBooks(bookId: string): Book[] {
  const book = mockBooks.find(b => b.id === bookId);
  if (!book) return [];
  return mockBooks
    .filter(b => b.id !== bookId && b.genre.some(g => book.genre.includes(g)))
    .slice(0, 4);
}

export function getMultiGenreBooks(userGenres: string[]): Book[] {
  return mockBooks
    .filter(b => b.genre.some(g => userGenres.includes(g)))
    .slice(0, 6);
}

export function getBookById(id: string): Book | undefined {
  return mockBooks.find((b) => b.id === id);
}

export { genres };
