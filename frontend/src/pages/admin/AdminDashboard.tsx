import { useState, useEffect, useMemo } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, BookOpen, Star, TrendingUp, Plus, Trash2, Edit, Ban, CheckCircle, Loader2, BarChart3, PieChart as PieIcon, Trophy, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StarRating } from "@/components/StarRating";
import { adminApi, bookApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

import { UserAnalyticsView } from "@/components/UserAnalyticsView";

const COLORS = ["hsl(190,60%,42%)", "hsl(220,55%,55%)", "hsl(160,50%,45%)", "hsl(35,70%,55%)", "hsl(340,55%,55%)", "hsl(270,50%,55%)"];

export default function AdminDashboard() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedUserAnalytics, setSelectedUserAnalytics] = useState<any>(null);
  const [loadingUserAnalytics, setLoadingUserAnalytics] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [newBook, setNewBook] = useState({
    title: "",
    author: "",
    genres: "",
    description: "",
    thumbnailUrl: ""
  });

  const loadData = async () => {
    try {
      const [statsRes, usersRes, booksRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getUsers(),
        bookApi.getAll({ limit: 50 })
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setBooks(booksRes.data.books);
    } catch (err) {
      toast({ title: "Failed to load admin data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleExportAnalytics = async () => {
    setIsExporting(true);
    try {
      const response = await adminApi.exportAnalytics();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().split("T")[0];
      link.href = url;
      link.setAttribute("download", `BookWise_Analytics_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast({ title: "Analytics report downloaded" });
    } catch (err) {
      toast({ title: "Failed to export analytics", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (!authUser?.isAdmin) return;
    loadData();
  }, [authUser]);

  useEffect(() => {
    if (!authUser?.isAdmin) return;
    
    const handleSearch = async () => {
      if (!searchQuery.trim()) {
        const booksRes = await bookApi.getAll({ limit: 50 });
        setBooks(booksRes.data.books);
        return;
      }

      setIsSearching(true);
      try {
        const { data } = await bookApi.search(searchQuery);
        setBooks(data);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(handleSearch, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, authUser]);

  useEffect(() => {
    if (!selectedUserId) {
      setSelectedUserAnalytics(null);
      return;
    }

    const fetchUserAnalytics = async () => {
      try {
        setLoadingUserAnalytics(true);
        const { data } = await adminApi.getUserAnalytics(selectedUserId);
        setSelectedUserAnalytics(data);
      } catch (err) {
        console.error("Failed to fetch user analytics for admin", err);
        toast({ title: "Failed to fetch user analytics", variant: "destructive" });
      } finally {
        setLoadingUserAnalytics(false);
      }
    };

    fetchUserAnalytics();
  }, [selectedUserId, toast]);

  const genreCompositionData = useMemo(() => {
    if (!books || books.length === 0) return [];
    
    let singleCount = 0;
    let multiCount = 0;

    books.forEach(book => {
      // Handle MongoDB 'genres' (array) or legacy 'genre'
      const g = book.genres || book.genre;
      if (Array.isArray(g)) {
        if (g.length > 1) {
          multiCount++;
        } else {
          singleCount++;
        }
      } else {
        singleCount++;
      }
    });

    return [
      { name: "Single Genre", count: singleCount, color: "hsl(190,60%,42%)" },
      { name: "Multi Genre", count: multiCount, color: "hsl(35,70%,55%)" }
    ];
  }, [books]);

  if (!authUser?.isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center py-20 text-center">
          <p className="text-muted-foreground italic">Restricted Access: Admins Only</p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8" /></div>;

  const handleDeleteBook = async (id: string) => {
    try {
      await bookApi.delete(id);
      setBooks(books.filter(b => b._id !== id));
      toast({ title: "Book deleted" });
    } catch (err) {
      toast({ title: "Failed to delete book", variant: "destructive" });
    }
  };

  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBook.title || !newBook.author) {
      toast({ title: "Title and Author are required", variant: "destructive" });
      return;
    }

    try {
      const genresArray = newBook.genres.split(',').map(g => g.trim()).filter(g => g !== '');
      const { data } = await bookApi.create({
        ...newBook,
        genres: genresArray
      });
      
      // Update local state: add to the beginning of the list
      setBooks([data, ...books]);
      setIsAddDialogOpen(false);
      
      // Reset form
      setNewBook({
        title: "",
        author: "",
        genres: "",
        description: "",
        thumbnailUrl: ""
      });
      
      toast({ title: "Book added successfully!" });
    } catch (err) {
      console.error("Add book error:", err);
      toast({ title: "Failed to add book", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background w-full">
      <Navbar />
      <main className="w-full min-h-screen flex flex-col px-6 lg:px-10 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Users", value: stats?.totalUsers || 0, icon: Users },
            { label: "Total Books", value: stats?.totalBooks || 0, icon: BookOpen },
            { label: "Total Ratings", value: stats?.totalRatings || 0, icon: Star },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="border shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent">
                  <Icon size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="books" className="space-y-4">
          <TabsList>
            <TabsTrigger value="books">Books</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="books">
            <Card className="border">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Manage Books</CardTitle>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-2">
                      <Plus size={16} /> Add Book
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Add New Book</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleAddBook} className="space-y-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input 
                          id="title" 
                          value={newBook.title} 
                          onChange={(e) => setNewBook({...newBook, title: e.target.value})} 
                          placeholder="Enter book title" 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="author">Author *</Label>
                        <Input 
                          id="author" 
                          value={newBook.author} 
                          onChange={(e) => setNewBook({...newBook, author: e.target.value})} 
                          placeholder="Enter author name" 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="genres">Genres (comma-separated)</Label>
                        <Input 
                          id="genres" 
                          value={newBook.genres} 
                          onChange={(e) => setNewBook({...newBook, genres: e.target.value})} 
                          placeholder="e.g. Fantasy, Adventure, Magic" 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="thumbnailUrl">Thumbnail URL</Label>
                        <Input 
                          id="thumbnailUrl" 
                          value={newBook.thumbnailUrl} 
                          onChange={(e) => setNewBook({...newBook, thumbnailUrl: e.target.value})} 
                          placeholder="https://example.com/image.jpg" 
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea 
                          id="description" 
                          value={newBook.description} 
                          onChange={(e) => setNewBook({...newBook, description: e.target.value})} 
                          placeholder="Enter book description..." 
                          className="min-h-[100px]"
                        />
                      </div>
                      <DialogFooter className="pt-4">
                        <Button type="submit" className="w-full">Save Book</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Input
                    placeholder="Search by full book title or author..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-md"
                  />
                  {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>

                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Title</TableHead><TableHead>Author</TableHead><TableHead>Rating</TableHead><TableHead>Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {books.length > 0 ? (
                      books.map((b) => (
                        <TableRow key={b._id}>
                          <TableCell className="text-sm font-medium">{b.title}</TableCell>
                          <TableCell className="text-sm">{b.author}</TableCell>
                          <TableCell className="text-sm">{b.rating}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => handleDeleteBook(b._id)}>
                              <Trash2 size={13} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">
                          {isSearching ? "Searching..." : "No books found"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="py-4 border-b bg-muted/20 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">User Directory</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Click anywhere on a user's row to view their full analytics modal.</p>
                </div>
              </CardHeader>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold">Name</TableHead>
                    <TableHead className="font-semibold">Email</TableHead>
                    <TableHead className="whitespace-nowrap font-semibold">Number of Books Rated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length > 0 ? (
                    users.map((u) => {
                      const isSelected = selectedUserId === u.id && isUserModalOpen;
                      return (
                        <TableRow 
                          key={u.id}
                          onClick={() => {
                            setSelectedUserId(u.id);
                            setIsUserModalOpen(true);
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected 
                              ? "bg-primary/10 hover:bg-primary/15 font-medium border-l-4 border-l-primary" 
                              : "hover:bg-muted/70"
                          }`}
                        >
                          <TableCell className="text-sm font-medium">{u.name}</TableCell>
                          <TableCell className="text-sm">{u.email}</TableCell>
                          <TableCell className="text-sm font-semibold">{u.ratings}</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-muted-foreground italic">
                        No users found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-8">
            {/* Grid 1: Genre Composition & Popular Genres Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Single vs Multi Genre Distribution */}
              <Card className="border w-full shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-center gap-2">
                    <PieIcon size={18} className="text-primary" /> Single vs Multi Genre Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {genreCompositionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie 
                          data={genreCompositionData} 
                          dataKey="count" 
                          nameKey="name" 
                          cx="50%" 
                          cy="50%" 
                          outerRadius={110} 
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        >
                          {genreCompositionData.map((entry: any, i: number) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex justify-center items-center h-[320px] text-muted-foreground">No data available</div>
                  )}
                </CardContent>
              </Card>

              {/* Most Popular Genres Chart */}
              <Card className="border w-full shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-center gap-2">
                    <TrendingUp size={18} className="text-primary" /> Most Popular Genres (by Number of Ratings)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {stats?.popularGenres && stats.popularGenres.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={stats.popularGenres} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(35,70%,55%)" radius={[0, 4, 4, 0]} name="Total Ratings" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex justify-center items-center h-[320px] text-muted-foreground">No genre rating data available</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Grid 3: Top 10 Most Rated & Top 10 Highest Rated Books */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 3. Top 10 Most Rated Books */}
              <Card className="border shadow-sm overflow-hidden">
                <CardHeader className="py-4 border-b bg-muted/20">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Trophy size={18} className="text-amber-500" /> Top 10 Most Rated Books
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {stats?.mostRatedBooks && stats.mostRatedBooks.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Book</TableHead>
                          <TableHead className="text-right">Ratings Count</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.mostRatedBooks.map((book: any, idx: number) => (
                          <TableRow key={book.id || idx}>
                            <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {book.coverUrl ? (
                                  <img src={book.coverUrl} alt={book.title} className="w-10 h-14 object-cover rounded shadow-sm shrink-0" />
                                ) : (
                                  <div className="w-10 h-14 bg-muted rounded flex items-center justify-center shrink-0">
                                    <BookOpen size={16} className="text-muted-foreground" />
                                  </div>
                                )}
                                <div className="space-y-0.5 min-w-0">
                                  <p className="text-sm font-semibold truncate max-w-[200px] text-foreground">{book.title}</p>
                                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">{book.author}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-sm">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                {book.ratingCount} ratings
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground italic">No rated books data available</div>
                  )}
                </CardContent>
              </Card>

              {/* 4. Top 10 Highest Rated Books */}
              <Card className="border shadow-sm overflow-hidden">
                <CardHeader className="py-4 border-b bg-muted/20">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award size={18} className="text-emerald-500" /> Top 10 Highest Rated Books
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {stats?.highestRatedBooks && stats.highestRatedBooks.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Book</TableHead>
                          <TableHead className="text-right">Avg Rating</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stats.highestRatedBooks.map((book: any, idx: number) => (
                          <TableRow key={book.id || idx}>
                            <TableCell className="font-bold text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {book.coverUrl ? (
                                  <img src={book.coverUrl} alt={book.title} className="w-10 h-14 object-cover rounded shadow-sm shrink-0" />
                                ) : (
                                  <div className="w-10 h-14 bg-muted rounded flex items-center justify-center shrink-0">
                                    <BookOpen size={16} className="text-muted-foreground" />
                                  </div>
                                )}
                                <div className="space-y-0.5 min-w-0">
                                  <p className="text-sm font-semibold truncate max-w-[200px] text-foreground">{book.title}</p>
                                  <p className="text-xs text-muted-foreground truncate max-w-[200px]">{book.author}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-sm">
                              <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-sm">
                                ⭐ {book.rating ? parseFloat(book.rating).toFixed(1) : "0.0"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-8 text-center text-muted-foreground italic">No rated books data available</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Export Analytics */}
            <div className="flex justify-end pt-4 border-t border-border/50">
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleExportAnalytics}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BarChart3 className="w-4 h-4" />
                )}
                Download Analytics Report
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Centered User Analytics Modal */}
        <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto sm:max-w-4xl p-6 shadow-2xl border">
            <DialogHeader className="pb-4 border-b">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                {selectedUserAnalytics?.user?.name || "User"}'s Reading Analytics
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {selectedUserAnalytics?.user?.email || "User profile details"} • Member Activity & Insights
              </DialogDescription>
            </DialogHeader>

            {loadingUserAnalytics ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : selectedUserAnalytics ? (
              <div className="pt-4 space-y-6">
                <UserAnalyticsView profile={selectedUserAnalytics} isAdminView={true} />
              </div>
            ) : (
              <div className="py-10 text-center text-muted-foreground">No analytics data found for this user.</div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
