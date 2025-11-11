import { NextResponse } from "next/server";

const CELESTRAK_ENDPOINT = "https://celestrak.org/NORAD/elements/gp.php";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const group = searchParams.get("group") ?? "active";
  const limitParam = searchParams.get("limit") ?? "25";
  const limit = Math.max(1, Math.min(Number.parseInt(limitParam, 10) || 25, 100));

  const params = new URLSearchParams({
    GROUP: group,
    FORMAT: "json",
  });

  try {
    const response = await fetch(`${CELESTRAK_ENDPOINT}?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Satellite lookup failed (${response.status}).` },
        { status: response.status },
      );
    }

    const payload = (await response.json()) as Array<{
      OBJECT_NAME: string;
      NORAD_CAT_ID: number;
      LAUNCH_DATE?: string;
      MEAN_MOTION?: number;
      ECCENTRICITY?: number;
      INCLINATION?: number;
      RA_OF_ASC_NODE?: number;
      ARG_OF_PERICENTER?: number;
      MEAN_ANOMALY?: number;
    }>;

    return NextResponse.json({
      satellites: payload.slice(0, limit),
    });
  } catch (error) {
    console.error("Satellite lookup failed", error);
    return NextResponse.json(
      { error: "Unable to reach satellite service right now." },
      { status: 502 },
    );
  }
}

