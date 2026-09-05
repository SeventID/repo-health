import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/site/Logo";
import { ThemeToggle } from "@/components/site/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { History, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

const NAV_LINKS = [
  { to: "/", label: "Analyze", match: "/" },
  { to: "/compare", label: "Compare" },
  { to: "/#how-it-works", label: "How It Works" },
];

function initials(user: { name?: string | null; email?: string | null } | null): string {
  if (user?.name) {
    const parts = user.name.trim().split(/\s+/);
    return (parts[0]?.[0] ?? "").toUpperCase();
  }
  if (user?.email) return user.email[0].toUpperCase();
  return "G";
}

export function Navbar() {
  const { isLoading, isAuthenticated, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      navigate("/");
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b-2 border-foreground bg-background">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="cursor-pointer" aria-label="RepoPulse home">
          <Logo />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="rounded-none border-2 border-transparent px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden md:block">
            {isLoading ? (
              <div className="size-9 animate-pulse border-2 border-foreground bg-muted" />
            ) : isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Account menu"
                    className="grid size-9 cursor-pointer place-items-center border-2 border-foreground bg-foreground font-black text-background"
                  >
                    {initials(user)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-none border-2 border-foreground">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {user.email ?? "Guest session"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={() => navigate("/dashboard")}
                  >
                    <History className="size-4" />
                    My analyses
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onSelect={handleSignOut}
                  >
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to="/auth"
                className="inline-flex h-9 items-center border-2 border-foreground bg-foreground px-4 text-sm font-bold text-background transition-opacity hover:opacity-80"
              >
                Sign in
              </Link>
            )}
          </div>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            className="grid size-9 cursor-pointer place-items-center border-2 border-foreground bg-card md:hidden"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t-2 border-foreground md:hidden">
          <nav className="mx-auto flex w-full max-w-6xl flex-col px-4 py-3 sm:px-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                onClick={() => setOpen(false)}
                className="border-b border-border py-3 text-sm font-semibold"
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <>
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="border-b border-border py-3 text-sm font-semibold"
                >
                  My analyses
                </Link>
                <button
                  type="button"
                  className="py-3 text-left text-sm font-semibold text-destructive"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-semibold"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
