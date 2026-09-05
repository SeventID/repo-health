import { Logo } from "@/components/site/Logo";
import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="border-t-2 border-foreground bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <Link to="/" className="cursor-pointer" aria-label="RepoPulse home">
            <Logo />
          </Link>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Know whether a GitHub repository is still alive — before you install,
            fork, or integrate it.
          </p>
          <p className="mt-3 text-xs text-muted-foreground/80">
            RepoPulse reads public GitHub data server-side. No code, tokens or
            repository contents are ever exposed client-side.
          </p>
        </div>

        <div className="flex flex-wrap gap-10">
          <div className="flex flex-col gap-2 text-sm">
            <p className="brutal-label">Product</p>
            <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
              Analyze a repository
            </Link>
            <Link to="/compare" className="text-muted-foreground transition-colors hover:text-foreground">
              Compare two repositories
            </Link>
            <Link to="/dashboard" className="text-muted-foreground transition-colors hover:text-foreground">
              My analyses
            </Link>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <p className="brutal-label">Method</p>
            <span className="text-muted-foreground">Meaningful activity detection</span>
            <span className="text-muted-foreground">Transparent weighted scoring</span>
            <span className="text-muted-foreground">Status ≠ certainty</span>
          </div>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} RepoPulse. Built for developers who check before they commit.</span>
          <span>
            Health checks are assessments of public signals — not guarantees.
          </span>
        </div>
      </div>
    </footer>
  );
}
