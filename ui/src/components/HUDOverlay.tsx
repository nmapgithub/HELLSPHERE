"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import anime from "animejs/lib/anime.es.js";
import { useAnalysisStore } from "@/stores/analysisStore";

export function HUDOverlay() {
  const phase = useAnalysisStore((state) => state.phase);
  const target = useAnalysisStore((state) => state.target);
  const errorMessage = useAnalysisStore((state) => state.errorMessage);
  const primaryLocation = useAnalysisStore(
    (state) => state.analysis?.analysis?.locations?.[0],
  );

  useEffect(() => {
    const scanningRings = anime({
      targets: ".hud-scan-ring",
      scale: [
        { value: 0.1, duration: 0 },
        { value: 1, duration: 2400 },
      ],
      opacity: [
        { value: 0.9, duration: 400 },
        { value: 0, duration: 2000 },
      ],
      easing: "easeOutQuad",
      loop: true,
    });

    const gridPulse = anime({
      targets: ".hud-grid",
      opacity: [
        { value: 0.15, duration: 0 },
        { value: 0.35, duration: 1500 },
        { value: 0.1, duration: 1500 },
      ],
      easing: "easeInOutSine",
      loop: true,
    });

    return () => {
      scanningRings.pause();
      gridPulse.pause();
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,30,0.45),transparent_70%)]" />
      <div className="hud-grid pointer-events-none absolute inset-20 rounded-full border border-cyan-400/15" />

      <div className="relative h-[420px] w-[420px] max-w-[75vw]">
        <div className="hud-scan-ring absolute inset-4 rounded-full border border-cyan-400/40 shadow-[0_0_75px_rgba(0,255,255,0.35)]" />
        <div className="hud-scan-ring absolute inset-[18%] rounded-full border border-magenta-400/35 shadow-[0_0_55px_rgba(255,0,255,0.25)]" />
        <div className="hud-scan-ring absolute inset-[32%] rounded-full border border-purple-500/30 shadow-[0_0_45px_rgba(160,32,240,0.25)]" />
        <div className="pointer-events-none absolute inset-[46%] rounded-full border border-cyan-200/30" />

        <div className="absolute inset-4 flex items-center justify-center">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
        </div>
        <div className="absolute inset-4 flex items-center justify-center">
          <div className="h-full w-px bg-gradient-to-b from-transparent via-cyan-300/70 to-transparent" />
        </div>
        <div className="absolute inset-[18%] flex items-center justify-center">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-magenta-400/60 to-transparent" />
        </div>
        <div className="absolute inset-[18%] flex items-center justify-center">
          <div className="h-full w-px bg-gradient-to-b from-transparent via-magenta-400/60 to-transparent" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-[3px] w-[35%] rounded-full bg-cyan-300/50" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[3px] h-[35%] rounded-full bg-cyan-300/50" />
        </div>
      </div>

      <div className="mt-16 flex min-h-[140px] w-full max-w-4xl flex-col items-center space-y-4 px-6 text-center">
        <AnimatePresence mode="wait">
          {phase === "acquired" && target && (
            <motion.div
              key="target-acquired"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.6, ease: [0.25, 0.8, 0.25, 1] }}
              className="rounded-md border border-cyan-400/40 bg-black/60 px-6 py-4 font-display text-lg uppercase tracking-[0.45em] text-cyan-200 shadow-[0_0_30px_rgba(0,255,255,0.35)] backdrop-blur-md"
            >
              Target Acquired
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          {phase !== "acquired" && (
            <motion.div
              key={phase}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeInOut" }}
              className="text-sm font-mono uppercase tracking-[0.3em] text-cyan-300/80"
            >
              {phase === "idle" && "Awaiting Recon Input"}
              {phase === "uploading" && "Uploading Asset…"}
              {phase === "analyzing" && "Running Neural Scan…"}
              {phase === "targeting" && "Triangulating Coordinates…"}
            </motion.div>
          )}
        </AnimatePresence>

        {target && 
          primaryLocation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="pointer-events-auto mt-6 w-full max-w-md rounded-2xl border border-cyan-400/25 bg-black/60 p-4 text-left shadow-[0_0_35px_rgba(0,255,255,0.15)]"
            >
              <p className="font-display text-[10px] uppercase tracking-[0.35em] text-cyan-200/90">
                Target Blueprint
              </p>
              <div className="mt-3 grid grid-cols-[auto_1fr] gap-4">
                <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-cyan-400/20 bg-[radial-gradient(circle_at_center,rgba(0,255,255,0.25),transparent_70%)]">
                  <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.12)_1px,transparent_1px)] bg-[size:12px_12px]" />
                  <div className="absolute inset-[35%] rounded-full border border-magenta-400/50 shadow-[0_0_15px_rgba(255,0,255,0.4)]" />
                  <div className="absolute inset-[47%] rounded-full border border-cyan-300/60" />
                </div>
                <div className="space-y-1 text-[11px] font-mono tracking-[0.15em] text-cyan-100/80">
                  <p className="font-display text-[11px] uppercase tracking-[0.4em] text-cyan-100">
                    {primaryLocation.city || primaryLocation.state || primaryLocation.country || "Unknown Target"}
                  </p>
                  {primaryLocation.confidence && <p>Confidence: {primaryLocation.confidence}</p>}
                  <p>
                    Lat {target.latitude.toFixed(2)} • Lon {target.longitude.toFixed(2)}
                  </p>
                  {primaryLocation.explanation && (
                    <p className="text-[10px] tracking-[0.2em] text-cyan-200/70">
                      {primaryLocation.explanation.slice(0, 160)}{" "}
                      {primaryLocation.explanation.length > 160 ? "…" : ""}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

        {target && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "acquired" ? 1 : 0.6 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="flex flex-col items-center space-y-2 text-xs uppercase tracking-[0.25em] text-cyan-200/80"
          >
            {primaryLocation && (
              <span className="font-display text-[11px] tracking-[0.35em] text-cyan-100/90">
                {primaryLocation.city || primaryLocation.state || primaryLocation.country || "Unknown Target"}
              </span>
            )}
            <div className="flex items-center space-x-6">
              <div>Lat: {target.latitude.toFixed(2)}°</div>
              <div>Lon: {target.longitude.toFixed(2)}°</div>
            </div>
            {primaryLocation?.confidence && (
              <span className="text-[10px] tracking-[0.3em] text-cyan-200/60">
                Confidence: {primaryLocation.confidence}
              </span>
            )}
          </motion.div>
        )}

        <AnimatePresence>
          {errorMessage && (
            <motion.div
              key={errorMessage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="max-w-xl rounded-md border border-magenta-500/40 bg-black/70 px-4 py-3 text-xs font-mono uppercase tracking-[0.2em] text-magenta-200/90 backdrop-blur"
            >
              {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
