import { NextResponse } from "next/server";
import {
  eciToGeodetic,
  degreesLat,
  degreesLong,
  gstime,
  propagate,
  twoline2satrec,
} from "satellite.js";

const OPEN_METEO_REVERSE_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/reverse";
const OPEN_METEO_FORECAST = "https://api.open-meteo.com/v1/forecast";
const OPEN_TOPO_ENDPOINT = "https://api.opentopodata.org/v1/etopo1";
const USGS_FEED =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
const CELESTRAK_VISUAL_TLE =
  "https://celestrak.org/NORAD/elements/visual.txt";

const EARTH_MEAN_RADIUS_KM = 6371.0088;
const SATELLITE_SAMPLE_COUNT = 6;
const SATELLITE_STEP_SECONDS = 60;
const SATELLITE_LOOKAHEAD_SECONDS = 2 * 60 * 60;
const ALERT_RADIUS_KM = 500;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_MEAN_RADIUS_KM * c;
}

function buildNasaTileUrl(latitude: number, longitude: number, zoom = 5) {
  const tileCount = 2 ** zoom;
  const x = Math.floor(((longitude + 180) / 360) * tileCount);
  const latRad = toRadians(latitude);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
      tileCount,
  );

  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level${zoom}/${zoom}/${y}/${x}.jpg`;
}

function buildFallbackImagery(latitude: number, longitude: number, zoom = 6) {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=${zoom}&size=280x280&maptype=sat`;
}

function buildLinks(name: string, latitude: number, longitude: number) {
  const encodedName = name.replace(/\s+/g, "_");
  return {
    osm: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=10/${latitude}/${longitude}`,
    google: `https://maps.google.com/?q=${latitude},${longitude}`,
    wikipedia: `https://en.wikipedia.org/wiki/${encodeURIComponent(encodedName)}`,
    wikivoyage: `https://en.wikivoyage.org/wiki/${encodeURIComponent(encodedName)}`,
  };
}

function parseTleSets(tleText: string) {
  const lines = tleText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const sets: Array<{ name: string; line1: string; line2: string }> = [];
  for (let index = 0; index < lines.length - 2; index += 3) {
    const [name, line1, line2] = lines.slice(index, index + 3);
    if (line1?.startsWith("1 ") && line2?.startsWith("2 ")) {
      sets.push({ name, line1, line2 });
    }
    if (sets.length >= SATELLITE_SAMPLE_COUNT) break;
  }
  return sets;
}

function computeSatellitePasses(
  tles: Array<{ name: string; line1: string; line2: string }>,
  latitude: number,
  longitude: number,
) {
  const now = new Date();
  const passes: Array<{
    name: string;
    noradId: number;
    distanceKm: number;
    passTime: string;
    altitudeKm?: number;
  }> = [];

  for (const tle of tles) {
    try {
      const satrec = twoline2satrec(tle.line1, tle.line2);
      let closestDistance = Number.POSITIVE_INFINITY;
      let closestTime: Date | null = null;
      let closestAltitudeKm: number | undefined;

      for (let step = 0; step <= SATELLITE_LOOKAHEAD_SECONDS; step += SATELLITE_STEP_SECONDS) {
        const testTime = new Date(now.getTime() + step * 1000);
        const positionAndVelocity = propagate(satrec, testTime);
        if (!positionAndVelocity.position) continue;
        const gmstValue = gstime(testTime);
        const geodetic = eciToGeodetic(positionAndVelocity.position, gmstValue);
        const subLat = degreesLat(geodetic.latitude);
        const subLon = degreesLong(geodetic.longitude);
        const distance = haversineDistance(latitude, longitude, subLat, subLon);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestTime = testTime;
          closestAltitudeKm = geodetic.height ? geodetic.height / 1000 : undefined;
        }
      }

      if (closestTime && closestDistance < 2500) {
        const noradId = Number.parseInt(tle.line1.slice(2, 7), 10);
        passes.push({
          name: tle.name.trim(),
          noradId,
          distanceKm: Number(closestDistance.toFixed(1)),
          passTime: closestTime.toISOString(),
          altitudeKm: closestAltitudeKm
            ? Number(closestAltitudeKm.toFixed(1))
            : undefined,
        });
      }
    } catch (error) {
      console.warn("Failed to process TLE", tle.name, error);
    }
  }

  return passes.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 5);
}

function mapWeatherCode(code: number | null | undefined) {
  const map: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Freezing drizzle",
    57: "Freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm with hail",
  };
  if (code == null) return null;
  return map[code] ?? "Weather data unavailable";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get("latitude");
  const lonParam = searchParams.get("longitude");
  const nameParam = searchParams.get("name");

  if (!latParam || !lonParam) {
    return NextResponse.json(
      { error: "latitude and longitude are required" },
      { status: 400 },
    );
  }

  const latitude = Number.parseFloat(latParam);
  const longitude = Number.parseFloat(lonParam);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { error: "Invalid latitude or longitude" },
      { status: 400 },
    );
  }

  try {
    const reverseUrl = new URL(OPEN_METEO_REVERSE_ENDPOINT);
    reverseUrl.searchParams.set("latitude", latParam);
    reverseUrl.searchParams.set("longitude", lonParam);
    reverseUrl.searchParams.set("language", "en");
    reverseUrl.searchParams.set("count", "1");

    const weatherUrl = new URL(OPEN_METEO_FORECAST);
    weatherUrl.searchParams.set("latitude", latParam);
    weatherUrl.searchParams.set("longitude", lonParam);
    weatherUrl.searchParams.set("current_weather", "true");
    weatherUrl.searchParams.set("hourly", "temperature_2m,precipitation,weathercode,windspeed_10m");
    weatherUrl.searchParams.set("timezone", "UTC");

    const topoUrl = new URL(OPEN_TOPO_ENDPOINT);
    topoUrl.searchParams.set("locations", `${latParam},${lonParam}`);

    const [reverseRes, weatherRes, topoRes, usgsRes, tleRes] = await Promise.all([
      fetch(reverseUrl, { cache: "no-store" }),
      fetch(weatherUrl, { cache: "no-store" }),
      fetch(topoUrl, { cache: "no-store" }),
      fetch(USGS_FEED, { cache: "no-store" }),
      fetch(CELESTRAK_VISUAL_TLE, { cache: "no-store" }),
    ]);

    if (!reverseRes.ok) {
      throw new Error(`Reverse geocoding failed (${reverseRes.status})`);
    }
    if (!weatherRes.ok) {
      throw new Error(`Weather fetch failed (${weatherRes.status})`);
    }

    const reversePayload = (await reverseRes.json()) as {
      results?: Array<{
        name?: string;
        country?: string;
        admin1?: string;
        timezone?: string;
        population?: number;
        elevation?: number;
      }>;
    };

    const weatherPayload = (await weatherRes.json()) as {
      current_weather?: {
        temperature?: number;
        windspeed?: number;
        weathercode?: number;
      };
      hourly?: {
        precipitation?: number[];
      };
    };

    const topoPayload = topoRes.ok
      ? ((await topoRes.json()) as {
          results?: Array<{ elevation?: number }>;
        })
      : undefined;

    const usgsPayload = usgsRes.ok
      ? ((await usgsRes.json()) as {
          features?: Array<{
            id: string;
            properties: {
              mag?: number;
              title?: string;
              place?: string;
              time?: number;
            };
            geometry: { coordinates: [number, number, number] };
          }>;
        })
      : undefined;

    const tleText = tleRes.ok ? await tleRes.text() : "";
    const tleSets = parseTleSets(tleText);

    const result = reversePayload.results?.[0];
    const currentWeather = weatherPayload.current_weather ?? {};
    const precipitation = weatherPayload.hourly?.precipitation ?? [];
    const averagePrecipitation =
      precipitation.length > 0
        ? precipitation.slice(0, 6).reduce((acc, value) => acc + value, 0) /
          Math.min(6, precipitation.length)
        : null;

    const alerts =
      usgsPayload?.features
        ?.map((feature) => {
          const [eventLon, eventLat] = feature.geometry.coordinates;
          const distance = haversineDistance(latitude, longitude, eventLat, eventLon);
          if (distance > ALERT_RADIUS_KM) return null;
          return {
            id: feature.id,
            title: feature.properties.title ?? "Seismic activity detected",
            source: "USGS Earthquake Feed",
            severity:
              feature.properties.mag != null
                ? feature.properties.mag >= 6
                  ? "High"
                  : feature.properties.mag >= 5
                  ? "Moderate"
                  : "Low"
                : undefined,
            magnitude: feature.properties.mag ?? undefined,
            distanceKm: Number(distance.toFixed(1)),
            happenedAt: feature.properties.time
              ? new Date(feature.properties.time).toISOString()
              : new Date().toISOString(),
          };
        })
        .filter(Boolean) ?? [];

    const satellites = computeSatellitePasses(tleSets, latitude, longitude);

    const imageryUrl = buildNasaTileUrl(latitude, longitude);
    const links = buildLinks(nameParam ?? result?.name ?? "Location", latitude, longitude);

    const responseBody = {
      country: result?.country ?? null,
      region: result?.admin1 ?? null,
      timezone: result?.timezone ?? null,
      population: result?.population ?? null,
      elevation:
        result?.elevation ??
        topoPayload?.results?.[0]?.elevation ??
        null,
      imageryUrl,
      fallbackImagery: buildFallbackImagery(latitude, longitude),
      weather: {
        temperature: currentWeather.temperature ?? null,
        windspeed: currentWeather.windspeed ?? null,
        precipitation: averagePrecipitation,
        description: mapWeatherCode(currentWeather.weathercode),
      },
      alerts,
      satellites,
      links,
    };

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("Failed to load location info", error);
    return NextResponse.json(
      { error: "Failed to load location intelligence" },
      { status: 502 },
    );
  }
}

