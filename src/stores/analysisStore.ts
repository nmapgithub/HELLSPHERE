"use client";

import { create } from "zustand";

type AnalysisPhase =
  | "idle"
  | "uploading"
  | "analyzing"
  | "targeting"
  | "acquired";

export interface TargetCoordinates {
  latitude: number;
  longitude: number;
}

interface AnalysisState {
  phase: AnalysisPhase;
  target?: TargetCoordinates;
  uploadProgress: number;
  setPhase: (phase: AnalysisPhase) => void;
  setTarget: (coords: TargetCoordinates | undefined) => void;
  setUploadProgress: (progress: number) => void;
  reset: () => void;
}

const initialState: Pick<AnalysisState, "phase" | "target" | "uploadProgress"> =
  {
    phase: "idle",
    target: undefined,
    uploadProgress: 0,
  };

export const useAnalysisStore = create<AnalysisState>((set) => ({
  ...initialState,
  setPhase: (phase) =>
    set({
      phase,
      // Reset progress when leaving upload phase to keep animations tidy.
      uploadProgress: phase === "uploading" ? 0 : 100,
    }),
  setTarget: (target) => set({ target }),
  setUploadProgress: (uploadProgress) => set({ uploadProgress }),
  reset: () => set(initialState),
}));

export const isActivePhase = (phase: AnalysisPhase) =>
  phase !== "idle" && phase !== "acquired";

