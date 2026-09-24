import { useState, useEffect, useMemo, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { GenreCarousel } from "@/components/GenreCarousel";
import { RecommendedForYou } from "@/components/RecommendedForYou";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BookOpen, Sparkles } from "lucide-react";
import { mlApi } from "@/services/api";

import { TopRatedCarousel } from "@/components/TopRatedCarousel";
import { TopRatedMultiGenreCarousel } from "@/components/TopRatedMultiGenreCarousel";
import { LazySection } from "@/components/LazySection";
import { SkeletonCarousel } from "@/components/SkeletonCarousel";

export default function Index() {
  const { isAuthenticated, user } = useAuth();

  const [recommendations, setRecommendations] = useState<any>({
    personalized: [],
    mostRecommended: [],
    newArrivals: []
  });

  const [mlLoading, setMlLoading] = useState(false);
  const hasFetchedHybrid = useRef(false);

  // Home Page logic: deterministic mapping
  const mapBooks = (books: any[]) => {
    const uniqueMap = new Map();

    books.forEach((b: any) => {
      const key = `${b.title}|||${b.author}`.toLowerCase();

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          ...b,
          id: b._id,
          genre: b.genres,
          coverUrl: b.realCoverImage || b.thumbnailUrl,
          averageRating: b.rating,
          ratingCount: b.ratingCount
        });
      }
    });

    return Array.from(uniqueMap.values());
  };

  const fetchHybrid = async () => {
    if (hasFetchedHybrid.current) return;

    hasFetchedHybrid.current = true;
    setMlLoading(true);

    try {
      const userId = (user as any)?.id || (user as any)?._id;
      const { data } = await mlApi.getRecommendations(userId);

      setRecommendations({
        personalized: mapBooks(data.personalized || []).filter(
          (b: any) =>
            b.averageRating >= 3.0 &&
            b.averageRating <= 4.0
        ),

        mostRecommended: mapBooks(data.mostRecommended || [])
          .filter(
            (book: any) =>
              !(
                book.title ===
                "Harry Potter and the Half-Blood Prince (Harry Potter, #6)" &&
                book.author === "J.K. Rowling"
              ) &&
              !(
                book.title ===
                "Harry Potter and the Prisoner of Azkaban (Harry Potter, #3)" &&
                book.author === "J.K. Rowling"
              )
          )
          .filter(
            (b: any) =>
              ![
                "Harry Potter and the Order of the Phoenix (Harry Potter, #5)",
                "Night Watch (Discworld, #29; City Watch, #6)",
                "The Lord of the Rings"
              ].includes(b.title)
          )
          .map((b: any) => ({
            ...b,
            averageRating: 0
          }))
          .slice(0, 10),

        newArrivals: mapBooks(data.newArrivals || [])
          .filter(
            (b: any) =>
              b.title !== "Revel" &&
              !(
                b.title === "Lanark" &&
                b.author === "Alasdair Gray"
              ) &&
              !(
                b.title === "Soft Tortures" &&
                b.author === "P.A. Bitez"
              )
          )
          .slice(0, 10)
      });
    } catch (error) {
      console.error(
        "Failed to fetch hybrid recommendations",
        error
      );

      // Allow retry on failure
      hasFetchedHybrid.current = false;
    } finally {
      setMlLoading(false);
    }
  };

  // Reset ref if user changes
  useEffect(() => {
    hasFetchedHybrid.current = false;
  }, [user]);

  // Memoized lists for rendering stability
  const visibleMostPopular = useMemo(
    () => recommendations.mostRecommended,
    [recommendations.mostRecommended]
  );

  const visibleNewArrivals = useMemo(
    () => recommendations.newArrivals,
    [recommendations.newArrivals]
  );

  return (
    <div className="min-h-screen bg-background w-full">
      <Navbar />

      <main className="w-full min-h-screen py-12">
        <div className="container space-y-24">

          {/* Hero */}
          <section className="space-y-6">
            <div className="space-y-3">
              <h1 className="text-5xl font-extrabold text-foreground tracking-tight">
                BookWise
              </h1>

              <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed">
                Smart book discovery, powered for your personal reading taste.
              </p>
            </div>

            <div className="flex gap-4">
              {!isAuthenticated && (
                <Button asChild size="lg" className="px-8">
                  <Link to="/register">
                    <Sparkles size={20} className="mr-2" />
                    Start Exploring
                  </Link>
                </Button>
              )}

              <Button
                variant="outline"
                asChild
                size="lg"
                className="px-8"
              >
                <Link to="/browse">
                  <BookOpen size={20} className="mr-2" />
                  Explore Books
                </Link>
              </Button>
            </div>
          </section>

          <div className="space-y-20">

            {/* Top User Rated Books (All Single-Genres) */}
            <TopRatedCarousel />

            {/* Top User Rated Books (All Multi-Genres) */}
            <LazySection rootMargin="250px">
              <TopRatedMultiGenreCarousel />
            </LazySection>

            {/* Recommended for You — calls /api/books/personalized-recommendations */}
            {user && (
              <LazySection rootMargin="300px">
                <RecommendedForYou />
              </LazySection>
            )}

            <LazySection
              onVisible={fetchHybrid}
              rootMargin="300px"
            >
              {mlLoading &&
                recommendations.mostRecommended.length === 0 ? (
                <SkeletonCarousel title="Most Popular" />
              ) : (
                <GenreCarousel
                  title="Most Popular"
                  books={visibleMostPopular}
                  hideRatings={true}
                  hideRatingCount={true}
                />
              )}
            </LazySection>

            {/* New Arrivals */}
            <LazySection
              onVisible={fetchHybrid}
              rootMargin="300px"
            >
              {mlLoading &&
                recommendations.newArrivals.length === 0 ? (
                <SkeletonCarousel title="New Arrivals" />
              ) : (
                <GenreCarousel
                  title="New Arrivals"
                  books={visibleNewArrivals}
                  hideRatings={true}
                  isNewArrival={true}
                />
              )}
            </LazySection>

          </div>
        </div>
      </main>

      <footer className="border-t mt-20">
        <div className="container py-10 text-center text-sm text-muted-foreground">
          <p className="footer-text">BookWise</p>
        </div>
      </footer>
    </div>
  );
}