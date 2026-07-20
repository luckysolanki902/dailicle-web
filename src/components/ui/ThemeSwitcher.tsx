"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";
import { Moon, Sun, TreeDeciduous, Rocket, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/I18nProvider";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const t = useT();

  const themes = [
    { id: "light", icon: Sun },
    { id: "dark", icon: Moon },
    { id: "wooden", icon: TreeDeciduous },
    { id: "space", icon: Rocket },
    { id: "fairytale", icon: Sparkles },
  ] as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1, duration: 0.5 }}
      className="fixed top-6 right-6 z-50 hidden md:block"
    >
      <div className="flex items-center gap-1 p-1 rounded-full bg-black/5 backdrop-blur-lg border border-black/5 shadow-sm dark:bg-white/10 dark:border-white/10">
        {themes.map((item) => {
          const Icon = item.icon;
          const isActive = theme === item.id;
          const label = t(`footer.themes.${item.id}`);

          return (
            <button
              key={item.id}
              onClick={() => setTheme(item.id)}
              className={cn(
                "relative p-2 rounded-full transition-all duration-300 ease-out group",
                isActive ? "text-background bg-foreground" : "text-foreground/60 hover:text-foreground"
              )}
              aria-label={t("themeSwitcher.switchTo", { theme: label })}
            >
              <Icon size={16} strokeWidth={2} />

              {/* Tooltip */}
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background rounded pointer-events-none whitespace-nowrap">
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
