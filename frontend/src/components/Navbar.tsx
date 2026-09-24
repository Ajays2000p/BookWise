import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookOpen,
  Search,
  Menu,
  X,
  User,
  LogOut,
  Shield,
  BarChart3,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const theme = "light";
  const navigate = useNavigate();
  const location = useLocation();
  const isBrowsePage = location.pathname === "/browse";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanQuery = searchQuery.trim().replace(/\s+/g, " ");

    if (cleanQuery) {
      navigate(`/browse?q=${encodeURIComponent(cleanQuery)}`);
      setSearchQuery("");
    }
  };

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-50 border-b bg-card/90 backdrop-blur-sm">
      <div className="w-full flex h-14 items-center justify-between gap-4 px-6 lg:px-10">

        {/* BookWise Branding */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img
            src="/bookwise-logo.png"
            alt="BookWise Logo"
            className="h-6 w-6 object-contain"
          />

          <span className="text-base font-semibold text-foreground hidden sm:inline">
            BookWise
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {!user?.isAdmin && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-sm h-8"
                asChild
              >
                <Link to="/browse">Browse</Link>
              </Button>
            </>
          )}

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-8 w-8"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-44">
                {!user?.isAdmin && (
                  <>
                    <DropdownMenuItem
                      asChild
                      onSelect={() => navigate("/profile")}
                    >
                      <Link
                        to="/profile"
                        className="flex items-center w-full cursor-pointer"
                      >
                        <User size={14} className="mr-2" />
                        Profile
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      asChild
                      onSelect={() => navigate("/bookshelf")}
                    >
                      <Link
                        to="/bookshelf"
                        className="flex items-center w-full cursor-pointer"
                      >
                        <BookOpen size={14} className="mr-2" />
                        Bookshelf
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem
                  onSelect={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  <LogOut size={14} className="mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="sm"
              className="h-8 text-sm"
              asChild
            >
              <Link to="/login">Sign In</Link>
            </Button>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </Button>
      </div>

      {/* Mobile Navigation */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-card p-4 space-y-3">
          <div className="flex flex-col gap-1">
            {!user?.isAdmin && (
              <>
                <Button
                  variant="ghost"
                  className="justify-start h-9 text-sm"
                  asChild
                  onClick={() => setMobileOpen(false)}
                >
                  <Link to="/browse">Browse</Link>
                </Button>

                {isAuthenticated && (
                  <>
                    <Button
                      variant="ghost"
                      className="justify-start h-9 text-sm"
                      asChild
                      onClick={() => setMobileOpen(false)}
                    >
                      <Link to="/profile">Profile</Link>
                    </Button>

                    <Button
                      variant="ghost"
                      className="justify-start h-9 text-sm"
                      asChild
                      onClick={() => setMobileOpen(false)}
                    >
                      <Link to="/bookshelf">Bookshelf</Link>
                    </Button>
                  </>
                )}
              </>
            )}

            {isAuthenticated ? (
              <Button
                variant="ghost"
                className="justify-start h-9 text-sm"
                onClick={() => {
                  logout();
                  navigate("/");
                  setMobileOpen(false);
                }}
              >
                <LogOut size={14} className="mr-2" />
                Logout
              </Button>
            ) : (
              <Button
                className="justify-start h-9 text-sm"
                asChild
                onClick={() => setMobileOpen(false)}
              >
                <Link to="/login">Sign In</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}