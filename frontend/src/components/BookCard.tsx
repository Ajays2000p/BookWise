import { useState, memo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { StarRating } from "@/components/StarRating";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import { Loader2, Star } from "lucide-react";
import { bookApi, resolveCoverUrl } from "@/services/api";
import type { Book } from "@/lib/mock-data";

interface BookCardProps {
  book: Book;
  compact?: boolean;
  showReason?: boolean;
  showMatch?: boolean;
  hideRatings?: boolean;
  hideRatingCount?: boolean;
  isNewArrival?: boolean;
}

export const BookCard = memo(function BookCard({ book, compact = false, showReason = false, showMatch = false, hideRatings = false, hideRatingCount = false, isNewArrival = false }: BookCardProps) {
  const navigate = useNavigate();
  const isLoggedIn = !!localStorage.getItem('token');
  const [coverSource, setCoverSource] = useState(book.coverUrl);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasError, setHasError] = useState(false);

  const displayCount = book.ratingCount !== undefined ? book.ratingCount : 0;

  const handleImageError = async () => {
    if (hasError || isGenerating) return; // Prevent infinite loops
    setHasError(true);
    setIsGenerating(true);
    try {
      const response = await bookApi.generateCover(book.id);
      if (response.data && response.data.thumbnailUrl) {
        setCoverSource(response.data.thumbnailUrl);
        setHasError(false);
      }
    } catch (e) {
      console.error("Failed to generate cover fallback for", book.id);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Link to={`/book/${book.id}`} state={{ isNewArrival }} className="book-card">
      <Card className="group overflow-hidden border bg-card hover:shadow-xl transition-all duration-300">
        <div className="relative overflow-hidden bg-muted">
          {isGenerating ? (
            <div className="w-full h-[260px] flex flex-col items-center justify-center text-muted-foreground animate-pulse p-4 text-center">
              <Loader2 className="w-6 h-6 mb-2 animate-spin text-primary" />
              <span className="text-[10px] font-medium uppercase tracking-wider">Generating Cover</span>
            </div>
          ) : (
            <img
              src={resolveCoverUrl(coverSource)}
              alt={book.title}
              onError={handleImageError}
              className="transition-transform duration-300 group-hover:scale-110"
              loading="lazy"
              decoding="async"
            />
          )}
        </div>
        <CardContent className={`p-3 flex flex-col justify-between flex-grow ${hideRatings ? 'text-center' : ''}`}>
          <div className="space-y-1">
            <h3 className="book-title">{book.title}</h3>
            <p className="book-author">{book.author}</p>
            {!hideRatings && (
              <div className="flex items-center gap-1 pt-0.5">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
                <span className="text-xs text-muted-foreground font-medium">
                  {(book.averageRating || 0).toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {!compact && !hideRatings && (
            <div className="flex flex-wrap gap-1">
              {book.genre.map((g) => (
                <span key={g} className="inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground">
                  {g}
                </span>
              ))}
            </div>
          )}
          {!hideRatings && !hideRatingCount && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Rated by {displayCount} users
            </p>
          )}
          {showReason && book.recommendationReason && (
            <p className="text-[11px] text-primary leading-tight pt-0.5">{book.recommendationReason}</p>
          )}
          {showMatch && book.matchScore && (
            <ConfidenceBar score={book.matchScore} label="Match" />
          )}
        </CardContent>
      </Card>
    </Link>
  );
});
