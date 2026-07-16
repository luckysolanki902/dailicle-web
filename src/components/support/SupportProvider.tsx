"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { SupportDialog } from "./SupportDialog";

export type SupportSource = "navbar" | "footer" | "reader" | "dialog";

interface SupportContextValue {
  open: (source?: SupportSource) => void;
  close: () => void;
  isOpen: boolean;
  /** true once the reader has supported at least once (this device). */
  hasSupported: boolean;
}

const SupportContext = createContext<SupportContextValue | undefined>(undefined);

const SUPPORTED_KEY = "dailicle:supported";

export function SupportProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [source, setSource] = useState<SupportSource>("dialog");
  const [hasSupported, setHasSupported] = useState(false);

  React.useEffect(() => {
    try {
      setHasSupported(localStorage.getItem(SUPPORTED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const open = useCallback((src: SupportSource = "dialog") => {
    setSource(src);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const markSupported = useCallback(() => {
    try {
      localStorage.setItem(SUPPORTED_KEY, "1");
    } catch {
      /* ignore */
    }
    setHasSupported(true);
  }, []);

  return (
    <SupportContext.Provider value={{ open, close, isOpen, hasSupported }}>
      {children}
      <SupportDialog
        isOpen={isOpen}
        source={source}
        onClose={close}
        onSupported={markSupported}
      />
    </SupportContext.Provider>
  );
}

export function useSupport(): SupportContextValue {
  const ctx = useContext(SupportContext);
  if (!ctx) throw new Error("useSupport must be used within a SupportProvider");
  return ctx;
}
