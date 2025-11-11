"use client";

import { Html } from "@react-three/drei";
import { useMemo } from "react";

const EARTH_RADIUS = 1.6;

interface City {
  name: string;
  latitude: number;
  longitude: number;
}

const cities: City[] = [
  { name: "Neo Tokyo", latitude: 35.6762, longitude: 139.6503 },
  { name: "Night City", latitude: 32.7157, longitude: -117.1611 },
  { name: "New Shanghai", latitude: 31.2304, longitude: 121.4737 },
  { name: "Aurora Base", latitude: 64.2008, longitude: -149.4937 },
];

function latLonToCartesian(latitude: number, longitude: number, radius: number) {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;

  const x = radius * Math.cos(lat) * Math.cos(lon);
  const y = radius * Math.sin(lat);
  const z = radius * Math.cos(lat) * Math.sin(lon);

  return { x, y, z };
}

export function CityLabels() {
  const labelData = useMemo(
    () =>
      cities.map((city) => ({
        ...city,
        position: latLonToCartesian(city.latitude, city.longitude, EARTH_RADIUS * 1.01),
      })),
    [],
  );

  return (
    <>
      {labelData.map((city) => (
        <group key={city.name} position={[city.position.x, city.position.y, city.position.z]}>
          <Html
            center
            distanceFactor={8}
            className="pointer-events-none select-none font-display text-[10px] uppercase tracking-[0.3em] text-cyan-200 drop-shadow-[0_0_12px_rgba(0,255,255,0.65)]"
          >
            {city.name}
          </Html>
        </group>
      ))}
    </>
  );
}

