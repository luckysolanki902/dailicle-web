"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Calendar, Youtube, FileText, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Resource {
  title: string;
  url: string;
  channel?: string;
  summary?: string;
  authors?: string;
  year?: number;
}

interface ArticleReaderProps {
  article: {
    title: string;
    content: string;
    date: string;
    readTime: number;
    category: string;
    youtube?: Resource[];
    papers?: Resource[];
  };
}

export function ArticleReader({ article }: ArticleReaderProps) {
  return (
    <article className="min-h-screen py-12 md:py-20 px-4 md:px-6 overflow-x-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-2xl mx-auto"
      >
        {/* Header */}
        <header className="mb-12 space-y-6 text-center">
          <Link 
            href="/"
            className="inline-flex items-center gap-2 text-sm text-foreground/40 hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft size={14} />
            <span>Back to Daily</span>
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 text-xs font-medium uppercase text-foreground/40">
            <span>{article.category}</span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              <span className="hidden md:inline">{article.date}</span>
              <span className="md:hidden">{article.date.split(',')[0]}</span>
            </span>
            <span className="hidden md:inline">•</span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {article.readTime} min
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-bold leading-tight text-balance">
            {article.title}
          </h1>
        </header>

        {/* Content */}
        <div className={cn(
          "prose prose-lg md:prose-xl mx-auto",
          "prose-headings:font-bold prose-headings:tracking-tight",
          "prose-p:leading-relaxed prose-p:text-foreground/90",
          "prose-a:text-foreground prose-a:underline prose-a:decoration-foreground/30 prose-a:underline-offset-4 hover:prose-a:decoration-foreground",
          "prose-blockquote:border-l-2 prose-blockquote:border-foreground/20 prose-blockquote:pl-6 prose-blockquote:italic prose-blockquote:text-foreground/80",
          "prose-strong:font-semibold prose-strong:text-foreground",
          "prose-code:bg-foreground/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none",
          "prose-hr:border-foreground/10 prose-hr:my-12",
          // Theme specific overrides handled by CSS variables in globals.css, 
          // but we ensure prose uses current text colors
          "text-foreground"
        )}>
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </div>

        {/* Resources Section */}
        {((article.youtube && article.youtube.length > 0) || (article.papers && article.papers.length > 0)) && (
          <div className="mt-16 pt-12 border-t border-foreground/10">
            <h3 className="text-xl font-bold mb-8">Curated Resources</h3>
            
            <div className="grid gap-6 md:grid-cols-2">
              {/* YouTube Videos */}
              {article.youtube && article.youtube.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground/60 uppercase tracking-wider">
                    <Youtube size={16} />
                    <span>Watch</span>
                  </div>
                  <ul className="space-y-3">
                    {article.youtube.map((video, i) => (
                      <li key={i}>
                        <a 
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block p-4 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-sm font-medium break-words flex-1 leading-relaxed">{video.title}</span>
                            <ExternalLink size={14} className="opacity-50 group-hover:opacity-100 flex-shrink-0 mt-0.5" />
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Research Papers */}
              {article.papers && article.papers.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground/60 uppercase tracking-wider">
                    <FileText size={16} />
                    <span>Read</span>
                  </div>
                  <ul className="space-y-3">
                    {article.papers.map((paper, i) => (
                      <li key={i}>
                        <a 
                          href={paper.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block p-4 rounded-xl bg-foreground/5 hover:bg-foreground/10 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-sm font-medium wrap-break-word flex-1 leading-relaxed">{paper.title}</span>
                            <ExternalLink size={14} className="opacity-50 group-hover:opacity-100 shrink-0 mt-0.5" />
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-20 pt-12 border-t border-foreground/10 text-center">
          <p className="text-foreground/40 italic text-sm">
            Thanks for reading. See you tomorrow.
          </p>
          <div className="mt-8">
            <Link 
              href="/archive"
              className="text-sm font-medium border-b border-foreground/20 pb-0.5 hover:border-foreground transition-colors"
            >
              Read previous essays
            </Link>
          </div>
        </footer>
      </motion.div>
    </article>
  );
}
