"use client";

import { useCallback, useRef } from "react";
import anime from "animejs";
import { useAnalysisStore } from "@/stores/analysisStore";

const FALLBACK_COORDINATES = { latitude: 35.6895, longitude: 139.6917 }; // Tokyo

const uploadEndpoint =
  process.env.NEXT_PUBLIC_ANALYZE_ENDPOINT ?? "http://localhost:8000/api/analyze";

export function UploadButton() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { setPhase, setTarget, setUploadProgress } = useAnalysisStore(
    (state) => ({
      setPhase: state.setPhase,
      setTarget: state.setTarget,
      setUploadProgress: state.setUploadProgress,
    }),
  );

  const animatePulse = useCallback(() => {
    anime({
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
        easing: "easeInOutQuad",
        update: (anim) =>
          setUploadProgress(Math.round((anim.animations[0].currentValue as number) ?? 0)),
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

      setPhase("uploading");
      setTarget(undefined);
      setUploadProgress(0);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch(uploadEndpoint, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed with status ${response.status}`);
        }

        const payload = (await response.json()) as Partial<{
          latitude: number;
          longitude: number;
        }>;

        if (
          typeof payload.latitude === "number" &&
          typeof payload.longitude === "number"
        ) {
          simulateAnalysisSequence({
            latitude: payload.latitude,
            longitude: payload.longitude,
          });
        } else {
          simulateAnalysisSequence(FALLBACK_COORDINATES);
        }
      } catch (error) {
        console.error("Image upload failed. Falling back to mock data.", error);
        simulateAnalysisSequence(FALLBACK_COORDINATES);
      }
    },
    [setPhase, setTarget, setUploadProgress, simulateAnalysisSequence],
  );

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="upload-button relative overflow-hidden rounded-full border border-cyan-400/70 bg-black/60 px-6 py-3 font-display text-sm uppercase tracking-[0.35em] text-cyan-200 shadow-[0_0_15px_rgba(0,255,255,0.35)] transition hover:border-magenta-400/80 hover:text-white hover:shadow-[0_0_35px_rgba(160,32,240,0.55)]"
      >
        Upload Image
        <span className="pointer-events-none absolute inset-0 opacity-0 mix-blend-screen [background:radial-gradient(circle_at_center,rgba(0,255,255,0.4),transparent_60%)] group-hover:opacity-80" />
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

