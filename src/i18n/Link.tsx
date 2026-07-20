"use client";

import NextLink from "next/link";
import { forwardRef } from "react";
import { localeHref } from "@/i18n/config";
import { useLocale } from "@/i18n/I18nProvider";

type NextLinkProps = React.ComponentProps<typeof NextLink>;

/**
 * A drop-in replacement for next/link that prefixes the current locale onto
 * internal, locale-less hrefs. Components can keep writing href="/archive" and
 * a Spanish reader will be sent to "/es/archive" automatically. External URLs,
 * anchors, and already-prefixed paths are left untouched.
 *
 * Usage: import { LocalizedLink as Link } from "@/i18n/Link";
 */
export const LocalizedLink = forwardRef<HTMLAnchorElement, NextLinkProps>(
  function LocalizedLink({ href, ...rest }, ref) {
    const locale = useLocale();

    let localized = href;
    if (typeof href === "string" && href.startsWith("/")) {
      localized = localeHref(href, locale);
    }

    return <NextLink ref={ref} href={localized} {...rest} />;
  }
);
