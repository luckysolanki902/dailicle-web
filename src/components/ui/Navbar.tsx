"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LocalizedLink as Link } from "@/i18n/Link";
import { SupportButton } from "@/components/support/SupportButton";
import { useT } from "@/i18n/I18nProvider";
import { splitLocale } from "@/i18n/config";

export function Navbar() {
  const pathname = usePathname();
  const t = useT();
  // Compare against the locale-less path so the active-link filter works under
  // every locale prefix (/es/archive still matches "/archive").
  const { path } = splitLocale(pathname || "/");

  const links = [
    { href: "/", label: t("nav.home") },
    { href: "/archive", label: t("nav.archive") },
    { href: "/manifesto", label: t("nav.manifesto") },
  ];

  // Filter out current page and Feedback (Feedback is footer only)
  const visibleLinks = links.filter((link) => link.href !== path);

  return (
    <motion.nav
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="fixed top-6 left-6 z-40 hidden md:block"
    >
      <div className="flex items-center gap-6">
        {visibleLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-sm font-medium text-foreground/40 hover:text-foreground transition-colors relative group"
          >
            {link.label}
            <span className="absolute -bottom-1 left-0 w-0 h-px bg-foreground transition-all group-hover:w-full" />
          </Link>
        ))}
        {/* Set apart from the links: this is the one thing on the bar that
            asks something of the reader rather than moving them around. */}
        <SupportButton
          source="navbar"
          variant="pill"
          label={t("nav.support")}
          className="text-[13px] font-medium"
        />
      </div>
    </motion.nav>
  );
}
