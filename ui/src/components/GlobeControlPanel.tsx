"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGlobeStore,
  OverlayKey,
  SearchResult,
  SavedTarget,
} from "@/stores/globeStore";
import { useAnalysisStore } from "@/stores/analysisStore";

type SpeechRecognitionResultEvent = {
  results: ArrayLike<{ 0?: { transcript: string } }>;
};

interface BasicSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionResultEvent) => void;
  onstart: () => void;
  onend: () => void;
  onerror: () => void;
}

type SpeechRecognitionConstructor = new () => BasicSpeechRecognition;

const OVERLAY_LABELS: Record<OverlayKey, string> = {
  heatmap: "Thermal Overlay",
  routes: "Transit Arcs",
  weather: "Weather Cells",
};

const formatNumber = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString();
};

const formatDistance = (km: number | null | undefined) => {
  if (km == null) return "—";
  if (km >= 1000) return `${(km / 1000).toFixed(1)} Mm`;
  return `${km.toFixed(0)} km`;
};

const formatUtc = (iso: string | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toUTCString().replace(" GMT", "");
};

export function GlobeControlPanel() {
  const overlays = useGlobeStore((state) => state.overlays);
  const overlayIntensity = useGlobeStore((state) => state.overlayIntensity);
  const setOverlayEnabled = useGlobeStore((state) => state.setOverlayEnabled);
  const setOverlayIntensity = useGlobeStore((state) => state.setOverlayIntensity);
  const timeline = useGlobeStore((state) => state.timeline);
  const timelineIndex = useGlobeStore((state) => state.timelineIndex);
  const setTimelineIndex = useGlobeStore((state) => state.setTimelineIndex);
  const isPlayingTimeline = useGlobeStore((state) => state.isPlayingTimeline);
  const setIsPlayingTimeline = useGlobeStore((state) => state.setIsPlayingTimeline);
  const useNasaTexture = useGlobeStore((state) => state.useNasaTexture);
  const setUseNasaTexture = useGlobeStore((state) => state.setUseNasaTexture);

  const searchQuery = useGlobeStore((state) => state.searchQuery);
  const setSearchQuery = useGlobeStore((state) => state.setSearchQuery);
  const searchResults = useGlobeStore((state) => state.searchResults);
  const setSearchResults = useGlobeStore((state) => state.setSearchResults);
  const updateSearchResult = useGlobeStore((state) => state.updateSearchResult);
  const searchLoading = useGlobeStore((state) => state.searchLoading);
  const setSearchLoading = useGlobeStore((state) => state.setSearchLoading);
  const searchError = useGlobeStore((state) => state.searchError);
  const setSearchError = useGlobeStore((state) => state.setSearchError);
  const savedTargets = useGlobeStore((state) => state.savedTargets);
  const addSavedTarget = useGlobeStore((state) => state.addSavedTarget);
  const removeSavedTarget = useGlobeStore((state) => state.removeSavedTarget);
  const recentQueries = useGlobeStore((state) => state.recentQueries);
  const pushRecentQuery = useGlobeStore((state) => state.pushRecentQuery);
  const recordQueryTrail = useGlobeStore((state) => state.recordQueryTrail);
  const setActiveGeofence = useGlobeStore((state) => state.setActiveGeofence);

  const setTarget = useAnalysisStore((state) => state.setTarget);
  const setPhase = useAnalysisStore((state) => state.setPhase);
  const currentTarget = useAnalysisStore((state) => state.target);

  const [inputValue, setInputValue] = useState(searchQuery);
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "error">("idle");
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<BasicSpeechRecognition | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setInputValue(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const constructors = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SpeechRecognitionCtor =
      constructors.SpeechRecognition ?? constructors.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setVoiceAvailable(false);
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: SpeechRecognitionResultEvent) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setInputValue(transcript);
        setSearchQuery(transcript);
      }
    };
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    setVoiceAvailable(true);
    return () => {
      recognition.stop();
    };
  }, [setSearchQuery]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!inputValue || inputValue.trim().length < 3) {
      setSearchLoading(false);
      setSearchResults([]);
      setSearchError(undefined);
      return;
    }

    const controller = new AbortController();

    const nextTimer = setTimeout(async () => {
      setSearchLoading(true);
      setSearchError(undefined);
      try {
        const params = new URLSearchParams({ q: inputValue.trim() });
        const response = await fetch(`/api/geocode?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Geocode failed (${response.status})`);
        }
        const payload = (await response.json()) as {
          results: Array<{
            id: string;
            name: string;
            displayName: string;
            latitude: number;
            longitude: number;
            type?: string;
            boundingBox?: [number, number, number, number];
            country?: string;
            region?: string;
          }>;
        };

        setSearchResults(
          payload.results.map((item) => ({
            ...item,
            timezone: undefined,
            population: undefined,
            elevation: undefined,
            weather: undefined,
            alerts: undefined,
            satellites: undefined,
            links: undefined,
          })),
        );

        await Promise.all(
          payload.results.map(async (result) => {
            try {
              const infoParams = new URLSearchParams({
                latitude: String(result.latitude),
                longitude: String(result.longitude),
                name: result.name,
              });
              const infoResponse = await fetch(
                `/api/location-info?${infoParams.toString()}`,
                {
                  signal: controller.signal,
                },
              );
              if (!infoResponse.ok) return;
              const info = (await infoResponse.json()) as {
                country: string | null;
                region: string | null;
                timezone: string | null;
                population: number | null;
                elevation: number | null;
                imageryUrl?: string;
                fallbackImagery?: string;
                weather?: {
                  temperature: number | null;
                  windspeed: number | null;
                  precipitation: number | null;
                  description: string | null;
                };
                alerts?: Array<{
                  id: string;
                  title: string;
                  source: string;
                  severity?: string;
                  magnitude?: number;
                  distanceKm: number;
                  happenedAt: string;
                }>;
                satellites?: Array<{
                  name: string;
                  noradId: number;
                  distanceKm: number;
                  passTime: string;
                  altitudeKm?: number;
                }>;
                links?: {
                  osm: string;
                  google: string;
                  wikipedia?: string;
                  wikivoyage?: string;
                };
              };

              updateSearchResult(result.id, {
                country: info.country ?? result.country,
                region: info.region ?? result.region,
                timezone: info.timezone ?? undefined,
                population: info.population ?? undefined,
                elevation: info.elevation ?? undefined,
                imageryUrl: info.imageryUrl,
                fallbackImagery: info.fallbackImagery,
                weather: info.weather,
                alerts: info.alerts,
                satellites: info.satellites,
                links: info.links,
              });
            } catch (error) {
              if ((error as Error).name === "AbortError") return;
              console.warn("Failed to enrich result", error);
            }
          }),
        );
      } catch (error) {
        console.error("Geocode search error", error);
        setSearchError("Unable to fetch geocoding results right now.");
      } finally {
        setSearchLoading(false);
      }
    }, 320);

    debounceTimerRef.current = nextTimer;

    return () => {
      controller.abort();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [
    inputValue,
    setSearchLoading,
    setSearchResults,
    setSearchError,
    updateSearchResult,
  ]);

  const handleResultSelect = (result: SearchResult) => {
    const { latitude, longitude } = result;
    if (currentTarget) {
      const toRadians = (value: number) => (value * Math.PI) / 180;
      const dLat = toRadians(latitude - currentTarget.latitude);
      const dLon = toRadians(longitude - currentTarget.longitude);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(currentTarget.latitude)) *
          Math.cos(toRadians(latitude)) *
          Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceKm = 6371.0088 * c;
      const y = Math.sin(dLon) * Math.cos(toRadians(latitude));
      const x =
        Math.cos(toRadians(currentTarget.latitude)) * Math.sin(toRadians(latitude)) -
        Math.sin(toRadians(currentTarget.latitude)) *
          Math.cos(toRadians(latitude)) *
          Math.cos(dLon);
      const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

      recordQueryTrail({
        from: {
          latitude: currentTarget.latitude,
          longitude: currentTarget.longitude,
        },
        to: { latitude, longitude },
        distanceKm,
        bearing,
        occurredAt: new Date().toISOString(),
      });
    }

    setTarget({
      latitude,
      longitude,
      google_maps_url: `https://maps.google.com/?q=${latitude},${longitude}`,
    });
    setPhase("targeting");
    pushRecentQuery(result);
    setActiveGeofence(result.boundingBox);
    setSearchResults([]);
  };

  const handleSaveTarget = (result: SearchResult) => {
    const entry: SavedTarget = {
      id: result.id,
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      savedAt: new Date().toISOString(),
    };
    addSavedTarget(entry);
  };

  const handleRemoveTarget = (id: string) => {
    removeSavedTarget(id);
  };

  const handleCopyShareLink = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus("copied");
    } catch (error) {
      console.warn("Unable to copy share link", error);
      setShareStatus("error");
    }
  };

  useEffect(() => {
    if (shareStatus === "idle") return;
    const timer = setTimeout(() => setShareStatus("idle"), 2400);
    return () => clearTimeout(timer);
  }, [shareStatus]);

  const handleVoiceSearch = () => {
    if (!voiceAvailable || !recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const currentTimelineEvent = timeline[timelineIndex];
  const overlayKeys = useMemo(() => Object.keys(OVERLAY_LABELS) as OverlayKey[], []);

  return (
    <motion.div
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="pointer-events-auto absolute left-6 top-28 z-30 w-full max-w-xs rounded-3xl border border-cyan-400/20 bg-[#050514]/90 p-5 text-cyan-100 shadow-[0_0_35px_rgba(0,255,255,0.2)] backdrop-blur-md md:left-10 md:max-w-sm"
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-[10px] uppercase tracking-[0.35em] text-cyan-200">
              Globe Console
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-200/60">
              Overlay controls and search
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsPlayingTimeline((playing) => !playing)}
            className={`rounded-full px-3 py-1 font-mono text-[9px] uppercase tracking-[0.3em] transition ${
              isPlayingTimeline
                ? "border border-magenta-400/50 text-magenta-200 hover:border-magenta-400"
                : "border border-cyan-400/30 text-cyan-200 hover:border-cyan-400/60"
            }`}
          >
            {isPlayingTimeline ? "Pause" : "Play"}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-cyan-400/20 bg-black/40 px-3 py-2">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-cyan-200/70">
              Globe Texture
            </p>
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-200/40">
              Toggle NASA Blue Marble rendering
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUseNasaTexture(!useNasaTexture)}
            className={`rounded-full px-3 py-1 text-[9px] font-mono uppercase tracking-[0.25em] transition ${
              useNasaTexture
                ? "border border-cyan-400/60 text-cyan-100 hover:border-magenta-400/60 hover:text-white"
                : "border border-cyan-400/20 text-cyan-200/50 hover:border-cyan-400/50 hover:text-white"
            }`}
          >
            {useNasaTexture ? "NASA" : "Gradient"}
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-cyan-400/20 bg-black/40 px-3 py-2">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-cyan-200/70">
              Share View
            </p>
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-200/40">
              Copy link with current coordinates
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="rounded-full border border-cyan-400/30 px-3 py-1 text-[9px] font-mono uppercase tracking-[0.25em] text-cyan-100 transition hover:border-magenta-400/50 hover:text-white"
          >
            {shareStatus === "copied"
              ? "Copied!"
              : shareStatus === "error"
              ? "Copy Failed"
              : "Copy Link"}
          </button>
        </div>
      </header>

      <section className="mt-5 space-y-3">
        <label className="block">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-200/70">
            Locate A Site
          </span>
          <input
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              setSearchQuery(event.target.value);
            }}
            placeholder="Search city or landmark"
            className="mt-2 w-full rounded-xl border border-cyan-400/20 bg-black/30 px-3 py-2 font-mono text-[11px] tracking-[0.2em] text-cyan-100 outline-none transition focus:border-cyan-300"
          />
        </label>
        {voiceAvailable && (
          <button
            type="button"
            onClick={handleVoiceSearch}
            className={`rounded-full border px-3 py-1 text-[9px] font-mono uppercase tracking-[0.25em] transition ${
              isListening
                ? "border-magenta-400/60 text-magenta-200 hover:border-magenta-400/80"
                : "border-cyan-400/30 text-cyan-200 hover:border-cyan-400/60"
            }`}
          >
            {isListening ? "Listening..." : "Voice Search"}
          </button>
        )}
        <AnimatePresence>
          {(searchLoading || searchError || searchResults.length > 0) && (
            <motion.div
              key="search-results"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="max-h-56 overflow-y-auto rounded-xl border border-cyan-400/15 bg-black/30 px-3 py-2"
            >
              {searchLoading && (
                <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-200/60">
                  Scanning…
                </p>
              )}
              {searchError && (
                <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-magenta-200/70">
                  {searchError}
                </p>
              )}
              {!searchLoading && !searchError && searchResults.length === 0 && (
                <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-cyan-200/40">
                  Enter at least 3 characters.
                </p>
              )}
              {searchResults.length > 0 && (
                <ul className="space-y-3">
                  {searchResults.map((result) => {
                    const isSaved = savedTargets.some((entry) => entry.id === result.id);
                    return (
                      <li key={result.id}>
                        <div className="rounded-lg border border-cyan-400/20 bg-black/30 p-3 transition hover:border-magenta-400/40">
                          <div className="flex gap-3">
                            {(result.imageryUrl || result.fallbackImagery) && (
                              <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-cyan-400/20 bg-black/60">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={result.imageryUrl ?? result.fallbackImagery}
                                  alt={`${result.name} preview`}
                                  onError={(event) => {
                                    if (result.fallbackImagery) {
                                      event.currentTarget.src = result.fallbackImagery;
                                    }
                                  }}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-2">
                              <div>
                                <p className="font-display text-[11px] uppercase tracking-[0.3em] text-cyan-100">
                                  {result.name}
                                </p>
                                <p className="mt-1 line-clamp-2 text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-200/60">
                                  {result.displayName}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[9px] font-mono uppercase tracking-[0.15em] text-cyan-200/70">
                                <span>Country: {result.country ?? "—"}</span>
                                <span>Region: {result.region ?? "—"}</span>
                                <span>Population: {formatNumber(result.population)}</span>
                                <span>
                                  Elevation: {result.elevation != null ? `${result.elevation.toFixed(0)} m` : "—"}
                                </span>
                                <span>Timezone: {result.timezone ?? "—"}</span>
                              </div>
                              {result.weather && (
                                <div className="rounded-lg border border-cyan-400/15 bg-black/40 px-2 py-1 text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-100/80">
                                  <span>
                                    {result.weather.description ?? "Weather"} · Temp {result.weather.temperature != null ? `${result.weather.temperature.toFixed(1)}°C` : "—"}
                                  </span>
                                  <span className="ml-2">
                                    Wind {result.weather.windspeed != null ? `${result.weather.windspeed.toFixed(1)} m/s` : "—"}
                                  </span>
                                  <span className="ml-2">
                                    Precip {result.weather.precipitation != null ? `${result.weather.precipitation.toFixed(1)} mm` : "—"}
                                  </span>
                                </div>
                              )}
                              {result.alerts && result.alerts.length > 0 && (
                                <div className="space-y-1 rounded-lg border border-magenta-400/30 bg-black/40 px-2 py-2 text-[9px] font-mono uppercase tracking-[0.2em] text-magenta-100">
                                  <p className="font-display text-[9px] tracking-[0.3em] text-magenta-200">
                                    Nearby Alerts
                                  </p>
                                  {result.alerts.slice(0, 2).map((alert) => (
                                    <div key={alert.id} className="space-y-1">
                                      <p>{alert.title}</p>
                                      <p className="text-magenta-200/70">
                                        {alert.severity ?? "Info"} · {formatDistance(alert.distanceKm)} · {formatUtc(alert.happenedAt)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {result.satellites && result.satellites.length > 0 && (
                                <div className="space-y-1 rounded-lg border border-cyan-400/25 bg-black/30 px-2 py-2 text-[9px] font-mono uppercase tracking-[0.2em] text-cyan-100/80">
                                  <p className="font-display text-[9px] tracking-[0.3em] text-cyan-100">
                                    Satellite Pass (≈2h)
                                  </p>
                                  {result.satellites.slice(0, 2).map((satellite) => (
                                    <p key={satellite.noradId}>
                                      {satellite.name} · {formatDistance(satellite.distanceKm)} · {formatUtc(satellite.passTime)}
                                    </p>
                                  ))}
                                </div>
                              )}
                              <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleResultSelect(result)}
                                  className="rounded-full border border-cyan-400/30 px-3 py-1 text-[9px] font-mono uppercase tracking-[0.25em] text-cyan-100 transition hover:border-magenta-400/50 hover:text-white"
                                >
                                  Fly To Target
                                </button>
                                {isSaved ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTarget(result.id)}
                                    className="rounded-full border border-magenta-400/40 px-3 py-1 text-[9px] font-mono uppercase tracking-[0.25em] text-magenta-200 transition hover:border-magenta-400/70 hover:text-white"
                                  >
                                    Remove Bookmark
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSaveTarget(result)}
                                    className="rounded-full border border-cyan-400/20 px-3 py-1 text-[9px] font-mono uppercase tracking-[0.25em] text-cyan-200 transition hover:border-cyan-400/60 hover:text-white"
                                  >
                                    Save Target
                                  </button>
                                )}
                                {result.links?.osm && (
                                  <a
                                    href={result.links.osm}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-full border border-cyan-400/20 px-3 py-1 text-[9px] font-mono uppercase tracking-[0.25em] text-cyan-200/80 transition hover:border-cyan-400/60 hover:text-white"
                                  >
                                    OSM
                                  </a>
                                )}
                                {result.links?.wikipedia && (
                                  <a
                                    href={result.links.wikipedia}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-full border border-cyan-400/20 px-3 py-1 text-[9px] font-mono uppercase tracking-[0.25em] text-cyan-200/80 transition hover:border-cyan-400/60 hover:text-white"
                                  >
                                    Wikipedia
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {(savedTargets.length > 0 || recentQueries.length > 0) && (
        <section className="mt-6 space-y-4">
          {savedTargets.length > 0 && (
            <div>
              <h3 className="font-display text-[10px] uppercase tracking-[0.35em] text-cyan-200/80">
                Saved Targets
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {savedTargets.map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() =>
                      handleResultSelect({
                        id: target.id,
                        name: target.name,
                        displayName: target.name,
                        latitude: target.latitude,
                        longitude: target.longitude,
                      } as SearchResult)
                    }
                    className="rounded-full border border-cyan-400/20 px-3 py-1 text-[9px] font-mono uppercase tracking-[0.25em] text-cyan-100 transition hover:border-magenta-400/50 hover:text-white"
                  >
                    {target.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {recentQueries.length > 0 && (
            <div>
              <h3 className="font-display text-[10px] uppercase tracking-[0.35em] text-cyan-200/80">
                Recent Recon
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {recentQueries.slice(0, 6).map((item) => (
                  <button
                    key={`recent-${item.id}`}
                    type="button"
                    onClick={() => handleResultSelect(item)}
                    className="rounded-full border border-cyan-400/15 px-3 py-1 text-[9px] font-mono uppercase tracking-[0.25em] text-cyan-200/80 transition hover:border-cyan-400/40 hover:text-white"
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="mt-6 space-y-4">
        <h3 className="font-display text-[10px] uppercase tracking-[0.35em] text-cyan-200/80">
          Overlay Routing
        </h3>
        <div className="space-y-3">
          {overlayKeys.map((key) => (
            <div
              key={key}
              className="rounded-xl border border-cyan-400/15 bg-black/25 px-3 py-3"
            >
              <div className="flex items-center justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan-200/70">
                  {OVERLAY_LABELS[key]}
                </p>
                <button
                  type="button"
                  onClick={() => setOverlayEnabled(key, !overlays[key])}
                  className={`rounded-full px-3 py-1 text-[9px] font-mono uppercase tracking-[0.2em] transition ${
                    overlays[key]
                      ? "border border-cyan-400/40 text-cyan-100 hover:border-magenta-400/40 hover:text-white"
                      : "border border-cyan-400/10 text-cyan-200/40 hover:border-cyan-400/40 hover:text-white"
                  }`}
                >
                  {overlays[key] ? "Active" : "Dormant"}
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={150}
                  value={Math.round((overlayIntensity[key] ?? 1) * 100)}
                  onChange={(event) => {
                    const value = Number.parseInt(event.target.value, 10) / 100;
                    setOverlayIntensity(key, value);
                  }}
                  className="flex-1 accent-cyan-400"
                />
                <span className="w-12 text-right font-mono text-[10px] text-cyan-200/60">
                  {Math.round((overlayIntensity[key] ?? 1) * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h3 className="font-display text-[10px] uppercase tracking-[0.35em] text-cyan-200/80">
          Timeline
        </h3>
        {timeline.length > 0 ? (
          <>
            <input
              type="range"
              min={0}
              max={Math.max(timeline.length - 1, 0)}
              value={timelineIndex}
              onChange={(event) => setTimelineIndex(Number.parseInt(event.target.value, 10))}
              className="w-full accent-magenta-500"
            />
            <div className="rounded-xl border border-cyan-400/15 bg-black/25 px-3 py-3">
              <p className="font-display text-[10px] uppercase tracking-[0.3em] text-cyan-100">
                {currentTimelineEvent?.label ?? "—"}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/60">
                {formatUtc(currentTimelineEvent?.timestamp ?? new Date().toISOString())}
              </p>
              <p className="mt-2 text-[10px] font-mono uppercase tracking-[0.2em] text-cyan-200/70">
                {currentTimelineEvent?.description ?? "No event description."}
              </p>
            </div>
          </>
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/50">
            Timeline data populates once weather samples arrive.
          </p>
        )}
      </section>
    </motion.div>
  );
}
