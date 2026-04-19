import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type NominatimAddress = {
  state?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  borough?: string;
  city_district?: string;
  district?: string;
  suburb?: string;
  quarter?: string;
  neighbourhood?: string;
  hamlet?: string;
  road?: string;
};

type NominatimReverse = {
  display_name?: string;
  address?: NominatimAddress;
};

function cleanPart(value?: string) {
  return value?.replace(/대한민국|South Korea/g, "").trim();
}

function uniqParts(parts: Array<string | undefined>) {
  const seen = new Set<string>();

  return parts
    .map(cleanPart)
    .filter((part): part is string => Boolean(part))
    .filter((part) => {
      if (seen.has(part)) {
        return false;
      }

      seen.add(part);
      return true;
    });
}

function buildLabel(address?: NominatimAddress, displayName?: string) {
  if (!address) {
    return cleanPart(displayName)?.split(",").slice(0, 3).join(" ") || "위치 확인";
  }

  const sido = cleanPart(address.state ?? address.city);
  const sigungu = cleanPart(address.borough ?? address.city_district ?? address.county ?? address.district);
  const dong = cleanPart(address.suburb ?? address.quarter ?? address.neighbourhood ?? address.village ?? address.town);
  const detail = cleanPart(address.road ?? address.hamlet);
  const parts = uniqParts([sido, sigungu, dong, detail]);

  return parts.length > 0 ? parts.slice(0, 4).join(" ") : cleanPart(displayName)?.split(",").slice(0, 3).join(" ") || "위치 확인";
}

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat/lon is required" }, { status: 400 });
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lon));
    url.searchParams.set("zoom", "18");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "Accept-Language": "ko,en",
        "User-Agent": "OilRushOpinetRemix/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim responded ${response.status}`);
    }

    const data = (await response.json()) as NominatimReverse;
    const address = data.address;

    return NextResponse.json({
      source: "nominatim",
      mode: "live",
      updatedAt: new Date().toISOString(),
      latitude: lat,
      longitude: lon,
      sido: cleanPart(address?.state ?? address?.city),
      sigungu: cleanPart(address?.borough ?? address?.city_district ?? address?.county ?? address?.district),
      dong: cleanPart(address?.suburb ?? address?.quarter ?? address?.neighbourhood ?? address?.village ?? address?.town),
      label: buildLabel(address, data.display_name)
    });
  } catch (error) {
    console.error("Reverse location lookup failed", error);

    return NextResponse.json({
      source: "coordinate",
      mode: "fallback",
      updatedAt: new Date().toISOString(),
      latitude: lat,
      longitude: lon,
      label: `${lat.toFixed(4)}, ${lon.toFixed(4)}`
    });
  }
}
