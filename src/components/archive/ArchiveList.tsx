"use client";

import React, { useState, useEffect, useSyncExternalStore, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Article } from "@/lib/articles";
import { isArticleVisible } from "@/lib/utils";

// Hook to detect client-side rendering without causing hydration mismatch
function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

interface ArchiveListProps {
  initialArticles: Article[];
  totalPages: number;
  currentPage: number;
  initialSearch: string;
}

export function ArchiveList({ 
  initialArticles, 
  totalPages, 
  currentPage,
  initialSearch 
}: ArchiveListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const isClient = useIsClient();

  // Filter articles based on 9 AM rule (only on client)
  const visibleArticles = useMemo(() => {
    if (!isClient) {
      // On server, return all articles (will be filtered on client)
      return initialArticles;
    }
    // On client, filter out articles that shouldn't be visible yet
    return initialArticles.filter(article => {
      // Use the date field (MongoDB Date object converted to string)
      return isArticleVisible(article.date);
    });
  }, [initialArticles, isClient]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== initialSearch) {
        const params = new URLSearchParams();
        if (searchQuery) params.set("q", searchQuery);
        params.set("page", "1"); // Reset to page 1 on search
        router.push(`${pathname}?${params.toString()}`);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, initialSearch, pathname, router]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    params.set("page", newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      
      {/* Header */}
      <header className="mb-16 space-y-6">
        <Link 
          href="/"
          className="text-sm text-foreground/40 hover:text-foreground transition-colors"
        >
          ← Back to Home
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">Archive</h1>
        
        {/* Search Bar */}
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-foreground/30 group-focus-within:text-foreground/60 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Search by title, category, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-foreground/5 border border-transparent focus:border-foreground/20 rounded-xl py-3 pl-10 pr-4 outline-none transition-all placeholder:text-foreground/30"
          />
        </div>
      </header>

      {/* List */}
      <div className="space-y-2">
        {visibleArticles.map((article, index) => (
          <motion.div
            key={article._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link 
              href={`/read/${article._id}`}
              className="group block p-4 -mx-4 rounded-2xl hover:bg-foreground/5 transition-colors"
            >
              <div className="flex items-baseline justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium truncate group-hover:text-foreground/80 transition-colors">
                    {article.topic_title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-foreground/40 uppercase tracking-wider">
                    <span>{article.date_str}</span>
                    <span>•</span>
                    <span>{article.category}</span>
                  </div>
                </div>
                <div className="text-foreground/20 group-hover:translate-x-1 transition-transform">
                  <ArrowRight size={18} />
                </div>
              </div>
            </Link>
          </motion.div>
        ))}

        {visibleArticles.length === 0 && (
          <div className="text-center py-20 text-foreground/40">
            No essays found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-16 flex items-center justify-center gap-4">
          <button 
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-2 rounded-lg hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          
          <span className="text-sm font-medium">
            Page {currentPage} of {totalPages}
          </span>
          
          <button 
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="p-2 rounded-lg hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

    </div>
  );
}
