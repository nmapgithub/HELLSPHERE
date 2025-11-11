"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AccumulativeShadows,
  GradientTexture,
  OrbitControls,
  PerspectiveCamera,
  Stars,
} from "@react-three/drei";
import {
  AdditiveBlending,
  Color,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import anime from "animejs";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Satellite } from "./Satellite";
import { CityLabels } from "./CityLabels";
import { useAnalysisStore } from "@/stores/analysisStore";

const EARTH_RADIUS = 1.6;
const CAMERA_BASE_DISTANCE = 6.5;

function latLonToVector3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new Vector3(x, y, z);
}

function Earth() {
  const meshRef = useRef<Mesh>(null);
  const { phase } = useAnalysisStore((state) => ({ phase: state.phase }));

  useFrame((state, delta) => {
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
        <meshStandardMaterial roughness={0.65} metalness={0.1}>
          <GradientTexture
            stops={[0, 0.4, 1]}
            colors={["#02021a", "#071241", "#1f296d"]}
            size={2048}
          />
        </meshStandardMaterial>
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
  const { phase, target } = useAnalysisStore((state) => ({
    phase: state.phase,
    target: state.target,
  }));
  const animationRef = useRef<anime.AnimeInstance | null>(null);
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
      update: (anim) => {
        const { x, y, z } = anim.animations.reduce(
          (acc, item) => ({ ...acc, [item.property]: item.currentValue }),
          {} as Record<string, number>,
        );
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
      <PerspectiveCamera makeDefault fov={52} position={[0, 2, CAMERA_BASE_DISTANCE]} />
      <color attach="background" args={["#050510"]} />
      <ambientLight intensity={0.28} />
      <directionalLight position={[5, 4, 2]} intensity={1.1} color="#88ddff" />
      <directionalLight position={[-4, -3, -5]} intensity={0.3} color="#ff40ff" />

      <group>
        <Earth />
        <Atmosphere />
        <CityLabels />
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
        className="rounded-[32px] border border-cyan-500/10 bg-gradient-to-br from-[#050510] via-[#0d0f2c] to-[#020208] shadow-[0_0_80px_rgba(0,0,0,0.65)]"
      >
        <Suspense fallback={null}>
          <SceneContent />
        </Suspense>
      </Canvas>
      <div className="pointer-events-none absolute inset-0 rounded-[32px] border border-cyan-400/20 shadow-[0_0_45px_rgba(0,255,255,0.28)]" />
    </div>
  );
}

