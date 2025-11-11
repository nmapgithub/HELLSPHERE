"use client";

import { useEffect, useRef } from "react";
import { Group, Mesh, MeshStandardMaterial } from "three";
import { Trail } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import anime from "animejs";
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
  const { phase } = useAnalysisStore((state) => ({ phase: state.phase }));

  useEffect(() => {
    const targets =
      groupRef.current?.children
        .filter((child) => child.type === "Mesh")
        .map((child) => (child as Mesh).material as MeshStandardMaterial)
        .filter(Boolean) ?? [];

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

  useFrame((state) => {
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
  });

  return (
    <group ref={groupRef}>
      <Trail
        width={0.26}
        length={10}
        color={color}
        attenuation={(t) => ((1 - t) * 0.6 + 0.2) as number}
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
    </group>
  );
}

