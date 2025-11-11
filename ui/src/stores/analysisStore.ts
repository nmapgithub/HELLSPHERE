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
  google_maps_url?: string;
}

export interface BackendImageMeta {
  filename?: string;
  path?: string;
  url?: string;
}

export interface LocationGuess {
  country?: string;
  state?: string;
  city?: string;
  confidence?: string;
  explanation?: string;
  coordinates?: Partial<TargetCoordinates> | null;
}

export interface SerpApiResults {
  context?: string | null;
  has_results?: boolean;
}

export interface GeminiAnalysis {
  interpretation?: string;
  locations?: LocationGuess[];
  serpapi_results?: SerpApiResults;
  exif_data?: {
    gps_coordinates?: TargetCoordinates;
    [key: string]: unknown;
  } & Record<string, unknown>;
  [key: string]: unknown;
}

export interface AnalysisResponse {
  image?: BackendImageMeta;
  analysis?: GeminiAnalysis;
  [key: string]: unknown;
}

interface AnalysisState {
  phase: AnalysisPhase;
  target?: TargetCoordinates;
  uploadProgress: number;
  useSerpApi: boolean;
  settingsOpen: boolean;
  errorMessage?: string;
  analysis?: AnalysisResponse;
  setPhase: (phase: AnalysisPhase) => void;
  setTarget: (coords: TargetCoordinates | undefined) => void;
  setUploadProgress: (progress: number) => void;
  setUseSerpApi: (enabled: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setError: (message: string | undefined) => void;
  setAnalysis: (payload: AnalysisResponse | undefined) => void;
  reset: () => void;
}

const baseInitialState: Pick<
  AnalysisState,
  "phase" | "target" | "uploadProgress" | "errorMessage" | "analysis"
> = {
  phase: "idle",
  target: undefined,
  uploadProgress: 0,
  errorMessage: undefined,
  analysis: undefined,
};

export const useAnalysisStore = create<AnalysisState>((set) => ({
  ...baseInitialState,
  useSerpApi: true,
  settingsOpen: false,
  setPhase: (phase) =>
    set({
      phase,
      uploadProgress: phase === "uploading" ? 0 : 100,
    }),
  setTarget: (target) => set({ target }),
  setUploadProgress: (uploadProgress) => set({ uploadProgress }),
  setUseSerpApi: (useSerpApi) => set({ useSerpApi }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setError: (errorMessage) => set({ errorMessage }),
  setAnalysis: (analysis) => set({ analysis }),
  reset: () =>
    set({
      ...baseInitialState,
      useSerpApi: true,
      settingsOpen: false,
    }),
}));

export const isActivePhase = (phase: AnalysisPhase) =>
  phase !== "idle" && phase !== "acquired";
