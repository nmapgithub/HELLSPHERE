import type {
  HeatmapPoint,
  RouteArc,
  TimelineEvent,
  WeatherCell,
} from "@/stores/globeStore";

type WeatherSample = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
};

const WEATHER_SAMPLE_LOCATIONS: WeatherSample[] = [
  { id: "nyc", name: "New York", latitude: 40.7128, longitude: -74.006 },
  { id: "lon", name: "London", latitude: 51.5072, longitude: -0.1276 },
  { id: "dub", name: "Dubai", latitude: 25.276987, longitude: 55.296249 },
  { id: "tok", name: "Tokyo", latitude: 35.6762, longitude: 139.6503 },
  { id: "syd", name: "Sydney", latitude: -33.8688, longitude: 151.2093 },
  { id: "nbo", name: "Nairobi", latitude: -1.2864, longitude: 36.8172 },
  { id: "osl", name: "Oslo", latitude: 59.9139, longitude: 10.7522 },
  { id: "scl", name: "Santiago", latitude: -33.4489, longitude: -70.6693 },
];

const WEATHER_STATUS_THRESHOLDS = {
  storm: { precipitation: 8, wind: 12 },
  rain: { precipitation: 2 },
  wind: { wind: 12 },
  cloudy: { cloudcover: 45 },
} as const;

function classifyWeather(cell: {
  precipitation: number;
  windspeed: number;
  cloudcover: number;
}): WeatherCell["status"] {
  if (cell.precipitation >= WEATHER_STATUS_THRESHOLDS.storm.precipitation && cell.windspeed >= WEATHER_STATUS_THRESHOLDS.storm.wind) {
    return "storm";
  }
  if (cell.precipitation >= WEATHER_STATUS_THRESHOLDS.rain.precipitation) {
    return "rain";
  }
  if (cell.windspeed >= WEATHER_STATUS_THRESHOLDS.wind.wind) {
    return "wind";
  }
  if (cell.cloudcover >= WEATHER_STATUS_THRESHOLDS.cloudy.cloudcover) {
    return "cloudy";
  }
  return "clear";
}

function normalize(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || min === max) return 0;
  return (value - min) / (max - min);
}

async function fetchWeatherSample(sample: WeatherSample) {
  const params = new URLSearchParams({
    latitude: sample.latitude.toString(),
    longitude: sample.longitude.toString(),
  });
  const response = await fetch(`/api/weather?${params.toString()}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Weather fetch failed for ${sample.name}`);
  }
  const payload = (await response.json()) as {
    current?: {
      temperature?: number;
      windspeed?: number;
      weathercode?: number;
    };
    hourly?: {
      temperature?: number[];
      precipitation?: number[];
      cloudcover?: number[];
      windspeed?: number[];
    };
  };
  const latestIndex = payload.hourly?.temperature?.length
    ? payload.hourly.temperature.length - 1
    : 0;

  return {
    id: sample.id,
    name: sample.name,
    latitude: sample.latitude,
    longitude: sample.longitude,
    temperature: payload.current?.temperature ?? payload.hourly?.temperature?.[latestIndex] ?? 0,
    precipitation: payload.hourly?.precipitation?.[latestIndex] ?? 0,
    cloudcover: payload.hourly?.cloudcover?.[latestIndex] ?? 0,
    windspeed: payload.hourly?.windspeed?.[latestIndex] ?? payload.current?.windspeed ?? 0,
  };
}

type WeatherObservation = Awaited<ReturnType<typeof fetchWeatherSample>>;

async function fetchWeatherSamples(): Promise<WeatherObservation[]> {
  const results = await Promise.allSettled(
    WEATHER_SAMPLE_LOCATIONS.map((sample) => fetchWeatherSample(sample)),
  );

  return results
    .filter(
      (
        item,
      ): item is PromiseFulfilledResult<WeatherObservation> => item.status === "fulfilled",
    )
    .map((item) => item.value);
}

export async function loadHeatmapData(
  observations?: WeatherObservation[],
): Promise<HeatmapPoint[]> {
  const samples = observations ?? (await fetchWeatherSamples());

  if (!samples.length) {
    return [];
  }

  const temperatures = samples.map((cell) => cell.temperature);
  const min = Math.min(...temperatures);
  const max = Math.max(...temperatures);

  return samples.map((cell) => ({
    id: cell.id,
    name: cell.name,
    latitude: cell.latitude,
    longitude: cell.longitude,
    intensity: normalize(cell.temperature, min, max),
    multipliers: [
      normalize(cell.precipitation, 0, 10),
      normalize(cell.windspeed, 0, 20),
    ],
  }));
}

export async function loadWeatherCells(
  observations?: WeatherObservation[],
): Promise<WeatherCell[]> {
  const samples = observations ?? (await fetchWeatherSamples());

  return samples.map((cell) => {
    const status = classifyWeather({
      precipitation: cell.precipitation,
      windspeed: cell.windspeed,
      cloudcover: cell.cloudcover,
    });
    const severityBase =
      status === "storm"
        ? cell.precipitation + cell.windspeed * 0.4
        : status === "rain"
        ? cell.precipitation
        : status === "wind"
        ? cell.windspeed
        : status === "cloudy"
        ? cell.cloudcover
        : 5;

    return {
      id: cell.id,
      latitude: cell.latitude,
      longitude: cell.longitude,
      status,
      severity: Math.min(1, severityBase / 20),
      multipliers: [
        normalize(cell.precipitation, 0, 12),
        normalize(cell.windspeed, 0, 30),
      ],
    };
  });
}

export async function loadTimeline(
  cells: WeatherCell[],
): Promise<TimelineEvent[]> {
  const now = new Date();
  const hours = [-6, -3, 0, 3, 6, 9];

  return hours.map((offset, index) => {
    const timestamp = new Date(now.getTime() + offset * 60 * 60 * 1000);
    const severity =
      cells.reduce((acc, cell) => acc + cell.severity, 0) / Math.max(cells.length, 1);
    return {
      id: `event-${index}`,
      label: offset === 0 ? "Now" : offset > 0 ? `+${offset}h` : `${offset}h`,
      description:
        offset === 0
          ? "Live conditions across monitored sites."
          : offset > 0
          ? "Projected weather pattern shift."
          : "Historical snapshot from earlier today.",
      timestamp: timestamp.toISOString(),
      overlayMultipliers: {
        heatmap: Math.min(1, severity + index * 0.05),
        weather: Math.min(1, severity + index * 0.08),
        routes: Math.max(0.4, 1 - Math.abs(offset) * 0.05),
      },
    };
  });
}

export function buildRouteArcs(points: HeatmapPoint[]): RouteArc[] {
  if (points.length < 2) {
    return [];
  }

  const sorted = [...points].sort((a, b) => b.intensity - a.intensity).slice(0, 6);
  const arcs: RouteArc[] = [];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const from = sorted[index];
    const to = sorted[(index + 2) % sorted.length];
    arcs.push({
      id: `${from.id}-${to.id}`,
      from: {
        name: from.name,
        latitude: from.latitude,
        longitude: from.longitude,
      },
      to: {
        name: to.name,
        latitude: to.latitude,
        longitude: to.longitude,
      },
      magnitude: (from.intensity + to.intensity) / 2,
      multipliers: from.multipliers,
    });
  }

  return arcs;
}

export async function loadGlobeData() {
  const observations = await fetchWeatherSamples();
  const [heatmapPoints, weatherCells] = await Promise.all([
    loadHeatmapData(observations),
    loadWeatherCells(observations),
  ]);

  const timeline = await loadTimeline(weatherCells);
  const routeArcs = buildRouteArcs(heatmapPoints);

  return {
    heatmapPoints,
    weatherCells,
    routeArcs,
    timeline,
  };
}

