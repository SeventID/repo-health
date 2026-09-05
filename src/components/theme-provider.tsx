import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Dark is RepoPulse's primary theme; light is supported on request.
 * Storage key must match the inline script in index.html.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="repopulse-theme"
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
