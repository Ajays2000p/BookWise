import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { StarRating } from "@/components/StarRating";
import { BookCard } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Bookmark, Heart, BookCheck, ShoppingBag, ExternalLink, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { bookApi, ratingApi, mlApi, userApi } from "@/services/api";
import { sanitizePurchaseUrl } from "@/lib/utils";
import { BookMetadata } from "@/components/BookMetadata";
import { useAuth } from "@/contexts/AuthContext";

// High-performance client-side in-memory cache for instant rendering
const clientBookCache = new Map<string, { mappedBook: any; timestamp: number }>();
const inFlightRequests = new Map<string, Promise<any>>();

export default function BookDetails() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const isNewArrivalFromState = location.state?.isNewArrival;
  const [book, setBook] = useState<any>(null);
  const [similarBooks, setSimilarBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [userRating, setUserRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [coverSource, setCoverSource] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isNotInterested, setIsNotInterested] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [checkingRating, setCheckingRating] = useState(!!localStorage.getItem('token'));
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;

    // Reset state for new book ID
    setUserRating(0);
    setSubmitted(false);
    setCheckingRating(!!localStorage.getItem('token'));
    setIsBookmarked(false);
    setIsFavorite(false);
    setIsFinished(false);
    setIsNotInterested(false);
    setSimilarBooks([]);
    setHasError(false);

    // 1. Instant Cache Check
    const cachedEntry = clientBookCache.get(id);
    const isCacheValid = cachedEntry && (Date.now() - cachedEntry.timestamp < 300000); // 5 min TTL

    if (cachedEntry) {
      setBook(cachedEntry.mappedBook);
      setCoverSource(cachedEntry.mappedBook.coverUrl);
      setLoading(false); // Render UI immediately from cache!
    } else {
      setLoading(true);
    }

    // Function to load non-essential information in background (parallel & non-blocking)
    const loadSecondaryDetails = () => {
      // Fetch user's rating & bookmark/favorite status (only if authenticated)
      if (localStorage.getItem('token')) {
        ratingApi.getUserRating(id)
          .then((ratingRes) => {
            if (mountedRef.current && ratingRes.data && ratingRes.data.value > 0) {
              setUserRating(ratingRes.data.value);
              setSubmitted(true);
            }
          })
          .catch((e) => console.error("Failed to fetch user rating", e))
          .finally(() => {
            if (mountedRef.current) setCheckingRating(false);
          });

        userApi.getBookStatus(id)
          .then((statusRes) => {
            if (mountedRef.current && statusRes.data) {
              setIsBookmarked(!!statusRes.data.isBookmarked);
              setIsFavorite(!!statusRes.data.isFavorite);
              setIsFinished(!!statusRes.data.isFinished);
              setIsNotInterested(!!statusRes.data.isNotInterested);
            }
          })
          .catch((e) => console.error("Failed to fetch book status", e));
      }

      // Fetch similar books from ML engine (logged-in readers only, independent failure)
      if (localStorage.getItem('token')) {
        mlApi.getSimilar(id, { limit: 4 })
          .then((similarRes) => {
            if (mountedRef.current && Array.isArray(similarRes.data)) {
              setSimilarBooks(similarRes.data.map((b: any) => ({
                ...b,
                id: b._id,
                genre: b.genres,
                coverUrl: b.realCoverImage || b.thumbnailUrl,
                averageRating: b.rating,
                matchScore: b.similarityScore
              })));
            }
          })
          .catch((e) => {
            console.error("Failed to fetch similar books", e);
            if (mountedRef.current) setSimilarBooks([]);
          });
      }
    };

    // 2. Fetch Essential Book Data First (Deduplicated)
    const fetchEssentialBook = async () => {
      try {
        let requestPromise = inFlightRequests.get(id);
        if (!requestPromise) {
          requestPromise = bookApi.getById(id);
          inFlightRequests.set(id, requestPromise);
        }

        const bookRes = await requestPromise;
        inFlightRequests.delete(id);

        if (!mountedRef.current) return;

        const mappedBook = {
          ...bookRes.data,
          id: bookRes.data?._id,
          genre: bookRes.data?.genres || [],
          coverUrl: bookRes.data?.realCoverImage || bookRes.data?.thumbnailUrl || "/placeholder.svg",
          averageRating: bookRes.data?.rating || 0,
          ratingCount: bookRes.data?.ratingCount || 0
        };

        clientBookCache.set(id, { mappedBook, timestamp: Date.now() });

        setBook(mappedBook);
        setCoverSource(mappedBook.coverUrl);
        setLoading(false); // Essential data loaded! Turn off spinner immediately.

        // Trigger secondary non-blocking fetches after essential data is shown
        loadSecondaryDetails();
      } catch (error) {
        inFlightRequests.delete(id);
        if (!mountedRef.current) return;

        console.error("Error loading book details:", error);
        toast({ title: "Failed to load book details", variant: "destructive" });
        setLoading(false); // Ensure spinner is removed on error
      }
    };

    if (cachedEntry && isCacheValid) {
      // If we used fresh cache, just load secondary details in background
      loadSecondaryDetails();
    } else {
      fetchEssentialBook();
    }
  }, [id]);

  const submitRating = async () => {
    if (userRating === 0) { toast({ title: "Select a rating first", variant: "destructive" }); return; }
    try {
      setSubmittingRating(true);
      const ratingRes = await ratingApi.submit(id!, userRating);
      setSubmitted(true);
      window.dispatchEvent(new CustomEvent("ratingUpdated", { detail: { bookId: id, rating: userRating } }));
      window.dispatchEvent(new CustomEvent("recommendationsUpdated"));
      
      // Invalidate cache for this book ID
      if (id) {
        clientBookCache.delete(id);

        // Immediate state update if backend response contains updated stats
        if (ratingRes.data?.ratingCount !== undefined && ratingRes.data?.averageRating !== undefined) {
          setBook((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              averageRating: ratingRes.data.averageRating,
              ratingCount: ratingRes.data.ratingCount
            };
          });
        }

        const updatedRes = await bookApi.getById(id);
        if (updatedRes.data && mountedRef.current) {
          const updatedMapped = {
            ...updatedRes.data,
            id: updatedRes.data._id,
            genre: updatedRes.data.genres || [],
            coverUrl: updatedRes.data.realCoverImage || updatedRes.data.thumbnailUrl || "/placeholder.svg",
            averageRating: updatedRes.data.rating || 0,
            ratingCount: updatedRes.data.ratingCount || 0
          };
          clientBookCache.set(id, { mappedBook: updatedMapped, timestamp: Date.now() });
          setBook(updatedMapped);
        }
      }

      toast({ title: `Rated ${userRating} stars!` });
    } catch (error) {
      toast({ title: "Failed to submit rating", variant: "destructive" });
    } finally {
      if (mountedRef.current) setSubmittingRating(false);
    }
  };

  const handleToggleBookmark = async () => {
    if (!localStorage.getItem('token')) {
      toast({ title: "Please sign in to bookmark books", variant: "destructive" });
      return;
    }
    const previous = isBookmarked;
    setIsBookmarked(!previous);
    try {
      setActionLoading(true);
      const res = await userApi.toggleBookmark(id!);
      setIsBookmarked(res.data.isBookmarked);
      toast({ title: res.data.message || (res.data.isBookmarked ? "Bookmarked!" : "Removed bookmark") });
    } catch (error) {
      setIsBookmarked(previous);
      toast({ title: "Failed to update bookmark", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!localStorage.getItem('token')) {
      toast({ title: "Please sign in to add favorites", variant: "destructive" });
      return;
    }
    const previous = isFavorite;
    setIsFavorite(!previous);
    try {
      setActionLoading(true);
      const res = await userApi.toggleFavorite(id!);
      setIsFavorite(res.data.isFavorite);
      toast({ title: res.data.message || (res.data.isFavorite ? "Added to favorites!" : "Removed favorite") });
    } catch (error) {
      setIsFavorite(previous);
      toast({ title: "Failed to update favorite", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleFinished = async () => {
    if (!localStorage.getItem('token')) {
      toast({ title: "Please sign in to mark books as finished", variant: "destructive" });
      return;
    }
    const previousFinished = isFinished;
    const previousBookmarked = isBookmarked;

    const nextFinished = !previousFinished;
    setIsFinished(nextFinished);
    if (nextFinished && previousBookmarked) {
      setIsBookmarked(false); // Automatically remove bookmark visually if marking finished
    }

    try {
      setActionLoading(true);
      const res = await userApi.toggleFinished(id!);
      setIsFinished(res.data.isFinished);
      if (res.data.isBookmarked !== undefined) {
        setIsBookmarked(res.data.isBookmarked);
      }
      toast({ title: res.data.message || (res.data.isFinished ? "Marked as finished!" : "Removed from finished") });
    } catch (error) {
      setIsFinished(previousFinished);
      setIsBookmarked(previousBookmarked);
      toast({ title: "Failed to update finished status", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleNotInterested = async () => {
    if (!localStorage.getItem('token')) {
      toast({ title: "Please sign in to set preferences", variant: "destructive" });
      return;
    }
    const previous = isNotInterested;
    const nextNotInterested = !previous;
    setIsNotInterested(nextNotInterested);

    try {
      setActionLoading(true);
      const res = await userApi.toggleNotInterested(id!);
      setIsNotInterested(res.data.isNotInterested);
      window.dispatchEvent(new CustomEvent("recommendationsUpdated"));
      toast({
        title: res.data.message || (res.data.isNotInterested ? "Marked as Not Interested" : "Removed from Not Interested")
      });
    } catch (error) {
      setIsNotInterested(previous);
      toast({ title: "Failed to update preference", variant: "destructive" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleImageError = async () => {
    if (hasError || isGenerating) return; // Prevent infinite loops
    setHasError(true);
    setIsGenerating(true);
    try {
      const response = await bookApi.generateCover(book.id);
      if (response.data && response.data.thumbnailUrl && mountedRef.current) {
        setCoverSource(response.data.thumbnailUrl);
        setHasError(false);
      }
    } catch (e) {
      console.error("Failed to generate cover fallback for", book.id);
    } finally {
      if (mountedRef.current) setIsGenerating(false);
    }
  };

  if (loading || !book) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="animate-spin h-8 w-8 text-primary" />
          <p className="text-muted-foreground animate-pulse text-sm">Loading book details...</p>
        </div>
      </div>
    );
  }

  const isNewArrival =
    (book?.popularityScore || 0) >= 200 &&
    (book?.popularityScore || 0) <= 300 &&
    (book?.ratingCount || 0) >= 30 &&
    (book?.ratingCount || 0) <= 50;

  return (
    <div className="min-h-screen bg-background w-full">
      <Navbar />
      <main className="w-full min-h-screen flex flex-col px-6 lg:px-10 py-8">
        <button 
          onClick={() => {
            if (window.history.state && window.history.state.idx > 0) {
              navigate(-1);
            } else {
              navigate("/browse");
            }
          }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6 bg-transparent border-0 p-0 cursor-pointer w-fit"
        >
          <ArrowLeft size={14} /> Back
        </button>

        {/* Two-column layout */}
        <div className="grid md:grid-cols-[280px_1fr] gap-8">
          {/* Left Column: Cover & Centered Action Group */}
          <div className="flex flex-col items-center w-full max-w-[280px] mx-auto sm:mx-0 space-y-3">
            <div className="w-full rounded-lg shadow-sm overflow-hidden aspect-[3/4] bg-muted relative">
              {isGenerating ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground animate-pulse p-4 text-center">
                  <Loader2 className="w-8 h-8 mb-3 animate-spin text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-widest">Generating Cover</span>
                </div>
              ) : (
                <img 
                  src={coverSource} 
                  alt={book.title} 
                  onError={handleImageError}
                  className="w-full h-full object-cover" 
                />
              )}
            </div>

            {/* Balanced Action Group: 3 Icons under cover */}
            <div className="flex items-center justify-center gap-3.5 w-full pt-1">
              <Button
                variant={isBookmarked ? "default" : "outline"}
                size="icon"
                onClick={handleToggleBookmark}
                disabled={actionLoading}
                title={isBookmarked ? "Remove Bookmark" : "Bookmark"}
                className={`h-10 w-10 rounded-full shadow-sm transition-all duration-200 hover:scale-105 ${
                  isBookmarked 
                    ? "bg-primary text-primary-foreground shadow-md" 
                    : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <Bookmark className={`h-5 w-5 ${isBookmarked ? "fill-current" : ""}`} />
              </Button>

              <Button
                variant={isFavorite ? "default" : "outline"}
                size="icon"
                onClick={handleToggleFavorite}
                disabled={actionLoading}
                title={isFavorite ? "Remove Favorite" : "Favorite"}
                className={`h-10 w-10 rounded-full shadow-sm transition-all duration-200 hover:scale-105 ${
                  isFavorite 
                    ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shadow-md" 
                    : "border-input bg-background hover:bg-accent hover:text-rose-500"
                }`}
              >
                <Heart className={`h-5 w-5 ${isFavorite ? "fill-current text-white" : ""}`} />
              </Button>

              <Button
                variant={isFinished ? "default" : "outline"}
                size="icon"
                onClick={handleToggleFinished}
                disabled={actionLoading}
                title={isFinished ? "Marked as Finished" : "Finished"}
                className={`h-10 w-10 rounded-full shadow-sm transition-all duration-200 hover:scale-105 ${
                  isFinished 
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-md" 
                    : "border-input bg-background hover:bg-accent hover:text-emerald-500"
                }`}
              >
                <BookCheck className="h-5 w-5" />
              </Button>

              <Button
                variant={isNotInterested ? "default" : "outline"}
                size="icon"
                onClick={handleToggleNotInterested}
                disabled={actionLoading}
                title={isNotInterested ? "Not Interested (Excluded from Recommended for You)" : "Not Interested"}
                className={`h-10 w-10 rounded-full shadow-sm transition-all duration-200 hover:scale-105 ${
                  isNotInterested 
                    ? "bg-slate-700 hover:bg-slate-800 text-white border-slate-700 shadow-md" 
                    : "border-input bg-background hover:bg-accent hover:text-slate-600"
                }`}
              >
                <EyeOff className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Right: Details */}
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{book?.title || "Untitled"}</h1>
              <p className="text-base text-muted-foreground mt-1">by {book?.author || "Unknown"}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {book?.genre?.map?.((g: string) => (
                  <span key={g} className="inline-block text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground">{g}</span>
                ))}
              </div>
            </div>

            <BookMetadata
              views={book?.popularityScore || 0}
              ratingCount={book?.ratingCount || 0}
              averageRating={book?.averageRating}
              isNewArrival={isNewArrivalFromState || book?.publishedDate?.includes('2024') || book?.publishedDate?.includes('2025')}
              bookId={book?._id}
            />

            <p className="text-sm text-foreground/80 leading-relaxed">{book.description}</p>

            <div className="flex gap-6 text-sm text-muted-foreground">
              <span>{book.pages || 300} pages</span>
              {book.publishedDate && <span>Published {book.publishedDate}</span>}
            </div>

            {/* Buy this book option */}
            {(() => {
              // Preferred: exact retailer product-page URL saved by an admin (validated before rendering)
              const purchaseUrl = sanitizePurchaseUrl(book?.purchaseUrl);
              if (purchaseUrl) {
                return (
                  <div className="pt-1">
                    <Button
                      asChild
                      className="w-full sm:w-auto px-6 h-10 gap-2 font-medium shadow-sm transition-all duration-200 bg-teal-600 hover:bg-teal-700 text-white border-teal-600"
                    >
                      <a
                        href={purchaseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ShoppingBag size={18} />
                        Buy This Book
                        <ExternalLink size={14} className="ml-1 opacity-70" />
                      </a>
                    </Button>
                  </div>
                );
              }
              // Fallback: existing "Find this book" behavior
              const url = (book.URL && typeof book.URL === 'string' && book.URL.trim().startsWith('http'))
                ? book.URL.trim()
                : (book.title || book.author)
                  ? `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(`${book.title || ''} ${book.author || ''}`.trim())}`
                  : null;
              if (!url) return null;
              return (
                <div className="pt-1">
                  <Button
                    asChild
                    className="w-full sm:w-auto px-6 h-10 gap-2 font-medium shadow-sm transition-all duration-200"
                  >
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ShoppingBag size={18} />
                      Find this book
                      <ExternalLink size={14} className="ml-1 opacity-70" />
                    </a>
                  </Button>
                </div>
              );
            })()}

            {/* Rating Widget */}
            <Card className="border">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-sm text-foreground">Rate this book</h3>
                {!localStorage.getItem('token') ? (
                  <Link to="/login" className="text-sm text-primary hover:underline block mt-1">
                    Sign in to submit a rating
                  </Link>
                ) : checkingRating ? (
                  <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Checking rating status...</span>
                  </div>
                ) : submitted ? (
                  <p className="text-sm text-primary font-medium">Thank you for rating this book!</p>
                ) : (
                  <div className="flex items-center gap-3">
                    <StarRating rating={userRating} size={24} interactive onRate={setUserRating} />
                    <Button 
                      size="sm" 
                      className="h-8 text-sm" 
                      onClick={submitRating} 
                      disabled={userRating === 0 || submittingRating}
                    >
                      {submittingRating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Submit Rating"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Similar Books */}
        {isAuthenticated && similarBooks.length > 0 && (
          <section className="mt-12 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">You May Also Like</h2>
            <p className="text-sm text-muted-foreground">Based on content similarity to {book.title}</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6 w-full">
              {similarBooks.map((b) => (
                <BookCard key={b.id} book={b} showMatch />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
