"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Type, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/I18nProvider";

export interface ReaderPrefs {
  size: 0 | 1 | 2; // comfortable / large / very large
  serifBody: boolean;
  relaxed: boolean; // looser leading + spacing
}

export const DEFAULT_PREFS: ReaderPrefs = { size: 0, serifBody: true, relaxed: false };

const STORAGE_KEY = "dailicle-reading-prefs";

export function loadPrefs(): ReaderPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: ReaderPrefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode etc. – fine */
  }
}

interface ReadingPreferencesProps {
  prefs: ReaderPrefs;
  onChange: (prefs: ReaderPrefs) => void;
}

/**
 * The "Aa" control. Small, discoverable, remembered across visits –
 * comfort settings are a promise that we expect people to actually read.
 */
export function ReadingPreferences({ prefs, onChange }: ReadingPreferencesProps) {
  const t = useT();
  const [open, setOpen] = useState(false);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const set = (patch: Partial<ReaderPrefs>) => onChange({ ...prefs, ...patch });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 text-sm text-foreground/40 hover:text-foreground transition-colors p-2 rounded-lg hover:bg-foreground/5"
        aria-label={t("prefs.aria")}
        aria-expanded={open}
      >
        <Type size={18} />
        <span className="hidden sm:inline">Aa</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl shadow-2xl bg-background border border-foreground/15 p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
                  {t("prefs.title")}
                </span>
                <button
                  onClick={() => setOpen(false)}
                  className="text-foreground/40 hover:text-foreground"
                  aria-label={t("prefs.close")}
                >
                  <X size={14} />
                </button>
              </div>

              {/* Text size */}
              <div className="space-y-2">
                <p className="text-xs text-foreground/50">{t("prefs.textSize")}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["A", "A", "A"] as const).map((label, i) => (
                    <button
                      key={i}
                      onClick={() => set({ size: i as ReaderPrefs["size"] })}
                      className={cn(
                        "py-2 rounded-lg border transition-colors font-display",
                        i === 0 && "text-sm",
                        i === 1 && "text-base",
                        i === 2 && "text-lg",
                        prefs.size === i
                          ? "bg-foreground text-background border-foreground"
                          : "border-foreground/15 text-foreground/60 hover:border-foreground/40"
                      )}
                      aria-label={[t("prefs.comfortable"), t("prefs.large"), t("prefs.veryLarge")][i]}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Typeface */}
              <div className="space-y-2">
                <p className="text-xs text-foreground/50">{t("prefs.bodyTypeface")}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => set({ serifBody: false })}
                    className={cn(
                      "py-2 rounded-lg border text-sm transition-colors",
                      !prefs.serifBody
                        ? "bg-foreground text-background border-foreground"
                        : "border-foreground/15 text-foreground/60 hover:border-foreground/40"
                    )}
                  >
                    {t("prefs.sans")}
                  </button>
                  <button
                    onClick={() => set({ serifBody: true })}
                    className={cn(
                      "py-2 rounded-lg border text-sm font-display transition-colors",
                      prefs.serifBody
                        ? "bg-foreground text-background border-foreground"
                        : "border-foreground/15 text-foreground/60 hover:border-foreground/40"
                    )}
                  >
                    {t("prefs.serif")}
                  </button>
                </div>
              </div>

              {/* Spacing */}
              <div className="space-y-2">
                <p className="text-xs text-foreground/50">{t("prefs.lineSpacing")}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => set({ relaxed: false })}
                    className={cn(
                      "py-2 rounded-lg border text-sm transition-colors",
                      !prefs.relaxed
                        ? "bg-foreground text-background border-foreground"
                        : "border-foreground/15 text-foreground/60 hover:border-foreground/40"
                    )}
                  >
                    {t("prefs.normal")}
                  </button>
                  <button
                    onClick={() => set({ relaxed: true })}
                    className={cn(
                      "py-2 rounded-lg border text-sm transition-colors",
                      prefs.relaxed
                        ? "bg-foreground text-background border-foreground"
                        : "border-foreground/15 text-foreground/60 hover:border-foreground/40"
                    )}
                  >
                    {t("prefs.relaxed")}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
