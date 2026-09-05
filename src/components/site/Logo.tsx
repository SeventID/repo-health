import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center border-2 border-foreground bg-foreground font-mono text-sm font-black text-background",
        className,
      )}
      aria-hidden="true"
    >
      RP
    </span>
  );
}

export function Logo({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="flex items-center text-[17px] font-black tracking-tight">
          RepoPulse
          <span className="ml-1.5 inline-block size-2 bg-health-ok" />
        </span>
      )}
    </span>
  );
}
