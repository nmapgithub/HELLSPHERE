import { NextResponse } from "next/server";

const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length < 3) {
    return NextResponse.json(
      { error: "Query must be at least 3 characters long." },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "8",
  });

  try {
    const response = await fetch(`${NOMINATIM_ENDPOINT}?${params.toString()}`, {
      headers: {
        "User-Agent": "GeoIntel-UI/1.0 (https://github.com/nmapgithub/HELLSPHERE)",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Geocode request failed (${response.status}).` },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as Array<{
      place_id: string;
      display_name: string;
      lat: string;
      lon: string;
      type?: string;
      boundingbox?: [string, string, string, string];
      address?: {
        country?: string;
        state?: string;
        region?: string;
        city?: string;
      };
    }>;

    const results = payload.map((item) => ({
      id: item.place_id,
      name: item.display_name.split(",")[0] ?? item.display_name,
      displayName: item.display_name,
      latitude: Number.parseFloat(item.lat),
      longitude: Number.parseFloat(item.lon),
      type: item.type,
      boundingBox: item.boundingbox
        ? item.boundingbox.map((value) => Number.parseFloat(value)) satisfies [
            number,
            number,
            number,
            number,
          ]
        : undefined,
      country: item.address?.country,
      region: item.address?.state ?? item.address?.region,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Geocode lookup failed", error);
    return NextResponse.json(
      { error: "Unable to reach geocoding service right now." },
      { status: 502 },
    );
  }
}

