"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getBackendUrl } from "@/lib/api";
import { useAnalysisStore } from "@/stores/analysisStore";

function resolveImageUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return getBackendUrl(path);
}

const formatSerpContext = (context?: string | null) => {
  if (!context) return [];
  return context
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
};

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-cyan-400/15 bg-black/35 px-4 py-3 text-left transition hover:border-cyan-400/30"
    >
      <summary className="cursor-pointer list-none font-display text-[10px] uppercase tracking-[0.3em] text-cyan-200/80">
        <span className="inline-flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-cyan-300/80 transition group-open:rotate-90" />
          {title}
        </span>
      </summary>
      <div className="mt-3 space-y-2 text-[11px] font-mono tracking-[0.1em] text-cyan-100/80">
        {children}
      </div>
    </details>
  );
}

function LocationCard({
  label,
  location,
  isPrimary,
}: {
  label: string;
  location: {
    city?: string;
    state?: string;
    country?: string;
    confidence?: string;
    explanation?: string;
    coordinates?: { latitude?: number; longitude?: number } | null;
  };
  isPrimary?: boolean;
}) {
  const name = location.city || location.state || location.country || label;
  return (
    <div
      className={`rounded-xl border px-4 py-3 transition ${
        isPrimary
          ? "border-cyan-400/40 bg-cyan-400/10 shadow-[0_0_25px_rgba(0,255,255,0.15)]"
          : "border-cyan-400/15 bg-black/30"
      }`}
    >
      <p className="font-display text-[10px] uppercase tracking-[0.35em] text-cyan-100">
        {name}
      </p>
      <div className="mt-2 space-y-1 text-[11px] font-mono tracking-[0.15em] text-cyan-100/80">
        {location.confidence && <p>Confidence: {location.confidence}</p>}
        {location.coordinates && (
          <p>
            {typeof location.coordinates.latitude === "number" && (
              <span>Lat {location.coordinates.latitude.toFixed(2)}</span>
            )}
            {typeof location.coordinates.longitude === "number" && (
              <span>
                {typeof location.coordinates.latitude === "number" ? " • " : ""}
                Lon {location.coordinates.longitude.toFixed(2)}
              </span>
            )}
          </p>
        )}
        {location.explanation && (
          <p className="whitespace-pre-line text-cyan-200/70">
            {location.explanation}
          </p>
        )}
      </div>
    </div>
  );
}

export function AnalysisResultsPanel() {
  const phase = useAnalysisStore((state) => state.phase);
  const analysisPayload = useAnalysisStore((state) => state.analysis);
  const errorMessage = useAnalysisStore((state) => state.errorMessage);
  const setSettingsOpen = useAnalysisStore((state) => state.setSettingsOpen);
  const target = useAnalysisStore((state) => state.target);

  const imageUrl = useMemo(() => {
    if (!analysisPayload?.image) return null;
    return (
      resolveImageUrl(analysisPayload.image.url) ??
      resolveImageUrl(analysisPayload.image.path) ??
      null
    );
  }, [analysisPayload]);

  const analysis = analysisPayload?.analysis;
  const analysisError =
    analysis && "error" in analysis
      ? (analysis as Record<string, unknown>).error
      : undefined;
  const topLocation = analysis?.locations?.[0];
  const additionalLocations = analysis?.locations?.slice(1) ?? [];
  const serpContextLines = formatSerpContext(analysis?.serpapi_results?.context);

  const mapCoordinates = useMemo(() => {
    const locationCoords = topLocation?.coordinates;
    if (locationCoords && typeof locationCoords.latitude === "number" && typeof locationCoords.longitude === "number") {
      return {
        latitude: locationCoords.latitude,
        longitude: locationCoords.longitude,
      };
    }
    if (target) {
      return {
        latitude: target.latitude,
        longitude: target.longitude,
      };
    }
    return undefined;
  }, [topLocation, target]);

  const mapEmbedUrl = useMemo(() => {
    if (!mapCoordinates) return null;
    const { latitude, longitude } = mapCoordinates;
    return `https://maps.google.com/maps?q=${latitude},${longitude}&t=k&z=15&output=embed`;
  }, [mapCoordinates]);

  return (
    <div className="pointer-events-none absolute right-6 top-24 z-30 flex w-full max-w-xs flex-col gap-4 text-left md:max-w-sm lg:right-10">
      <AnimatePresence>
        {(analysis || errorMessage) && (
          <motion.div
            key={analysis ? "analysis" : "analysis-error"}
            initial={{ x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 80, opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="pointer-events-auto max-h-[calc(100vh-160px)] overflow-y-auto rounded-3xl border border-cyan-400/25 bg-[#060616]/90 p-6 text-cyan-50 shadow-[0_0_45px_rgba(0,255,255,0.15)] backdrop-blur-lg pr-4"
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-[10px] uppercase tracking-[0.35em] text-cyan-200">
                  Recon Summary
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-200/60">
                  {phase === "acquired" ? "Target Locked" : "Analyzing"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="rounded-full border border-cyan-400/30 px-3 py-1 font-display text-[9px] uppercase tracking-[0.3em] text-cyan-200 transition hover:border-magenta-400/40 hover:text-white"
              >
                Settings
              </button>
            </header>

            {imageUrl && (
              <div className="mt-4 overflow-hidden rounded-xl border border-cyan-400/15 shadow-[0_0_25px_rgba(0,0,0,0.4)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt={analysisPayload?.image?.filename || "Recon asset"}
                  className="h-32 w-full object-cover"
                />
              </div>
            )}

            {mapEmbedUrl && (
              <Section title="Map Preview" defaultOpen>
                <div className="overflow-hidden rounded-xl border border-cyan-400/20">
                  <iframe
                    src={mapEmbedUrl}
                    title="Target Map"
                    className="h-48 w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                {mapCoordinates && (
                  <a
                    href={`https://maps.google.com/?q=${mapCoordinates.latitude},${mapCoordinates.longitude}&t=k&z=17`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-100/80 transition hover:border-magenta-400/40 hover:text-white"
                  >
                    Open in Google Maps
                  </a>
                )}
              </Section>
            )}

            {errorMessage && (
              <p className="mt-4 text-[11px] font-mono uppercase tracking-[0.25em] text-magenta-200/80">
                {errorMessage}
              </p>
            )}

            {analysisError && !analysis?.interpretation && (
              <Section title="Analysis Error" defaultOpen>
                <p className="text-magenta-100/80">{String(analysisError)}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-magenta-200/60">
                  Verify your Gemini API key in Settings.
                </p>
              </Section>
            )}

            {!analysis && !errorMessage && (
              <p className="mt-5 text-[11px] font-mono uppercase tracking-[0.2em] text-cyan-200/60">
                Upload an image to initiate reconnaissance.
              </p>
            )}

            {topLocation && (
              <Section title="Primary Fix" defaultOpen>
                <LocationCard label="Primary Target" location={topLocation} isPrimary />
              </Section>
            )}

            {additionalLocations.length > 0 && (
              <Section title="Alternate Candidates" defaultOpen={false}>
                <div className="space-y-3">
                  {additionalLocations.map((location, index) => (
                    <LocationCard
                      key={`alt-${index}`}
                      label={`Candidate ${index + 2}`}
                      location={location}
                    />
                  ))}
                </div>
              </Section>
            )}

            {analysis?.interpretation && (
              <Section title="Gemini Assessment">
                <p className="whitespace-pre-line text-cyan-100/80">
                  {analysis.interpretation}
                </p>
              </Section>
            )}

            {serpContextLines.length > 0 && (
              <Section title="SerpAPI Context" defaultOpen={false}>
                <ul className="space-y-2 text-cyan-100/70">
                  {serpContextLines.map((line, index) => (
                    <li key={`serp-${index}`}>{line}</li>
                  ))}
                </ul>
              </Section>
            )}

            {analysis?.exif_data && (
              <Section title="EXIF Metadata" defaultOpen={false}>
                {analysis.exif_data.has_gps && analysis.exif_data.gps_coordinates ? (
                  <p>
                    GPS: Lat {analysis.exif_data.gps_coordinates.latitude}, Lon {" "}
                    {analysis.exif_data.gps_coordinates.longitude}
                  </p>
                ) : (
                  <p>No embedded GPS coordinates detected.</p>
                )}
                {!analysis.exif_data.has_exif && <p>No EXIF metadata found.</p>}
              </Section>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
