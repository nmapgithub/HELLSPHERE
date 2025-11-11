"use client";

import { Html } from "@react-three/drei";
import { useMemo } from "react";
import { Vector3 } from "three";
import { useAnalysisStore } from "@/stores/analysisStore";
import { CITY_DATABASE } from "@/data/cityDatabase";

const EARTH_RADIUS = 1.6;

interface City {
  name: string;
  latitude: number;
  longitude: number;
  emphasis?: boolean;
}

const fallbackCities: City[] = [
  { name: "Neo Tokyo", latitude: 35.6762, longitude: 139.6503 },
  { name: "Night City", latitude: 32.7157, longitude: -117.1611 },
  { name: "New Shanghai", latitude: 31.2304, longitude: 121.4737 },
  { name: "Aurora Base", latitude: 64.2008, longitude: -149.4937 },
];

const BLOCKLIST = new Set([
  "source",
  "url",
  "result",
  "google",
  "wikipedia",
  "youtube",
  "national",
  "education",
  "society",
  "general",
  "urban",
  "area",
  "hotel",
  "hotels",
  "road",
  "mall",
  "tours",
  "facebook",
  "tripadvisor",
  "agoda",
]);

function latLonToCartesian(latitude: number, longitude: number, radius: number) {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;

  const x = radius * Math.cos(lat) * Math.cos(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.sin(lon);

  return new Vector3(x, y, z);
}

function extractNamesFromSerp(context: string | null | undefined) {
  if (!context) return [] as string[];
  const matches = context.match(/\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\b/g);
  if (!matches) return [];
  return matches
    .map((name) => name.trim())
    .filter((name) => name.length > 2)
    .filter((name) => !BLOCKLIST.has(name.toLowerCase()))
    .filter((name) => /^[A-Za-z\s]+$/.test(name));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function greatCircleDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function CityLabels() {
  const locations = useAnalysisStore((state) => state.analysis?.analysis?.locations);
  const serpContext = useAnalysisStore((state) => state.analysis?.analysis?.serpapi_results?.context);
  const target = useAnalysisStore((state) => state.target);

  const dynamicCities = useMemo(() => {
    const labels: City[] = [];
    const seen = new Set<string>();

    if (locations && locations.length) {
      locations.forEach((location, index) => {
        const name =
          location.city?.trim() ||
          location.state?.trim() ||
          location.country?.trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;

        let latitude = location.coordinates?.latitude;
        let longitude = location.coordinates?.longitude;

        if (typeof latitude !== "number" || typeof longitude !== "number") {
          if (!target) return;
          const offsetScale = 0.4 + index * 0.22;
          latitude = target.latitude + Math.sin(index * 1.3) * offsetScale;
          longitude = target.longitude + Math.cos(index * 1.6) * offsetScale;
        }

        labels.push({
          name,
          latitude,
          longitude,
          emphasis: index === 0,
        });
        seen.add(key);
      });
    }

    if (labels.length < 4 && target) {
      const serpNames = extractNamesFromSerp(serpContext);
      serpNames.forEach((name, index) => {
        if (labels.length >= 6) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;

        const angle = index * (Math.PI / 2.2);
        const offset = 0.35 + index * 0.18;
        const latitude = target.latitude + Math.sin(angle) * offset;
        const longitude = target.longitude + Math.cos(angle) * offset;

        labels.push({ name, latitude, longitude, emphasis: false });
        seen.add(key);
      });
    }

    if (target) {
      const remaining = Math.max(0, 6 - labels.length);
      if (remaining > 0) {
        const nearest = CITY_DATABASE.map((city) => ({
          ...city,
          distance: greatCircleDistance(
            target.latitude,
            target.longitude,
            city.latitude,
            city.longitude,
          ),
        }))
          .filter((city) => city.distance <= 1200)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, remaining * 2);

        nearest.forEach((city) => {
          const key = city.name.toLowerCase();
          if (seen.has(key)) return;

          labels.push({
            name: city.country ? `${city.name}` : city.name,
            latitude: city.latitude,
            longitude: city.longitude,
            emphasis: labels.length === 0,
          });
          seen.add(key);
        });
      }
    }

    return labels;
  }, [locations, serpContext, target]);

  const labelData = useMemo(() => {
    const source = dynamicCities.length ? dynamicCities : fallbackCities;

    const targetVec = target
      ? latLonToCartesian(target.latitude, target.longitude, EARTH_RADIUS)
      : null;

    return source.map((city, index) => {
      const baseRadius = EARTH_RADIUS * (city.emphasis ? 1.08 : 1.02);
      const basePosition = latLonToCartesian(city.latitude, city.longitude, baseRadius);
      let position = basePosition.clone();

      if (dynamicCities.length && targetVec) {
        let normal = basePosition.clone().normalize();
        if (normal.lengthSq() < 1e-6) {
          normal = targetVec.clone().normalize();
        }
        let tangent = new Vector3(0, 1, 0).cross(normal);
        if (tangent.lengthSq() < 1e-6) {
          tangent = new Vector3(1, 0, 0).cross(normal);
        }
        tangent.normalize();
        const bitangent = normal.clone().cross(tangent).normalize();

        const ring = Math.floor(index / 4);
        const angle = ((index % 4) / 4) * Math.PI * 2;
        const spread = 0.18 + ring * 0.12;

        position = position
          .add(tangent.clone().multiplyScalar(Math.cos(angle) * spread))
          .add(bitangent.clone().multiplyScalar(Math.sin(angle) * spread));
      }

      return {
        ...city,
        position,
      };
    });
  }, [dynamicCities, target]);

  return (
    <>
      {labelData.map((city) => (
        <group
          key={`${city.name}-${city.latitude.toFixed(2)}-${city.longitude.toFixed(2)}`}
          position={city.position.toArray() as [number, number, number]}
        >
          <Html
            center
            distanceFactor={city.emphasis ? 5.5 : 8}
            className={`pointer-events-none select-none font-display text-[10px] uppercase tracking-[0.3em] drop-shadow-[0_0_12px_rgba(0,255,255,0.65)] ${
              city.emphasis ? "text-cyan-100" : "text-cyan-400/80"
            }`}
          >
            {city.name}
          </Html>
        </group>
      ))}
    </>
  );
}
