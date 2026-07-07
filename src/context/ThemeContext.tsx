"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "wooden" | "light" | "dark" | "space" | "fairytale";

const THEMES: Theme[] = ["wooden", "light", "dark", "space", "fairytale"];

function isTheme(value: string | null): value is Theme {
  return value !== null && THEMES.includes(value as Theme);
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("wooden");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const savedTheme = localStorage.getItem("dailicle-theme");
      if (isTheme(savedTheme)) {
        setTheme(savedTheme);
      }

      setMounted(true);
    }, 0);

    return () => clearTimeout(t);
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
