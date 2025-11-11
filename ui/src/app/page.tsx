'use client';

import { useEffect, useMemo } from "react";
import anime from "animejs/lib/anime.es.js";
import { GlobeScene } from "@/components/GlobeScene";
import { HUDOverlay } from "@/components/HUDOverlay";
import { UploadButton } from "@/components/UploadButton";
import { SettingsPanel } from "@/components/SettingsPanel";
import { AnalysisResultsPanel } from "@/components/AnalysisResultsPanel";
import { useAnalysisStore } from "@/stores/analysisStore";

const backgroundLayers = [
  "radial-gradient(circle at 20% 20%, rgba(0,255,255,0.08), transparent 55%)",
  "radial-gradient(circle at 80% 30%, rgba(255,0,255,0.12), transparent 60%)",
  "linear-gradient(140deg, #050510 10%, #090424 50%, #120a3a 90%)",
];

const audioSrc = "/audio/cyber-hum.mp3";
const enableAudio = process.env.NEXT_PUBLIC_ENABLE_INTERFACE_AUDIO === "true";

export default function Home() {
  const phase = useAnalysisStore((state) => state.phase);
  const useSerpApi = useAnalysisStore((state) => state.useSerpApi);
  const setSettingsOpen = useAnalysisStore((state) => state.setSettingsOpen);

  useEffect(() => {
    const neonSweep = anime({
      targets: ".background-overlay",
      opacity: [
        { value: 0.35, duration: 2200 },
        { value: 0.12, duration: 2800 },
      ],
      easing: "easeInOutSine",
      loop: true,
    });
    return () => neonSweep.pause();
  }, []);

  const combinedBackground = useMemo(() => backgroundLayers.join(", "), []);

  return (
    <main
      className="relative flex min-h-screen w-full flex-col overflow-hidden bg-black text-white"
      style={{ backgroundImage: combinedBackground }}
    >
      <div className="noise-overlay" />
      <div className="background-overlay pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,255,0.2),transparent_70%)] blur-3xl" />

      <div className="absolute inset-0">
        <GlobeScene />
      </div>

      <div className="relative z-10 flex h-screen w-full flex-col">
        <header className="flex items-start justify-between px-8 pt-10 md:px-14">
          <div className="space-y-2">
            <span className="block font-display text-xs uppercase tracking-[0.4em] text-cyan-200">
              GeoIntel Systems
            </span>
            <span className="block font-display text-xs uppercase tracking-[0.35em] text-magenta-300/80">
              Neural Recon Module
            </span>
          </div>
          <div className="flex flex-col items-end gap-3 text-right">
            <div className="hidden rounded-full border border-cyan-400/20 bg-black/50 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.3em] text-cyan-200/80 md:flex">
              <span className="pr-3 text-cyan-200">Phase: {phase}</span>
              <span className="border-l border-cyan-400/20 pl-3 text-cyan-200/70">
                SerpAPI: {useSerpApi ? "Active" : "Dormant"}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="rounded-full border border-cyan-400/40 bg-black/40 px-4 py-2 font-display text-[10px] uppercase tracking-[0.35em] text-cyan-200 transition hover:border-magenta-400/60 hover:text-white"
              >
                Settings
              </button>
            </div>
          </div>
        </header>

        <div className="relative flex-1">
          <HUDOverlay />
          <AnalysisResultsPanel />
        </div>

        <footer className="flex items-center justify-end px-8 pb-10 md:px-14">
          <UploadButton />
        </footer>
      </div>

      {enableAudio && <audio src={audioSrc} autoPlay loop className="hidden" />}
      <SettingsPanel />
    </main>
  );
}
