"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, Volume2, X } from "lucide-react";
import { track, getCurrentEssay } from "@/lib/analytics";

interface AudioPlayerProps {
  /** Relative S3 key (audio/2026/07/xxx.mp3) or full URL. */
  src: string;
  estimatedDuration?: number;
}

function resolveUrl(src: string): string | undefined {
  const base = process.env.NEXT_PUBLIC_CLOUDFRONT_BASEURL;
  if (src.startsWith("http")) {
    if (!base) return src;
    try {
      const path = new URL(src).pathname.replace(/^\//, "");
      return `${base.replace(/\/$/, "")}/${path}`;
    } catch {
      return src;
    }
  }
  return base ? `${base.replace(/\/$/, "")}/${src}` : undefined;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * "Listen instead" – the accessibility path for commuters, tired eyes,
 * and people who never would have read 2,500 words but will hear them.
 */
export function AudioPlayer({ src, estimatedDuration }: AudioPlayerProps) {
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const url = resolveUrl(src);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => {
      setPlaying(false);
      setCurrentTime(0);
      track("audio_complete", { essay_id: getCurrentEssay()?.id, category: getCurrentEssay()?.category });
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [visible]);

  if (!url) return null;

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play();
    setPlaying(!playing);
  };

  const start = () => {
    setVisible(true);
    track("audio_play", {
      essay_id: getCurrentEssay()?.id,
      category: getCurrentEssay()?.category,
    });
    setTimeout(() => {
      audioRef.current?.play();
      setPlaying(true);
    }, 100);
  };

  const stop = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying(false);
    setVisible(false);
    setCurrentTime(0);
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  return (
    <>
      {!visible && (
        <button
          onClick={start}
          className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-accent hover:opacity-75 transition-opacity"
        >
          <Volume2 size={13} />
          <span>Listen instead</span>
          {estimatedDuration ? (
            <span className="text-foreground/40 normal-case tracking-normal">
              · {Math.round(estimatedDuration / 60)} min
            </span>
          ) : null}
        </button>
      )}

      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
          >
            <audio ref={audioRef} src={url} preload="metadata" />
            <div className="flex items-center gap-4 px-5 py-3 bg-background/95 backdrop-blur-sm border border-foreground/15 rounded-full shadow-lg">
              <button
                onClick={toggle}
                className="text-foreground/70 hover:text-foreground transition-colors"
                aria-label={playing ? "Pause narration" : "Play narration"}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>

              <div className="flex items-center gap-3">
                <span className="text-xs text-foreground/45 font-mono tabular-nums">
                  {formatTime(currentTime)}
                </span>
                <div
                  className="w-32 md:w-48 h-1 bg-foreground/10 rounded-full overflow-hidden cursor-pointer"
                  onClick={seek}
                  role="slider"
                  aria-label="Seek"
                  aria-valuenow={Math.round(currentTime)}
                  aria-valuemin={0}
                  aria-valuemax={Math.round(duration || estimatedDuration || 0)}
                >
                  <div
                    className="h-full bg-accent rounded-full"
                    style={{
                      width: duration ? `${(currentTime / duration) * 100}%` : "0%",
                    }}
                  />
                </div>
                <span className="text-xs text-foreground/35 font-mono tabular-nums">
                  {formatTime(duration || estimatedDuration || 0)}
                </span>
              </div>

              <button
                onClick={stop}
                className="text-foreground/35 hover:text-foreground/70 transition-colors"
                aria-label="Stop and close player"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
