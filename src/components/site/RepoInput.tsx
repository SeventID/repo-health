import { cn } from "@/lib/utils";
import { parseRepoUrl } from "@/lib/repo-url";
import { ArrowRight, GitBranch, Search } from "lucide-react";
import { FormEvent, useState } from "react";

export const EXAMPLE_REPOS = [
  { fullName: "facebook/react", label: "facebook/react" },
  { fullName: "discordjs/discord.js", label: "discordjs/discord.js" },
  { fullName: "vercel/next.js", label: "vercel/next.js" },
  { fullName: "moment/moment", label: "moment/moment" },
];

interface RepoInputProps {
  onAnalyze: (fullNameOrUrl: string) => void;
  /** loading state (analysis in progress elsewhere) */
  disabled?: boolean;
  autoFocus?: boolean;
  size?: "lg" | "md";
  className?: string;
  /** show clickable example repos underneath */
  showExamples?: boolean;
  placeholder?: string;
  compact?: boolean;
}

export function RepoInput({
  onAnalyze,
  disabled = false,
  autoFocus = false,
  size = "lg",
  className,
  showExamples = false,
  placeholder = "Paste a GitHub repository URL...",
  compact = false,
}: RepoInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (raw: string) => {
    if (disabled) return;
    const parsed = parseRepoUrl(raw);
    if (!parsed) {
      setError(
        "That doesn't look like a GitHub repository. Try facebook/react or https://github.com/facebook/react",
      );
      return;
    }
    setError(null);
    onAnalyze(parsed.fullName);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(value);
  };

  const tall = size === "lg";

  return (
    <div className={cn("w-full", className)}>
      <form
        onSubmit={onSubmit}
        className={cn(
          "flex items-stretch gap-0 border-2 border-foreground bg-card",
          error && "border-health-risk",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-3.5">
          {compact ? (
            <GitBranch className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <Search className="size-5 shrink-0 text-muted-foreground" />
          )}
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            disabled={disabled}
            autoFocus={autoFocus}
            placeholder={placeholder}
            spellCheck={false}
            autoComplete="off"
            aria-label="GitHub repository URL"
            className={cn(
              "min-w-0 flex-1 bg-transparent font-mono text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60",
              tall ? "h-14 text-[15px] sm:text-base" : "h-10 text-sm",
            )}
          />
        </div>
        <button
          type="submit"
          disabled={disabled}
          className={cn(
            "flex shrink-0 cursor-pointer items-center gap-2 border-l-2 border-foreground bg-foreground font-bold text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50",
            tall ? "px-4 text-sm sm:px-6 sm:text-[15px]" : "px-4 text-sm",
          )}
        >
          <span className="hidden sm:inline">
            {disabled ? "Analyzing..." : "Analyze Repository"}
          </span>
          <span className="sm:hidden">Analyze</span>
          <ArrowRight className="size-4" />
        </button>
      </form>

      {error && (
        <p className="mt-2 border-l-4 border-health-risk bg-health-risk-soft px-3 py-1.5 text-xs font-semibold text-foreground">
          {error}
        </p>
      )}

      {showExamples && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="brutal-label">Try one:</span>
          {EXAMPLE_REPOS.map((repo) => (
            <button
              key={repo.fullName}
              type="button"
              disabled={disabled}
              onClick={() => submit(repo.fullName)}
              className="cursor-pointer border-2 border-foreground bg-card px-2.5 py-1 font-mono text-xs font-semibold text-foreground transition-colors hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              {repo.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
