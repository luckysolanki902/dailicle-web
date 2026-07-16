"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { SupportButton } from "@/components/support/SupportButton";

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home" },
    { href: "/archive", label: "Archive" },
    { href: "/manifesto", label: "Why Read?" },
  ];

  // Filter out current page and Feedback (Feedback is footer only)
  const visibleLinks = links.filter(link => link.href !== pathname);

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
        <SupportButton
          source="navbar"
          className="text-sm font-medium text-foreground/40 hover:text-foreground"
        />
      </div>
    </motion.nav>
  );
}
