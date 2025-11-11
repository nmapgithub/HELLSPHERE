"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import anime from "animejs/lib/anime.es.js";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import {
  AccumulativeShadows,
  GradientTexture,
  OrbitControls,
  PerspectiveCamera,
  Stars,
  Html,
  Line,
  useTexture,
} from "@react-three/drei";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  GridHelper,
  Mesh,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Satellite } from "./Satellite";
import { CityLabels } from "./CityLabels";
import { useAnalysisStore } from "@/stores/analysisStore";
import { useGlobeStore } from "@/stores/globeStore";
import { latLonToVector3 } from "@/lib/globeMath";
import { GlobeDataProvider } from "./GlobeDataProvider";

const EARTH_RADIUS = 1.6;
const CAMERA_BASE_DISTANCE = 6.5;
type AnimeHandle = ReturnType<typeof anime>;

function Earth() {
  const meshRef = useRef<Mesh>(null);
  const phase = useAnalysisStore((state) => state.phase);
  const useNasaTexture = useGlobeStore((state) => state.useNasaTexture);
  const nasaTexture = useTexture("/textures/nasa-blue-marble.png");

  useFrame((_: RootState, delta: number) => {
    const baseSpeed = 0.12;
    const speedMultiplier =
      phase === "targeting" || phase === "analyzing" ? 1.6 : 1;
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * baseSpeed * speedMultiplier;
    }
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        {useNasaTexture ? (
          <meshStandardMaterial
            map={nasaTexture}
            roughness={0.7}
            metalness={0.05}
          />
        ) : (
          <meshStandardMaterial roughness={0.65} metalness={0.1}>
            <GradientTexture
              stops={[0, 0.4, 1]}
              colors={["#02021a", "#071241", "#1f296d"]}
              size={2048}
            />
          </meshStandardMaterial>
        )}
      </mesh>
      <mesh scale={1.04}>
        <sphereGeometry args={[EARTH_RADIUS, 32, 32]} />
        <shaderMaterial
          transparent
          blending={AdditiveBlending}
          uniforms={{
            glowColor: { value: new Color("#0affff") },
            intensity: { value: 0.6 },
          }}
          fragmentShader={`
            uniform vec3 glowColor;
            uniform float intensity;
            varying vec3 vNormal;
            void main() {
              float glow = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
              gl_FragColor = vec4(glowColor, glow * intensity);
            }
          `}
          vertexShader={`
            varying vec3 vNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
        />
      </mesh>
    </group>
  );
}

function Atmosphere() {
  const materialRef = useRef<ShaderMaterial>(null);

  useFrame(() => {
    if (!materialRef.current) return;
    const time = performance.now() * 0.001;
    materialRef.current.uniforms.opacity.value =
      0.2 + Math.sin(time * 0.6) * 0.05;
  });

  return (
    <mesh scale={1.25}>
      <sphereGeometry args={[EARTH_RADIUS, 48, 48]} />
      <shaderMaterial
        ref={materialRef}
        transparent
        uniforms={{
          opacity: { value: 0.22 },
          glowColor: { value: new Color("#00ffff") },
        }}
        blending={AdditiveBlending}
        vertexShader={`
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float opacity;
          uniform vec3 glowColor;
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
            gl_FragColor = vec4(glowColor, opacity * intensity);
          }
        `}
      />
    </mesh>
  );
}

function CameraRig() {
  const { camera } = useThree();
  const phase = useAnalysisStore((state) => state.phase);
  const target = useAnalysisStore((state) => state.target);
  const animationRef = useRef<AnimeHandle | null>(null);
  const lookAtRef = useRef(new Vector3(0, 0, 0));

  useEffect(() => {
    if (!target) return;

    const destination = latLonToVector3(
      target.latitude,
      target.longitude,
      EARTH_RADIUS * 1.8,
    );

    animationRef.current?.pause();

    animationRef.current = anime({
      targets: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z,
      },
      x: destination.x,
      y: destination.y,
      z: destination.z,
      duration: 2600,
      easing: "easeInOutCubic",
      update: (anim: AnimeHandle) => {
        const [xAnim, yAnim, zAnim] = anim.animations;
        if (!xAnim || !yAnim || !zAnim) return;
        const x = xAnim.currentValue as number;
        const y = yAnim.currentValue as number;
        const z = zAnim.currentValue as number;
        camera.position.set(x, y, z);
        camera.lookAt(lookAtRef.current);
      },
    });

    return () => animationRef.current?.pause();
  }, [target, camera]);

  useEffect(() => {
    if (phase === "idle") {
      animationRef.current?.pause();
      camera.position.set(0, 2, CAMERA_BASE_DISTANCE);
      camera.lookAt(lookAtRef.current);
    }
  }, [phase, camera]);

  return null;
}

function TargetMarker({ radius }: { radius: number }) {
  const groupRef = useRef<Mesh>(null);
  const target = useAnalysisStore((state) => state.target);

  const position = useMemo(() => {
    if (!target) return null;
    return latLonToVector3(target.latitude, target.longitude, radius * 1.01);
  }, [target, radius]);

  useEffect(() => {
    if (!groupRef.current || !position) return;
    const normal = position.clone().normalize();
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal);
    groupRef.current.position.copy(position);
    groupRef.current.setRotationFromQuaternion(quaternion);
  }, [position]);

  if (!position) return null;

  return (
    <group ref={groupRef}>
      <mesh>
        <ringGeometry args={[0.08, 0.16, 48]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.6} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <ringGeometry args={[0.18, 0.28, 48]} />
        <meshBasicMaterial color="#ff00ff" transparent opacity={0.25} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0, 0.002]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.55, 0.55, 16, 16]} />
        <meshBasicMaterial
          color="#0a101a"
          opacity={0.4}
          transparent
          side={DoubleSide}
          wireframe
        />
      </mesh>
      <mesh position={[0, 0, 0.3]}>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 16, 1, true]} />
        <meshBasicMaterial
          color="#00ffff"
          transparent
          opacity={0.2}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

function TargetGrid({ radius }: { radius: number }) {
  const gridRef = useRef<GridHelper>(null);
  const target = useAnalysisStore((state) => state.target);

  useEffect(() => {
    if (!gridRef.current || !target) return;
    const position = latLonToVector3(target.latitude, target.longitude, radius * 1.01);
    const normal = position.clone().normalize();
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal);
    gridRef.current.position.copy(position);
    gridRef.current.setRotationFromQuaternion(quaternion);
  }, [target, radius]);

  if (!target) return null;

  return (
    <gridHelper ref={gridRef} args={[0.8, 12, "#00ffff", "#004050"]} />
  );
}

function CandidateMarkers({ radius }: { radius: number }) {
  const locations = useAnalysisStore((state) => state.analysis?.analysis?.locations);

  const candidates = useMemo(() => {
    if (!locations) return [] as typeof locations;
    return locations.slice(1);
  }, [locations]);

  if (!candidates.length) return null;

  return (
    <group>
      {candidates.map((candidate, index) => {
        const coords = candidate.coordinates;
        if (!coords || typeof coords.latitude !== "number" || typeof coords.longitude !== "number") {
          return null;
        }
        const position = latLonToVector3(coords.latitude, coords.longitude, radius * 1.005);
        const normal = position.clone().normalize();
        const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), normal);
        return (
          <group key={`candidate-${index}`} position={position} quaternion={quaternion}>
            <mesh position={[0, 0, 0.001]}>
              <ringGeometry args={[0.05, 0.09, 32]} />
              <meshBasicMaterial color="#FFF200" transparent opacity={0.25} side={DoubleSide} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function HeatmapOverlay({ radius }: { radius: number }) {
  const overlays = useGlobeStore((state) => state.overlays);
  const intensityLookup = useGlobeStore((state) => state.overlayIntensity);
  const points = useGlobeStore((state) => state.heatmapPoints);
  const timelineMultiplier = useGlobeStore(
    (state) => state.timeline[state.timelineIndex]?.overlayMultipliers.heatmap ?? 1,
  );

  const effectiveOpacity = overlays.heatmap
    ? (intensityLookup.heatmap ?? 1) * timelineMultiplier
    : 0;
  const renderedPoints = useMemo(() => {
    if (!points.length || effectiveOpacity <= 0.01) return [];
    return points.map((point) => {
      const position = latLonToVector3(
        point.latitude,
        point.longitude,
        radius * 1.015,
      );
      const intensity = Math.max(0.1, Math.min(point.intensity, 1.5));
      const baseColor = new Color().setHSL(
        (0.6 - intensity * 0.5 + 1) % 1,
        0.9,
        0.55,
      );
      return {
        id: point.id,
        position,
        intensity,
        color: baseColor,
        name: point.name,
      };
    });
  }, [points, radius, effectiveOpacity]);

  if (!renderedPoints.length || effectiveOpacity <= 0.01) return null;

  return (
    <group>
      {renderedPoints.map((point) => (
        <mesh
          key={`heat-${point.id}`}
          position={point.position}
          scale={0.06 * point.intensity * effectiveOpacity}
        >
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial
            color={point.color}
            transparent
            opacity={0.6 * effectiveOpacity}
          />
        </mesh>
      ))}
    </group>
  );
}

function WeatherOverlay({ radius }: { radius: number }) {
  const overlays = useGlobeStore((state) => state.overlays);
  const intensityLookup = useGlobeStore((state) => state.overlayIntensity);
  const cells = useGlobeStore((state) => state.weatherCells);
  const timelineMultiplier = useGlobeStore(
    (state) => state.timeline[state.timelineIndex]?.overlayMultipliers.weather ?? 1,
  );

  const effectiveOpacity = overlays.weather
    ? (intensityLookup.weather ?? 1) * timelineMultiplier
    : 0;
  const renderedCells = useMemo(() => {
    if (!cells.length || effectiveOpacity <= 0.01) return [];
    const colorMap: Record<string, string> = {
      storm: "#ff006e",
      rain: "#00e0ff",
      cloudy: "#9aa7ff",
      clear: "#00ff99",
      wind: "#ffd166",
    };
    return cells.map((cell) => {
      const position = latLonToVector3(
        cell.latitude,
        cell.longitude,
        radius * 1.025,
      );
      const severity = Math.max(0.2, Math.min(cell.severity + 0.2, 1.8));
      return {
        id: cell.id,
        position,
        severity,
        color: colorMap[cell.status] ?? "#ffffff",
        status: cell.status,
      };
    });
  }, [cells, radius, effectiveOpacity]);

  if (!renderedCells.length || effectiveOpacity <= 0.01) return null;

  return (
    <group>
      {renderedCells.map((cell) => (
        <mesh
          key={`weather-${cell.id}`}
          position={cell.position}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[0.25 * cell.severity, 0.25 * cell.severity, 0.25]}
        >
          <circleGeometry args={[1, 32]} />
          <meshBasicMaterial
            color={cell.color}
            transparent
            opacity={0.22 * effectiveOpacity}
          />
        </mesh>
      ))}
    </group>
  );
}

function RouteOverlay({ radius }: { radius: number }) {
  const overlays = useGlobeStore((state) => state.overlays);
  const intensityLookup = useGlobeStore((state) => state.overlayIntensity);
  const routes = useGlobeStore((state) => state.routeArcs);
  const timelineMultiplier = useGlobeStore(
    (state) => state.timeline[state.timelineIndex]?.overlayMultipliers.routes ?? 1,
  );

  const effectiveOpacity = overlays.routes
    ? (intensityLookup.routes ?? 1) * timelineMultiplier
    : 0;
  const arcs = useMemo(() => {
    if (!routes.length || effectiveOpacity <= 0.01) return [];
    return routes.map((route) => {
      const start = latLonToVector3(
        route.from.latitude,
        route.from.longitude,
        radius * 1.02,
      );
      const end = latLonToVector3(
        route.to.latitude,
        route.to.longitude,
        radius * 1.02,
      );
      const mid = start
        .clone()
        .add(end)
        .normalize()
        .multiplyScalar(radius * (1.16 + route.magnitude * 0.4));
      const color = new Color().setHSL(
        0.55 - Math.min(route.magnitude, 1) * 0.35,
        0.75,
        0.55,
      );
      return {
        id: route.id,
        points: [start, mid, end],
        color,
        magnitude: route.magnitude,
        label: `${route.from.name} → ${route.to.name}`,
      };
    });
  }, [routes, radius, effectiveOpacity]);

  if (!arcs.length || effectiveOpacity <= 0.01) return null;

  return (
    <group>
      {arcs.map((arc) => (
        <group key={`route-${arc.id}`}>
          <Line
            points={arc.points.map((vector) => vector.toArray() as [number, number, number])}
            color={arc.color}
            lineWidth={2}
            transparent
            opacity={0.35 * effectiveOpacity}
          />
        </group>
      ))}
    </group>
  );
}

function RecentQueriesOverlay({ radius }: { radius: number }) {
  const queries = useGlobeStore((state) => state.recentQueries);
  const intensity = Math.max(0.15, Math.min(0.6, queries.length / 10));

  if (!queries.length) return null;

  return (
    <group>
      {queries.map((query, index) => {
        const position = latLonToVector3(query.latitude, query.longitude, radius * 1.01);
        return (
          <mesh key={`recent-query-${query.id}-${index}`} position={position}>
            <sphereGeometry args={[0.025, 12, 12]} />
            <meshBasicMaterial color="#44ffd2" transparent opacity={intensity} />
          </mesh>
        );
      })}
    </group>
  );
}

function SearchTrails({ radius }: { radius: number }) {
  const trails = useGlobeStore((state) => state.queryTrails);
  if (!trails.length) return null;

  return (
    <group>
      {trails.map((trail, index) => {
        const start = latLonToVector3(trail.from.latitude, trail.from.longitude, radius * 1.02);
        const end = latLonToVector3(trail.to.latitude, trail.to.longitude, radius * 1.02);
        const mid = start
          .clone()
          .add(end)
          .normalize()
          .multiplyScalar(radius * 1.1);
        const color = new Color().setHSL((0.55 - index * 0.05 + 1) % 1, 0.8, 0.55);
        return (
          <Line
            key={`trail-${trail.occurredAt}-${index}`}
            points={[start, mid, end].map((vector) => vector.toArray() as [number, number, number])}
            color={color}
            transparent
            opacity={0.35}
            lineWidth={1.5}
          />
        );
      })}
    </group>
  );
}

function GeoFenceOverlay({ radius }: { radius: number }) {
  const geofence = useGlobeStore((state) => state.activeGeofence);
  if (!geofence) return null;

  const [south, north, west, east] = geofence;
  const segments = 48;

  const latLine = (lat: number, startLon: number, endLon: number) => {
    const points: Vector3[] = [];
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const lon = startLon + (endLon - startLon) * t;
      points.push(latLonToVector3(lat, lon, radius * 1.008));
    }
    return points;
  };

  const lonLine = (lon: number, startLat: number, endLat: number) => {
    const points: Vector3[] = [];
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const lat = startLat + (endLat - startLat) * t;
      points.push(latLonToVector3(lat, lon, radius * 1.008));
    }
    return points;
  };

  const edges = [
    latLine(north, west, east),
    latLine(south, west, east),
    lonLine(west, south, north),
    lonLine(east, south, north),
  ];

  return (
    <group>
      {edges.map((edge, index) => (
        <Line
          key={`geofence-edge-${index}`}
          points={edge.map((vector) => vector.toArray() as [number, number, number])}
          color="#ff66ff"
          opacity={0.45}
          transparent
          lineWidth={1.5}
        />
      ))}
    </group>
  );
}

function SerpBadges({ radius }: { radius: number }) {
  const serpContext = useAnalysisStore((state) => state.analysis?.analysis?.serpapi_results?.context);
  const target = useAnalysisStore((state) => state.target);

  const entries = useMemo(() => {
    if (!serpContext || !target) return [] as Array<{ label: string; position: Vector3 }>;
    const lines = serpContext
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^result\s*\d+/i.test(line) && !/^source:/i.test(line) && !/^url:/i.test(line))
      .slice(0, 4);
    const base = latLonToVector3(target.latitude, target.longitude, radius * 1.02);
    const normal = base.clone().normalize();
    const tangent = new Vector3().crossVectors(normal, new Vector3(0, 1, 0)).normalize();
    const bitangent = new Vector3().crossVectors(normal, tangent).normalize();

    return lines.map((label, index) => {
      const angle = (index / Math.max(lines.length, 1)) * Math.PI * 2;
      const offset = tangent
        .clone()
        .multiplyScalar(Math.cos(angle) * 0.3)
        .add(bitangent.clone().multiplyScalar(Math.sin(angle) * 0.3));
      return {
        label: label.length > 28 ? `${label.slice(0, 25)}…` : label,
        position: base.clone().add(offset),
      };
    });
  }, [serpContext, target, radius]);

  if (!entries.length) return null;

  return (
    <>
      {entries.map((entry, index) => (
        <Html
          key={`serp-badge-${index}`}
          position={entry.position.toArray() as [number, number, number]}
          distanceFactor={7}
          className="pointer-events-none select-none rounded-full border border-cyan-400/30 bg-black/70 px-3 py-1 font-mono text-[8px] uppercase tracking-[0.25em] text-cyan-100/90 shadow-[0_0_12px_rgba(0,255,255,0.25)]"
        >
          {entry.label}
        </Html>
      ))}
    </>
  );
}

function TargetLabels({ radius }: { radius: number }) {
  const target = useAnalysisStore((state) => state.target);
  const primaryLocation = useAnalysisStore((state) => state.analysis?.analysis?.locations?.[0]);

  if (!target || !primaryLocation) return null;

  const position = latLonToVector3(target.latitude, target.longitude, radius * 1.12);

  const name = primaryLocation.city || primaryLocation.state || primaryLocation.country || "Target";
  const confidence = primaryLocation.confidence ? `Confidence ${primaryLocation.confidence}` : undefined;

  return (
    <Html
      position={position.toArray() as [number, number, number]}
      distanceFactor={5}
      className="pointer-events-none select-none rounded-xl border border-cyan-400/40 bg-black/70 px-3 py-2 font-display text-[8px] uppercase tracking-[0.35em] text-cyan-100 shadow-[0_0_20px_rgba(0,255,255,0.2)]"
    >
      <div>{name}</div>
      {confidence && <div className="mt-1 font-mono text-[7px] tracking-[0.3em] text-cyan-200/70">{confidence}</div>}
    </Html>
  );
}

function SceneContent() {
  const satellites = useMemo(
    () => [
      { orbitRadius: 3.8, baseSpeed: 0.18, color: "#00ffff", initialAngle: 0 },
      { orbitRadius: 4.4, baseSpeed: 0.16, color: "#ff00ff", initialAngle: 1 },
      { orbitRadius: 3.2, baseSpeed: 0.22, color: "#a020f0", initialAngle: 2 },
    ],
    [],
  );

  return (
    <>
      <GlobeDataProvider />
      <PerspectiveCamera makeDefault fov={52} position={[0, 2, CAMERA_BASE_DISTANCE]} />
      <color attach="background" args={["#050510"]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[5, 4, 2]} intensity={1.1} color="#88ddff" />
      <directionalLight position={[-4, -3, -5]} intensity={0.3} color="#ff40ff" />

      <group>
        <Earth />
        <Atmosphere />
        <CityLabels />
        <TargetGrid radius={EARTH_RADIUS} />
        <TargetMarker radius={EARTH_RADIUS} />
        <TargetLabels radius={EARTH_RADIUS} />
        <SerpBadges radius={EARTH_RADIUS} />
        <CandidateMarkers radius={EARTH_RADIUS} />
        <HeatmapOverlay radius={EARTH_RADIUS} />
        <WeatherOverlay radius={EARTH_RADIUS} />
        <RouteOverlay radius={EARTH_RADIUS} />
        <RecentQueriesOverlay radius={EARTH_RADIUS} />
        <SearchTrails radius={EARTH_RADIUS} />
        <GeoFenceOverlay radius={EARTH_RADIUS} />
        {satellites.map((satellite) => (
          <Satellite key={satellite.color} {...satellite} altitude={0.6} />
        ))}
      </group>

      <Stars
        radius={140}
        depth={60}
        count={9000}
        factor={4}
        saturation={0}
        fade
        speed={0.6}
      />

      <AccumulativeShadows
        temporal
        frames={120}
        color="#00ffff"
        colorBlend={0.4}
        opacity={0.25}
        scale={20}
        alphaTest={0.5}
      />

      <EffectComposer>
        <Bloom intensity={1.2} luminanceThreshold={0.2} luminanceSmoothing={0.9} />
      </EffectComposer>

      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={0.5}
        maxPolarAngle={Math.PI * 0.75}
        minPolarAngle={Math.PI * 0.25}
      />
      <CameraRig />
    </>
  );
}

export function GlobeScene() {
  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, toneMappingExposure: 1.6 }}
        className="h-full w-full"
      >
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>
    </div>
  );
}
