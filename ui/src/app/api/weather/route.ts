import { NextResponse } from "next/server";

const OPEN_METEO_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = searchParams.get("latitude");
  const longitude = searchParams.get("longitude");

  if (!latitude || !longitude) {
    return NextResponse.json(
      { error: "Latitude and longitude are required." },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    latitude,
    longitude,
    hourly: "temperature_2m,precipitation,cloudcover,windspeed_10m",
    current_weather: "true",
    timezone: "UTC",
  });

  try {
    const response = await fetch(`${OPEN_METEO_ENDPOINT}?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Weather lookup failed (${response.status}).` },
        { status: response.status },
      );
    }

    const payload = await response.json();

    return NextResponse.json({
      location: {
        latitude: Number.parseFloat(latitude),
        longitude: Number.parseFloat(longitude),
      },
      current: payload.current_weather,
      hourly: {
        time: payload.hourly?.time ?? [],
        temperature: payload.hourly?.temperature_2m ?? [],
        precipitation: payload.hourly?.precipitation ?? [],
        cloudcover: payload.hourly?.cloudcover ?? [],
        windspeed: payload.hourly?.windspeed_10m ?? [],
      },
    });
  } catch (error) {
    console.error("Weather lookup failed", error);
    return NextResponse.json(
      { error: "Unable to reach weather service right now." },
      { status: 502 },
    );
  }
}

