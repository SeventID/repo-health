import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { useSeo } from "@/lib/use-seo";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";

export default function NotFound() {
  useSeo("Page not found | RepoPulse");
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full"
        >
          <p className="border-2 border-foreground bg-foreground px-4 py-1 font-mono text-xs font-black uppercase tracking-[0.3em] text-background">
            404 — dead link detected
          </p>
          <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">
            This page isn&apos;t maintained.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Whatever lived here isn&apos;t here anymore. Unlike a stale GitHub
            repository, this one is easy to verify.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex h-11 items-center gap-2 border-2 border-foreground bg-foreground px-6 text-sm font-black text-background transition-opacity hover:opacity-85"
          >
            <ArrowLeft className="size-4" />
            Back to RepoPulse
          </Link>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
