"use client";

import { useEffect, useRef } from "react";
import { loadGlobeData } from "@/lib/globeData";
import { useGlobeStore } from "@/stores/globeStore";
import { useAnalysisStore } from "@/stores/analysisStore";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const TIMELINE_STEP_MS = 6 * 1000;

export function GlobeDataProvider() {
  const setHeatmapPoints = useGlobeStore((state) => state.setHeatmapPoints);
  const setWeatherCells = useGlobeStore((state) => state.setWeatherCells);
  const setRouteArcs = useGlobeStore((state) => state.setRouteArcs);
  const setTimeline = useGlobeStore((state) => state.setTimeline);
  const timeline = useGlobeStore((state) => state.timeline);
  const setTimelineIndex = useGlobeStore((state) => state.setTimelineIndex);
  const isPlayingTimeline = useGlobeStore((state) => state.isPlayingTimeline);
  const setSavedTargets = useGlobeStore((state) => state.setSavedTargets);
  const setRecentQueries = useGlobeStore((state) => state.setRecentQueries);
  const savedTargets = useGlobeStore((state) => state.savedTargets);
  const recentQueries = useGlobeStore((state) => state.recentQueries);
  const setTarget = useAnalysisStore((state) => state.setTarget);
  const setPhase = useAnalysisStore((state) => state.setPhase);
  const currentTarget = useAnalysisStore((state) => state.target);

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timelineTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let ignore = false;

    async function hydrate() {
      try {
        const { heatmapPoints, weatherCells, routeArcs, timeline: events } =
          await loadGlobeData();
        if (ignore) return;
        setHeatmapPoints(heatmapPoints);
        setWeatherCells(weatherCells);
        setRouteArcs(routeArcs);
        setTimeline(events);
        setTimelineIndex(0);
      } catch (error) {
        console.error("Failed to load globe data", error);
      }
    }

    hydrate();
    refreshTimerRef.current = setInterval(hydrate, REFRESH_INTERVAL_MS);

    return () => {
      ignore = true;
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [setHeatmapPoints, setWeatherCells, setRouteArcs, setTimeline, setTimelineIndex]);

  useEffect(() => {
    if (timelineTimerRef.current) {
      clearInterval(timelineTimerRef.current);
      timelineTimerRef.current = null;
    }
    if (!isPlayingTimeline || !timeline.length) {
      return;
    }

    timelineTimerRef.current = setInterval(() => {
      setTimelineIndex((currentIndex) => {
        const nextIndex = currentIndex + 1;
        if (nextIndex >= timeline.length) {
          return 0;
        }
        return nextIndex;
      });
    }, TIMELINE_STEP_MS);

    return () => {
      if (timelineTimerRef.current) {
        clearInterval(timelineTimerRef.current);
      }
    };
  }, [isPlayingTimeline, timeline, setTimelineIndex]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedTargets = window.localStorage.getItem("geointel:saved-targets");
      if (storedTargets) {
        const parsed = JSON.parse(storedTargets) as typeof savedTargets;
        if (Array.isArray(parsed)) {
          setSavedTargets(parsed);
        }
      }
      const storedQueries = window.localStorage.getItem("geointel:recent-queries");
      if (storedQueries) {
        const parsedQueries = JSON.parse(storedQueries) as typeof recentQueries;
        if (Array.isArray(parsedQueries)) {
          setRecentQueries(parsedQueries);
        }
      }
    } catch (error) {
      console.warn("Failed to hydrate stored globe state", error);
    }
  }, [setSavedTargets, setRecentQueries]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("geointel:saved-targets", JSON.stringify(savedTargets));
    } catch (error) {
      console.warn("Failed to persist saved targets", error);
    }
  }, [savedTargets]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("geointel:recent-queries", JSON.stringify(recentQueries));
    } catch (error) {
      console.warn("Failed to persist recent queries", error);
    }
  }, [recentQueries]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const targetParam = params.get("target");
    if (targetParam) {
      const [latStr, lonStr] = targetParam.split(",");
      const latitude = Number.parseFloat(latStr);
      const longitude = Number.parseFloat(lonStr);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        setTarget({
          latitude,
          longitude,
          google_maps_url: `https://maps.google.com/?q=${latitude},${longitude}`,
        });
        setPhase("targeting");
      }
    }
  }, [setTarget, setPhase]);

  useEffect(() => {
    if (typeof window === "undefined" || !currentTarget) return;
    const url = new URL(window.location.href);
    url.searchParams.set(
      "target",
      `${currentTarget.latitude.toFixed(4)},${currentTarget.longitude.toFixed(4)}`,
    );
    window.history.replaceState({}, "", url.toString());
  }, [currentTarget]);

  return null;
}

