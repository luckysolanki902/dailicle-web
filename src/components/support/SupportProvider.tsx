"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { SupportDialog } from "./SupportDialog";
import {
  track,
  getCurrentEssay,
  getTimeOnPageSec,
  getSessionEssayCount,
  getVisitCount,
} from "@/lib/analytics";
import { journeyEvent } from "@/lib/journey";

export type SupportSource = "navbar" | "footer" | "reader" | "dialog";

interface SupportContextValue {
  open: (source?: SupportSource) => void;
  close: () => void;
  isOpen: boolean;
  /** true once the reader has supported at least once (this device). */
  hasSupported: boolean;
}

const SupportContext = createContext<SupportContextValue | undefined>(undefined);

/** Set to "1" once the reader has supported (persisted per device). */
export const SUPPORTED_KEY = "dailicle:supported";

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

  const open = useCallback(
    (src: SupportSource = "dialog") => {
      setSource(src);
      setIsOpen(true);

      const essay = getCurrentEssay();
      track("support_dialog_open", {
        source: src,
        // The reading trigger is the only "reader" caller and is automatic.
        trigger_type: src === "reader" ? "auto" : "click",
        page_path:
          typeof window !== "undefined" ? window.location.pathname : undefined,
        essay_id: essay?.id,
        category: essay?.category,
        time_on_page_sec: getTimeOnPageSec(),
        essays_read_session: getSessionEssayCount(),
        visit_count: getVisitCount(),
        has_supported_before: hasSupported,
      });
      journeyEvent("support_open", {
        source: src,
        essayId: essay?.id,
        title: essay?.title,
        category: essay?.category,
      });
    },
    [hasSupported]
  );

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
