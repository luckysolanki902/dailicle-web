"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

type Amount = { currency: string; amount: number };
type Summary = { totals: Amount[]; countries: (Amount & { country: string })[] };

export function SupportThanks() {
  const { locale, t } = useI18n();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/support/public-summary", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then(setSummary)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  if (!summary?.totals.length) return null;
  const regions = new Intl.DisplayNames([locale], { type: "region" });
  const format = ({ amount, currency }: Amount) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "code" }).format(amount);

  return (
    <section aria-labelledby="support-thanks-title" className="mb-6 rounded-2xl border border-accent/20 bg-accent/5 px-5 py-6 sm:px-8">
      <h2 id="support-thanks-title" className="font-display text-2xl tracking-tight">
        {t("home.supportThanksTitle")}
      </h2>
      <p className="mt-2 font-serif text-sm leading-relaxed text-foreground/65">
        {t("home.supportThanksBody")}
      </p>
      <p className="mt-4 text-sm font-semibold text-foreground">
        {t("home.supportThanksTotal")} <span className="tabular-nums">{summary.totals.map(format).join(" · ")}</span>
      </p>
      {summary.countries.length > 0 && (
        <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-foreground/65">
          {summary.countries.map((row) => (
            <li key={`${row.country}-${row.currency}`}>
              {regions.of(row.country)} <span className="tabular-nums">{format(row)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-foreground/55">{t("home.supportThanksSignature")}</p>
    </section>
  );
}
