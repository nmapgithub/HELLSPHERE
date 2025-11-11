"use client";

import { create } from "zustand";

export type OverlayKey = "heatmap" | "routes" | "weather";

export interface HeatmapPoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  intensity: number;
  multipliers?: number[];
}

export interface RouteArc {
  id: string;
  from: {
    name: string;
    latitude: number;
    longitude: number;
  };
  to: {
    name: string;
    latitude: number;
    longitude: number;
  };
  magnitude: number;
  multipliers?: number[];
}

export interface WeatherCell {
  id: string;
  latitude: number;
  longitude: number;
  status: "clear" | "storm" | "cloudy" | "rain" | "wind";
  severity: number;
  multipliers?: number[];
}

export interface TimelineEvent {
  id: string;
  label: string;
  description: string;
  timestamp: string;
  overlayMultipliers: Partial<Record<OverlayKey, number>>;
}

export interface ResultLinks {
  osm: string;
  google: string;
  wikipedia?: string;
  wikivoyage?: string;
}

export interface WeatherSnapshot {
  temperature: number | null;
  windspeed: number | null;
  precipitation: number | null;
  description: string | null;
  symbol?: string | null;
}

export interface AlertInfo {
  id: string;
  title: string;
  source: string;
  severity?: string;
  magnitude?: number;
  distanceKm: number;
  happenedAt: string;
}

export interface SatellitePass {
  name: string;
  noradId: number;
  distanceKm: number;
  passTime: string;
  altitudeKm?: number;
}

export interface SearchResult {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  displayName: string;
  country?: string;
  region?: string;
  timezone?: string;
  population?: number;
  elevation?: number;
  boundingBox?: [number, number, number, number];
  imageryUrl?: string;
  fallbackImagery?: string;
  weather?: WeatherSnapshot;
  alerts?: AlertInfo[];
  satellites?: SatellitePass[];
  links?: ResultLinks;
}

export interface SavedTarget {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  savedAt: string;
  tags?: string[];
  notes?: string;
}

export interface QueryTrail {
  from: {
    latitude: number;
    longitude: number;
  };
  to: {
    latitude: number;
    longitude: number;
  };
  distanceKm: number;
  bearing: number;
  occurredAt: string;
}

interface GlobeState {
  overlays: Record<OverlayKey, boolean>;
  overlayIntensity: Record<OverlayKey, number>;
  heatmapPoints: HeatmapPoint[];
  routeArcs: RouteArc[];
  weatherCells: WeatherCell[];
  timeline: TimelineEvent[];
  timelineIndex: number;
  isPlayingTimeline: boolean;
  searchQuery: string;
  searchResults: SearchResult[];
  searchLoading: boolean;
  searchError?: string;
  savedTargets: SavedTarget[];
  recentQueries: SearchResult[];
  queryTrails: QueryTrail[];
  useNasaTexture: boolean;
  setUseNasaTexture: (enabled: boolean) => void;
  setSavedTargets: (targets: SavedTarget[]) => void;
  setRecentQueries: (results: SearchResult[]) => void;
  activeGeofence?: [number, number, number, number];
  setActiveGeofence: (box: [number, number, number, number] | undefined) => void;
  setOverlayEnabled: (key: OverlayKey, enabled: boolean) => void;
  setOverlayIntensity: (key: OverlayKey, value: number) => void;
  setTimelineIndex: (index: number | ((current: number) => number)) => void;
  setIsPlayingTimeline: (playing: boolean | ((current: boolean) => boolean)) => void;
  setHeatmapPoints: (points: HeatmapPoint[]) => void;
  setRouteArcs: (routes: RouteArc[]) => void;
  setWeatherCells: (cells: WeatherCell[]) => void;
  setTimeline: (events: TimelineEvent[]) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: SearchResult[]) => void;
  updateSearchResult: (id: string, patch: Partial<SearchResult>) => void;
  setSearchLoading: (loading: boolean) => void;
  setSearchError: (error: string | undefined) => void;
  addSavedTarget: (target: SavedTarget) => void;
  removeSavedTarget: (id: string) => void;
  recordQueryTrail: (trail: QueryTrail) => void;
  pushRecentQuery: (result: SearchResult) => void;
}

const defaultOverlays: Record<OverlayKey, boolean> = {
  heatmap: true,
  routes: true,
  weather: false,
};

const defaultOverlayIntensity: Record<OverlayKey, number> = {
  heatmap: 1,
  routes: 1,
  weather: 1,
};

export const useGlobeStore = create<GlobeState>((set) => ({
  overlays: defaultOverlays,
  overlayIntensity: defaultOverlayIntensity,
  heatmapPoints: [],
  routeArcs: [],
  weatherCells: [],
  timeline: [],
  timelineIndex: 0,
  isPlayingTimeline: false,
  searchQuery: "",
  searchResults: [],
  searchLoading: false,
  searchError: undefined,
  savedTargets: [],
  recentQueries: [],
  queryTrails: [],
  useNasaTexture: false,
  setUseNasaTexture: (enabled) => set({ useNasaTexture: enabled }),
  setSavedTargets: (targets) => set({ savedTargets: targets }),
  setRecentQueries: (results) => set({ recentQueries: results }),
  activeGeofence: undefined,
  setActiveGeofence: (box) => set({ activeGeofence: box }),
  setOverlayEnabled: (key, enabled) =>
    set((state) => ({
      overlays: {
        ...state.overlays,
        [key]: enabled,
      },
    })),
  setOverlayIntensity: (key, value) =>
    set((state) => ({
      overlayIntensity: {
        ...state.overlayIntensity,
        [key]: value,
      },
    })),
  setTimelineIndex: (indexOrUpdater) =>
    set((state) => {
      const nextIndex =
        typeof indexOrUpdater === "function"
          ? indexOrUpdater(state.timelineIndex)
          : indexOrUpdater;
      const clamped = Math.max(
        0,
        Math.min(nextIndex, Math.max(state.timeline.length - 1, 0)),
      );
      return { timelineIndex: clamped };
    }),
  setIsPlayingTimeline: (playingOrUpdater) =>
    set((state) => ({
      isPlayingTimeline:
        typeof playingOrUpdater === "function"
          ? playingOrUpdater(state.isPlayingTimeline)
          : playingOrUpdater,
    })),
  setHeatmapPoints: (heatmapPoints) => set({ heatmapPoints }),
  setRouteArcs: (routeArcs) => set({ routeArcs }),
  setWeatherCells: (weatherCells) => set({ weatherCells }),
  setTimeline: (timeline) =>
    set((state) => ({
      timeline,
      timelineIndex: Math.min(state.timelineIndex, Math.max(timeline.length - 1, 0)),
    })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchResults: (searchResults) => set({ searchResults }),
  updateSearchResult: (id, patch) =>
    set((state) => ({
      searchResults: state.searchResults.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    })),
  setSearchLoading: (searchLoading) => set({ searchLoading }),
  setSearchError: (searchError) => set({ searchError }),
  addSavedTarget: (target) =>
    set((state) => {
      const exists = state.savedTargets.some((entry) => entry.id === target.id);
      return {
        savedTargets: exists
          ? state.savedTargets.map((entry) =>
              entry.id === target.id ? { ...entry, ...target } : entry,
            )
          : [...state.savedTargets, target],
      };
    }),
  removeSavedTarget: (id) =>
    set((state) => ({
      savedTargets: state.savedTargets.filter((entry) => entry.id !== id),
    })),
  recordQueryTrail: (trail) =>
    set((state) => ({
      queryTrails: [...state.queryTrails.slice(-19), trail],
    })),
  pushRecentQuery: (result) =>
    set((state) => {
      const filtered = state.recentQueries.filter((item) => item.id !== result.id);
      return { recentQueries: [result, ...filtered].slice(0, 15) };
    }),
}));

