"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { UnsubscribeConfirm } from "@/components/subscribe/UnsubscribeConfirm";
import { useT } from "@/i18n/I18nProvider";

export default function UnsubscribePage() {
  const t = useT();
  return (
    <main className="relative min-h-screen bg-background text-foreground transition-colors duration-500">
      <ThemeSwitcher />

      <div className="max-w-2xl mx-auto px-6 py-32 md:py-40">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-12"
        >
          <header className="space-y-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight">{t("unsubscribe.title")}</h1>
            <p className="text-lg text-foreground/60">{t("unsubscribe.subtitle")}</p>
          </header>

          {/* useSearchParams needs a boundary so the shell can still prerender. */}
          <Suspense fallback={null}>
            <UnsubscribeConfirm />
          </Suspense>

          <p className="pt-12 text-center text-sm text-foreground/40">
            {t("unsubscribe.note")}
          </p>
        </motion.div>
      </div>
    </main>
  );
}
