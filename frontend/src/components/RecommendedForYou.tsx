import { useEffect, useState, useRef, useMemo, memo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Sparkles, Loader2, Star } from "lucide-react";
import { bookApi, resolveCoverUrl } from "@/services/api";
import { Link } from "react-router-dom";

interface RecommendedBook {
    _id: string;
    title: string;
    author: string;
    thumbnailUrl: string;
    realCoverImage?: string;
    genres: string[];
    averageRating: number;
    ratingCount: number;
    popularityScore?: number;
}

export const RecommendedForYou = memo(function RecommendedForYou() {
    const [books, setBooks] = useState<RecommendedBook[]>([]);
    const [loading, setLoading] = useState(true);
    const [ratedBooksCount, setRatedBooksCount] = useState(0);
    const [thresholdMet, setThresholdMet] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchRecommendations = async () => {
        try {
            setLoading(true);
            const { data } = await bookApi.getPersonalizedRecommendations();
            setBooks(data.books || []);
            setRatedBooksCount(data.ratedBooksCount || 0);
            setThresholdMet(data.thresholdMet || false);
        } catch (error) {
            console.error("Failed to fetch personalized recommendations:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecommendations();

        const handleRatingUpdate = () => {
            fetchRecommendations();
        };

        window.addEventListener("ratingUpdated", handleRatingUpdate);
        window.addEventListener("recommendationsUpdated", handleRatingUpdate);

        return () => {
            window.removeEventListener("ratingUpdated", handleRatingUpdate);
            window.removeEventListener("recommendationsUpdated", handleRatingUpdate);
        };
    }, []);

    const visibleBooks = useMemo(() => {
        return (books || []).slice(0, 10);
    }, [books]);

    const scrollLeft = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft -= 300;
        }
    };

    const scrollRight = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft += 300;
        }
    };

    if (!loading && (!thresholdMet || books.length === 0)) return null;

    return (
        <section className="space-y-6">
            <div className="section-header">
                <div className="flex items-center gap-2">
                    <Sparkles size={20} className="text-primary" />
                    <h2 className="text-foreground tracking-tight">Recommended for You</h2>
                </div>
                <div className="arrow-controls">
                    <button onClick={scrollLeft}>‹</button>
                    <button onClick={scrollRight}>›</button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="carousel-wrapper">
                    <div
                        ref={scrollRef}
                        className="carousel"
                    >
                    {visibleBooks.map((book) => (
                        <Link
                            key={book._id}
                            to={`/book/${book._id}`}
                            className="book-card group"
                        >
                            <Card className="overflow-hidden border bg-card hover:shadow-xl transition-all duration-300 relative h-full">
                                <div className="overflow-hidden">
                                    <img
                                        src={resolveCoverUrl(book.realCoverImage || book.thumbnailUrl) || "/placeholder.svg"}
                                        alt={book.title}
                                        onError={(e) => {
                                            // Fall back once to the canvas-generated cover
                                            const fallback = resolveCoverUrl(book.thumbnailUrl);
                                            if (fallback && e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
                                        }}
                                        className="transition-transform duration-500 group-hover:scale-110"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                </div>

                                <CardContent className="p-3.5 flex flex-col justify-between flex-grow">
                                    <div className="space-y-1">
                                        <h3 className="book-title group-hover:text-primary transition-colors">
                                            {book.title}
                                        </h3>
                                        <p className="book-author" title={book.author}>
                                            {book.author}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                    </div>
                </div>
            )}
        </section>
    );
});
