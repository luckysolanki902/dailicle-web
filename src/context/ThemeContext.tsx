"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "wooden" | "space" | "fairytale";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("wooden");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check system preference initially if no saved theme
    const savedTheme = localStorage.getItem("dailicle-theme") as Theme;
    if (savedTheme && savedTheme !== "wooden") {
      setTimeout(() => setTheme(savedTheme), 0);
    }
    // Default to wooden (Study) if no preference saved, ignoring system preference to enforce brand vibe
    setTimeout(() => setMounted(true), 0);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    // Remove all theme classes
    document.body.classList.remove(
      "theme-light",
      "theme-dark",
      "theme-wooden",
      "theme-space",
      "theme-fairytale"
    );
    
    // Add current theme class
    document.body.classList.add(`theme-${theme}`);
    
    // Save to local storage
    localStorage.setItem("dailicle-theme", theme);
  }, [theme, mounted]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
