"use client";

import { useCallback, useEffect, useRef } from "react";
import anime from "animejs/lib/anime.es.js";
import { useAnalysisStore, type AnalysisResponse, type TargetCoordinates } from "@/stores/analysisStore";

const FALLBACK_COORDINATES: TargetCoordinates = {
  latitude: 35.6895,
  longitude: 139.6917,
  google_maps_url: "https://www.google.com/maps?q=35.6895,139.6917",
};

const uploadEndpoint =
  process.env.NEXT_PUBLIC_ANALYZE_ENDPOINT ?? "/api/analyze";

const extractCoordinates = (payload: AnalysisResponse | null | undefined) => {
  if (!payload) return undefined;
  const analysis = payload.analysis;
  if (analysis?.locations?.length) {
    for (const location of analysis.locations) {
      const coords = location?.coordinates;
      if (coords && typeof coords.latitude === "number" && typeof coords.longitude === "number") {
        return {
          latitude: coords.latitude,
          longitude: coords.longitude,
          google_maps_url: coords.google_maps_url,
        } satisfies TargetCoordinates;
      }
    }
  }

  const exifCoords = analysis?.exif_data?.gps_coordinates;
  if (exifCoords && typeof exifCoords.latitude === "number" && typeof exifCoords.longitude === "number") {
    return exifCoords satisfies TargetCoordinates;
  }

  return undefined;
};

type AnimeHandle = ReturnType<typeof anime>;

export function UploadButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pulseRef = useRef<AnimeHandle | null>(null);
  const setPhase = useAnalysisStore((state) => state.setPhase);
  const setTarget = useAnalysisStore((state) => state.setTarget);
  const setUploadProgress = useAnalysisStore((state) => state.setUploadProgress);
  const useSerpApi = useAnalysisStore((state) => state.useSerpApi);
  const setSettingsOpen = useAnalysisStore((state) => state.setSettingsOpen);
  const setError = useAnalysisStore((state) => state.setError);
  const setAnalysis = useAnalysisStore((state) => state.setAnalysis);

  useEffect(() => () => pulseRef.current?.pause(), []);

  const animatePulse = useCallback(() => {
    pulseRef.current?.pause();
    pulseRef.current = anime({
      targets: ".upload-button",
      scale: [
        { value: 1, duration: 0 },
        { value: 1.08, duration: 900 },
        { value: 1, duration: 900 },
      ],
      easing: "easeInOutSine",
      loop: true,
    });
  }, []);

  const handleClick = () => {
    if (!inputRef.current) return;
    animatePulse();
    inputRef.current.click();
  };

  const simulateAnalysisSequence = useCallback(
    (coords: { latitude: number; longitude: number }) => {
      setPhase("analyzing");

      anime({
        targets: { progress: 0 },
        progress: 100,
        duration: 2200,
        easing: "easeInOutSine",
        update: (anim: AnimeHandle) => {
          const animation = anim.animations[0];
          if (!animation) return;
          setUploadProgress(Math.round((animation.currentValue as number) ?? 0));
        },
      });

      setTimeout(() => {
        setTarget(coords);
        setPhase("targeting");
        setTimeout(() => {
          setPhase("acquired");
        }, 2600);
      }, 2000);
    },
    [setPhase, setTarget, setUploadProgress],
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      pulseRef.current?.pause();

      setPhase("uploading");
      setTarget(undefined);
      setUploadProgress(0);
      setError(undefined);
      setAnalysis(undefined);

      const formData = new FormData();
      formData.append("image", file);
      formData.append("use_serpapi", String(useSerpApi));

      try {
        const response = await fetch(uploadEndpoint, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          if (response.status === 422) {
            setPhase("idle");
            setError(
              "Backend rejected the request. Please confirm your Gemini API key is configured in Settings.",
            );
            setSettingsOpen(true);
            return;
          }
          throw new Error(`Upload failed with status ${response.status}`);
        }

        const payload = (await response
          .json()
          .catch(() => null)) as AnalysisResponse | null;

        if (payload) {
          setAnalysis(payload);
          const analysis = payload.analysis as Record<string, unknown> | undefined;
          if (analysis && "error" in analysis) {
            setError(String(analysis.error));
          }
        }

        const coordinates = extractCoordinates(payload) ?? FALLBACK_COORDINATES;
        simulateAnalysisSequence(coordinates);
      } catch (error) {
        console.error("Image upload failed. Falling back to mock data.", error);
        setError("Upload failed. Showing mock tracking sequence.");
        setAnalysis(undefined);
        simulateAnalysisSequence(FALLBACK_COORDINATES);
      }
    },
    [
      setPhase,
      setTarget,
      setUploadProgress,
      simulateAnalysisSequence,
      useSerpApi,
      setError,
      setSettingsOpen,
      setAnalysis,
    ],
  );

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="upload-button group relative overflow-hidden rounded-full border border-cyan-400/70 bg-black/60 px-6 py-3 font-display text-sm uppercase tracking-[0.35em] text-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.35)] transition hover:border-magenta-400/80 hover:text-white hover:shadow-[0_0_35px_rgba(160,32,240,0.55)]"
      >
        Upload Image
        <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 mix-blend-screen [background:radial-gradient(circle_at_center,rgba(0,255,255,0.4),transparent_60%)] group-hover:opacity-80" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </>
  );
}
