"use client";

import { useEffect, useRef } from "react";
import { Group, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { Trail, Line } from "@react-three/drei";
import type { Line2, LineGeometry } from "three-stdlib";
import { useFrame, type RootState } from "@react-three/fiber";
import anime from "animejs/lib/anime.es.js";
import { useAnalysisStore } from "@/stores/analysisStore";

interface SatelliteProps {
  orbitRadius: number;
  baseSpeed: number;
  color: string;
  initialAngle?: number;
  altitude?: number;
}

const ANALYSIS_SPEED_MULTIPLIER = 1.8;
const TARGETING_SPEED_MULTIPLIER = 2.4;

export function Satellite({
  orbitRadius,
  baseSpeed,
  color,
  initialAngle = 0,
  altitude = 0,
}: SatelliteProps) {
  const groupRef = useRef<Group | null>(null);
  const lineRef = useRef<Line2 | null>(null);
  const phase = useAnalysisStore((state) => state.phase);
  const target = useAnalysisStore((state) => state.target);

  useEffect(() => {
    const targets =
      groupRef.current?.children
        .filter((child) => child.type === "Mesh")
        .map((child) => (child as Mesh).material as MeshStandardMaterial)
        .filter(Boolean) ?? [];

    if (!targets.length) return;

    const pulse = anime({
      targets,
      emissiveIntensity: [
        { value: 1.6, duration: 900 },
        { value: 0.6, duration: 900 },
      ],
      easing: "easeInOutSine",
      direction: "alternate",
      loop: true,
    });
    return () => pulse.pause();
  }, []);

  useFrame((state: RootState) => {
    if (!groupRef.current) return;
    const elapsed = state.clock.getElapsedTime();
    const speedBoost =
      phase === "targeting"
        ? TARGETING_SPEED_MULTIPLIER
        : phase === "analyzing"
          ? ANALYSIS_SPEED_MULTIPLIER
          : 1;
    const angle = initialAngle + elapsed * baseSpeed * speedBoost;
    const y = Math.sin(angle * 1.4) * 0.3 + altitude;
    const x = Math.cos(angle) * orbitRadius;
    const z = Math.sin(angle) * orbitRadius;

    groupRef.current.position.set(x, y, z);
    groupRef.current.rotation.y = angle + Math.PI / 2;

    if (target && lineRef.current) {
      const latRad = (target.latitude * Math.PI) / 180;
      const lonRad = (target.longitude * Math.PI) / 180;
      const radius = 1.6 * 1.01;
      const targetVec = new Vector3(
        radius * Math.cos(latRad) * Math.cos(lonRad),
        radius * Math.sin(latRad),
        radius * Math.cos(latRad) * Math.sin(lonRad),
      );
      const satPos = new Vector3(x, y, z);
      const geo = lineRef.current.geometry as LineGeometry | undefined;
      if (geo && typeof geo.setPositions === "function") {
        geo.setPositions([
          satPos.x,
          satPos.y,
          satPos.z,
          targetVec.x,
          targetVec.y,
          targetVec.z,
        ]);
      }
    }
  });

  return (
    <group ref={groupRef}>
      <Trail
        width={0.26}
        length={10}
        color={color}
        attenuation={(t) => (1 - t) * 0.6 + 0.2}
      >
        <mesh>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.9}
            toneMapped={false}
          />
        </mesh>
      </Trail>
      <mesh position={[0.24, 0, 0]}>
        <boxGeometry args={[0.18, 0.08, 0.08]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
      {target && (
        <Line
          ref={lineRef}
          points={[new Vector3(), new Vector3()]}
          color={color}
          opacity={0.25}
          transparent
          lineWidth={1}
        />
      )}
    </group>
  );
}
