# GeoIntel Command UI

Cyberpunk satellite reconnaissance interface built with Next.js (App Router), Three.js, Anime.js, and TailwindCSS. This frontend consumes the existing backend (see `api_config.ini`) and renders a cinematic targeting experience around a neon-lit Earth.

## Quick Start

```bash
npm install
npm run dev
```

The app runs at http://localhost:3000 by default.

## Environment

Copy the example variables and adjust to match your backend endpoint:

```bash
cp env.example .env.local
```

- `NEXT_PUBLIC_ANALYZE_ENDPOINT` – Fully-qualified URL for the backend upload/analyze endpoint (defaults to `/api/analyze`).
- `NEXT_PUBLIC_ENABLE_INTERFACE_AUDIO` – Set to `true` to enable the ambient control-room hum (requires `public/audio/cyber-hum.mp3`).

## Core Technology

- **react-three-fiber + drei** for the Earth globe, satellites, and holographic overlays.
- **Anime.js** sequences orbit boosts, camera zooms, text pulses, and progress arcs.
- **Framer Motion** animates HUD transitions and target acquisition messaging.
- **Zustand** exposes shared analysis state (phase, upload progress, coordinates) across components.
- **TailwindCSS v4** powers the neon HUD theme with custom fonts (Orbitron, Exo 2, Share Tech Mono).

## Key Files

- `src/app/page.tsx` – Hero layout, background effects, audio toggle, and control wiring.
- `src/components/GlobeScene.tsx` – 3D scene with globe, atmosphere, satellites, bloom, and camera rig.
- `src/components/HUDOverlay.tsx` – Crosshair, scanning rings, status copy, and target coordinate display.
- `src/components/UploadButton.tsx` – Glowing upload control that POSTs imagery to the backend and orchestrates the scan sequence.
- `src/stores/analysisStore.ts` – Zustand store for phase transitions, mock fallbacks, and coordinate sharing.

## Mocking & Backend Integration

The upload flow gracefully degrades to mock coordinates (Tokyo) if the backend is unreachable or returns invalid data. Update `NEXT_PUBLIC_ANALYZE_ENDPOINT` once the backend API is available.

## Styling Notes

- Global theme variables live in `src/app/globals.css` (neon palette, noise overlay, font helpers).
- All cinematic effects degrade cleanly on lower-end hardware; you may tune bloom intensity, star counts, and satellite speed in `GlobeScene` to suit deployment targets.

## Next Steps

- Drop real textures for the Earth into `public/textures` (currently using a gradient shader).
- Add mission log or timeline components if additional telemetry is desired.
- Wire actual backend responses to drive highlight overlays and confidence indicators.
