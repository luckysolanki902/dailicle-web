"use client";

import Link from "next/link";
import { useTheme } from "@/context/ThemeContext";
import { Moon, Sun, TreeDeciduous, Rocket, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function Footer() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { id: "light", icon: Sun, label: "Day" },
    { id: "dark", icon: Moon, label: "Night" },
    { id: "wooden", icon: TreeDeciduous, label: "Study" },
    { id: "space", icon: Rocket, label: "Void" },
    { id: "fairytale", icon: Sparkles, label: "Dream" },
  ] as const;

  return (
    <footer className="py-12 px-6 border-t border-foreground/5 mt-20">
      <div className="max-w-3xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        
        <div className="text-center md:text-left">
          <h3 className="font-bold text-lg tracking-tight">The Dailicle</h3>
          <p className="text-sm text-foreground/40 mt-2">
            One essay a week. Nothing else.
          </p>
        </div>

        <div className="flex flex-col items-center gap-6">
          <nav className="flex flex-wrap justify-center gap-6 text-sm font-medium text-foreground/60">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link href="/archive" className="hover:text-foreground transition-colors">Archive</Link>
            <Link href="/manifesto" className="hover:text-foreground transition-colors">Why Read?</Link>
            <Link href="/feedback" className="hover:text-foreground transition-colors">Feedback</Link>
          </nav>

          {/* Mobile Theme Switcher */}
          <div className="flex md:hidden items-center gap-2 p-1 rounded-full bg-foreground/5">
            {themes.map((t) => {
              const Icon = t.icon;
              const isActive = theme === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={cn(
                    "p-2 rounded-full transition-all",
                    isActive ? "bg-foreground text-background" : "text-foreground/40"
                  )}
                  aria-label={t.label}
                >
                  <Icon size={14} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="text-xs text-foreground/20">
          © {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
}
