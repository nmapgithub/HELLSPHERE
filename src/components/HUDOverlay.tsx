"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import anime from "animejs";
import { useAnalysisStore } from "@/stores/analysisStore";

export function HUDOverlay() {
  const { phase, target } = useAnalysisStore((state) => ({
    phase: state.phase,
    target: state.target,
  }));

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
      <div className="hud-grid absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,255,0.22),transparent_60%)]" />

      <div className="relative h-[320px] w-[320px] max-w-[60vw]">
        <div className="hud-scan-ring absolute inset-0 rounded-full border border-cyan-400/50 shadow-[0_0_50px_rgba(0,255,255,0.4)]" />
        <div className="hud-scan-ring absolute inset-[12%] rounded-full border border-magenta-400/45 shadow-[0_0_35px_rgba(255,0,255,0.3)]" />
        <div className="absolute inset-[23%] rounded-full border border-purple-500/45 shadow-[0_0_30px_rgba(160,32,240,0.3)]" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-full w-px bg-gradient-to-b from-transparent via-cyan-400/60 to-transparent" />
        </div>
      </div>

      <div className="mt-16 flex min-h-[120px] w-full max-w-4xl flex-col items-center space-y-4 px-6 text-center">
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
              transition={{ duration: 0.45, ease: "easeInOutQuad" }}
              className="text-sm font-mono uppercase tracking-[0.3em] text-cyan-300/80"
            >
              {phase === "idle" && "Awaiting Recon Input"}
              {phase === "uploading" && "Uploading Asset…"}
              {phase === "analyzing" && "Running Neural Scan…"}
              {phase === "targeting" && "Triangulating Coordinates…"}
            </motion.div>
          )}
        </AnimatePresence>

        {target && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "acquired" ? 1 : 0.6 }}
            transition={{ duration: 0.6 }}
            className="flex items-center space-x-6 text-xs uppercase tracking-[0.25em] text-cyan-200/80"
          >
            <div>Lat: {target.latitude.toFixed(2)}°</div>
            <div>Lon: {target.longitude.toFixed(2)}°</div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

