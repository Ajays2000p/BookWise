import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { BookCard } from "@/components/BookCard";
import { Button } from "@/components/ui/button";
import { Bookmark, Heart, Loader2, BookOpen, Compass, Award, Star, Flame, Trophy } from "lucide-react";
import { userApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

export default function Bookshelf() {
  const [bookmarkedBooks, setBookmarkedBooks] = useState<any[]>([]);
  const [favoriteBooks, setFavoriteBooks] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchBookshelf();
  }, []);

  const fetchBookshelf = async () => {
    try {
      setLoading(true);
      const [shelfRes, profileRes] = await Promise.all([
        userApi.getBookshelf(),
        userApi.getProfile().catch(() => ({ data: null }))
      ]);
      setBookmarkedBooks(shelfRes.data?.bookmarkedBooks || []);
      setFavoriteBooks(shelfRes.data?.favoriteBooks || []);
      if (profileRes.data) {
        setProfile(profileRes.data);
      }
    } catch (error) {
      console.error("Failed to fetch bookshelf", error);
      toast({ title: "Failed to load bookshelf", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const totalRated = profile?.ratedBooksCount || 0;

  const achievements = [
    {
      id: "getting-started",
      name: "Getting Started",
      description: "Joined BookWise and started reading.",
      icon: Award,
      unlocked: totalRated >= 1 || !!profile?.user,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    },
    {
      id: "book-explorer",
      name: "Book Explorer",
      description: "Explored and rated books across genres.",
      icon: BookOpen,
      unlocked: totalRated >= 3,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    },
    {
      id: "avid-reader",
      name: "Avid Reader",
      description: "Consistently reading and rating books.",
      icon: Star,
      unlocked: totalRated >= 5,
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    },
    {
      id: "reading-enthusiast",
      name: "Reading Enthusiast",
      description: "Demonstrated a passionate reading habit.",
      icon: Flame,
      unlocked: totalRated >= 10,
      color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    },
    {
      id: "book-master",
      name: "Book Master",
      description: "Mastered an extensive collection of books.",
      icon: Trophy,
      unlocked: totalRated >= 20,
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    },
  ];

  return (
    <div className="min-h-screen bg-background w-full">
      <Navbar />
      <main className="w-full flex-1 flex flex-col px-6 lg:px-10 py-8 max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">My Bookshelf</h1>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
            <p className="text-muted-foreground animate-pulse text-sm">Loading your bookshelf...</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* 🏆 Section 1: Achievements */}
            <section className="space-y-6">
              <div className="flex items-center gap-2.5">
                <Award className="h-5 w-5 text-amber-500 fill-amber-500/20" />
                <h2 className="text-xl font-bold tracking-tight">Achievements</h2>
              </div>

              <div className="flex items-center gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none]">
                {achievements.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3.5 p-4 rounded-xl border shrink-0 min-w-[240px] max-w-[260px] transition-all duration-200 ${item.unlocked
                          ? "bg-card border-border shadow-xs"
                          : "bg-background/50 border-muted/50 opacity-60"
                        }`}
                    >
                      <div
                        className={`p-2.5 rounded-full border shrink-0 flex items-center justify-center ${item.unlocked
                            ? item.color
                            : "bg-muted/50 text-muted-foreground/40 border-muted"
                          }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className={`text-sm font-semibold truncate ${item.unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                            {item.name}
                          </h4>
                          {item.unlocked ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                              Unlocked
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium shrink-0">
                              Locked
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 🔖 Section 2: My Bookmarks */}
            <section className="space-y-6">
              <div className="flex items-center gap-2.5">
                <Bookmark className="h-5 w-5 text-primary fill-primary/20" />
                <h2 className="text-xl font-bold tracking-tight">My Bookmarks</h2>
              </div>

              {bookmarkedBooks.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 w-full">
                  {bookmarkedBooks.map((book) => (
                    <BookCard key={book.id || book._id} book={book} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-8 text-center bg-card/40 space-y-3 max-w-md mx-auto sm:mx-0">
                  <Bookmark className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">No bookmarked books yet.</p>
                    <p className="text-xs text-muted-foreground">
                      Bookmark books on their details page to save them for reading later.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild className="gap-1.5 text-xs">
                    <Link to="/browse">
                      <Compass className="h-3.5 w-3.5" /> Browse Books
                    </Link>
                  </Button>
                </div>
              )}
            </section>

            {/* ❤️ Section 3: My Favorites */}
            <section className="space-y-6 pt-4">
              <div className="flex items-center gap-2.5">
                <Heart className="h-5 w-5 text-rose-500 fill-rose-500/20" />
                <h2 className="text-xl font-bold tracking-tight">My Favorites</h2>
              </div>

              {favoriteBooks.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 w-full">
                  {favoriteBooks.map((book) => (
                    <BookCard key={book.id || book._id} book={book} />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-8 text-center bg-card/40 space-y-3 max-w-md mx-auto sm:mx-0">
                  <Heart className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">No favorite books yet.</p>
                    <p className="text-xs text-muted-foreground">
                      Mark books as your favorite on their details page to showcase your top picks.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild className="gap-1.5 text-xs">
                    <Link to="/browse">
                      <Compass className="h-3.5 w-3.5" /> Browse Books
                    </Link>
                  </Button>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
