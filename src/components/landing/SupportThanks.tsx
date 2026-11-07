"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

type Contribution = { day: string; country: string | null; currency: string; amount: number };

function flag(country: string) {
  return String.fromCodePoint(...Array.from(country, (letter) => 0x1f1a5 + letter.charCodeAt(0)));
}

export function SupportThanks() {
  const { locale, t } = useI18n();
  const [contributions, setContributions] = useState<Contribution[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/support/public-feed", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((feed) => setContributions(feed?.contributions ?? []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!contributions.length) return null;

  const days = new Map<string, Contribution[]>();
  for (const contribution of contributions) {
    const group = days.get(contribution.day);
    if (group) group.push(contribution);
    else days.set(contribution.day, [contribution]);
  }

  const regions = new Intl.DisplayNames([locale], { type: "region" });
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });

  return (
    <section
      aria-labelledby="support-thanks-title"
      className="mx-auto mb-8 max-w-lg overflow-hidden rounded-[1.5rem] border border-foreground/10 bg-background text-start shadow-[0_16px_44px_-28px_color-mix(in_srgb,var(--foreground)_45%,transparent)]"
    >
      <header className="flex items-center gap-3.5 px-4 py-4 sm:px-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-[0.95rem] border border-accent/15 bg-accent/10 text-accent">
          <Heart size={17} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="support-thanks-title" className="font-display text-xl leading-tight tracking-tight sm:text-[1.4rem]">
            {t("home.supportThanksTitle")}
          </h2>
          <p className="mt-0.5 text-xs leading-relaxed text-foreground/65">
            {t("home.supportThanksBody")}
          </p>
        </div>
      </header>

      <div
        aria-label={t("home.supportThanksFeed")}
        role="region"
        tabIndex={0}
        className="max-h-60 overflow-y-auto overscroll-contain border-y border-foreground/8 bg-accent/[0.065] px-4 py-3.5 sm:px-5 [scrollbar-color:color-mix(in_srgb,var(--accent)_32%,transparent)_transparent] [scrollbar-width:thin]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--accent) 17%, transparent) 1px, transparent 0)",
          backgroundSize: "18px 18px",
        }}
      >
        {Array.from(days, ([day, entries]) => (
          <div key={day} className="mb-3 last:mb-0">
            <div className="mb-2 flex justify-center">
              <time dateTime={day} className="rounded-full border border-foreground/10 bg-background px-2.5 py-0.5 text-[0.66rem] font-medium tracking-wide text-foreground/70">
                {dates.format(new Date(`${day}T00:00:00Z`))}
              </time>
            </div>
            <ul className="space-y-1.5">
              {entries.map(({ country, currency, amount }, index) => (
                <li
                  key={index}
                  className="relative ms-1.5 w-fit max-w-[calc(100%-0.375rem)] rounded-2xl rounded-ss-[0.3rem] border border-foreground/10 bg-background px-2.5 py-2 text-[0.8125rem] leading-relaxed text-foreground/85 shadow-sm sm:px-3 sm:text-sm before:absolute before:start-[-5px] before:top-[5px] before:size-2 before:rotate-45 before:border-b before:border-l before:border-foreground/10 before:bg-background before:content-['']"
                >
                  {country
                    ? t("home.supportThanksFrom", { country: `${flag(country)} ${regions.of(country) ?? country}` })
                    : t("home.supportThanksUnknown")}{" "}
                  <strong className="whitespace-nowrap font-semibold tabular-nums text-foreground">
                    {new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 0 }).format(amount)}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="px-4 py-3 text-end text-xs text-foreground/65 sm:px-5">
        {t("home.supportThanksSignature")}
      </p>
    </section>
  );
}
