"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, Check, ChevronDown } from "lucide-react";
import {
  LOCALES,
  LOCALE_CODES,
  localeHref,
  splitLocale,
} from "@/i18n/config";
import { useLocale } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/** Persist the choice so the homepage region-default respects it next time. */
function rememberLocale(code: string) {
  document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

interface Props {
  /** "toolbar" = compact globe button (reader); "inline" = footer row. */
  variant?: "toolbar" | "inline";
  className?: string;
  /** Dropdown opening direction. */
  align?: "left" | "right";
}

/**
 * Switches the current page to another language. It keeps the reader on the
 * same page (same essay, same static page) by swapping only the locale segment
 * of the path, and records the choice in a cookie so it sticks.
 */
export function LanguageSwitcher({ variant = "toolbar", className, align = "right" }: Props) {
  const locale = useLocale();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const { path } = splitLocale(pathname);

  const choose = (code: string) => {
    rememberLocale(code);
    setOpen(false);
    if (code !== locale) router.push(localeHref(path, code));
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 text-sm text-foreground/40 hover:text-foreground transition-colors",
          variant === "toolbar" ? "p-2 rounded-lg hover:bg-foreground/5" : "font-medium"
        )}
        aria-label="Change language"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe size={variant === "toolbar" ? 18 : 15} />
        <span className={variant === "toolbar" ? "hidden sm:inline uppercase" : ""}>
          {variant === "toolbar" ? locale : LOCALES[locale].native}
        </span>
        <ChevronDown size={13} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, scale: 0.96, y: variant === "inline" ? 8 : -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: variant === "inline" ? 8 : -8 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute z-50 max-h-72 w-44 overflow-auto rounded-xl border border-foreground/15 bg-background p-1.5 shadow-2xl",
              align === "right" ? "right-0" : "left-0",
              variant === "inline" ? "bottom-full mb-2" : "top-full mt-2"
            )}
          >
            {LOCALE_CODES.map((code) => (
              <li key={code}>
                <button
                  role="option"
                  aria-selected={code === locale}
                  onClick={() => choose(code)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    code === locale
                      ? "bg-foreground/5 text-foreground"
                      : "text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
                  )}
                >
                  <span>{LOCALES[code].native}</span>
                  {code === locale && <Check size={14} className="text-accent" />}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
