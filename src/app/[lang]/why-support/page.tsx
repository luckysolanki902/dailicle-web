"use client";

import { useT } from "@/i18n/I18nProvider";
import { SupportButton } from "@/components/support/SupportButton";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

export default function WhySupportPage() {
  const t = useT();
  return (
    <main className="min-h-screen bg-background px-6 py-28 text-foreground">
      <ThemeSwitcher />
      <article className="mx-auto max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">The Dailicle</p>
        <h1 className="mt-4 font-display text-4xl tracking-tight">{t("support.aboutTitle")}</h1>
        <div className="mt-8 space-y-6 font-serif text-lg leading-relaxed text-foreground/75">
          <p>{t("support.aboutIntro")}</p>
          <p>{t("support.aboutPurpose")}</p>
          <p>{t("support.aboutHonesty")}</p>
          <p>{t("support.aboutCorrections")}</p>
        </div>
        <div className="mt-10 flex flex-wrap gap-5 text-sm">
          <SupportButton source="footer" label={t("support.cardCta")} variant="pill" />
          <a href="mailto:read@dailicle.com" className="self-center text-accent underline-offset-4 hover:underline">
            read@dailicle.com
          </a>
        </div>
      </article>
    </main>
  );
}
