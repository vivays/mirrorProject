import { NextResponse } from "next/server";
import { katecToWgs84, wgs84ToKatec } from "@/lib/katec";
import { brandLabels, buildDemoStations, normalizeFuel, type Station } from "@/lib/oil-data";
import { readOpinetCertkey } from "@/lib/opinet-env";

export const runtime = "nodejs";

type OpinetStation = {
  UNI_ID?: string;
  POLL_DIV_CD?: string;
  GPOLL_DIV_CD?: string;
  OS_NM?: string;
  NEW_ADR?: string;
  VAN_ADR?: string;
  PRICE?: string | number;
  DISTANCE?: string | number;
  GIS_X_COOR?: string | number;
  GIS_Y_COOR?: string | number;
  SELF_YN?: string;
  CVS_YN?: string;
};

type OpinetDetailResponse = {
  RESULT?: {
    OIL?: unknown;
  };
};

function toArray(value: unknown): OpinetStation[] {
  if (Array.isArray(value)) {
    return value as OpinetStation[];
  }

  if (value && typeof value === "object") {
    return [value as OpinetStation];
  }

  return [];
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readKatecPosition(item: OpinetStation) {
  const x = toNumber(item.GIS_X_COOR, Number.NaN);
  const y = toNumber(item.GIS_Y_COOR, Number.NaN);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return {};
  }

  return katecToWgs84(x, y);
}

function mapOpinetStation(item: OpinetStation, index: number, fuel: ReturnType<typeof normalizeFuel>) {
  const price = toNumber(item.PRICE);
  const brandCode = item.POLL_DIV_CD ?? item.GPOLL_DIV_CD ?? "";
  const position = readKatecPosition(item);

  return {
    id: item.UNI_ID ?? `opinet-${index}`,
    rank: index + 1,
    name: item.OS_NM ?? "이름 없는 주유소",
    brand: brandLabels[brandCode] ?? brandCode ?? "기타",
    address: item.NEW_ADR ?? item.VAN_ADR ?? "주소 정보 없음",
    price,
    distanceMeters: toNumber(item.DISTANCE),
    ...position,
    fuel,
    self: item.SELF_YN === "Y",
    open24h: item.CVS_YN === "Y",
    delta: 0
  } satisfies Station;
}

async function fetchStationDetail(certkey: string, id: string) {
  const params = new URLSearchParams({
    certkey,
    out: "json",
    id
  });
  const response = await fetch(`https://www.opinet.co.kr/api/detailById.do?${params}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Opinet detail responded ${response.status}`);
  }

  const data = (await response.json()) as OpinetDetailResponse;
  return toArray(data.RESULT?.OIL)[0];
}

async function enrichStations(certkey: string, stations: Station[]) {
  const details = await Promise.all(
    stations.map(async (station) => {
      try {
        return await fetchStationDetail(certkey, station.id);
      } catch (error) {
        console.error(`Opinet station detail lookup failed for ${station.id}`, error);
        return undefined;
      }
    })
  );

  return stations.map((station, index) => {
    const detail = details[index];

    if (!detail) {
      return station;
    }

    const brandCode = detail.POLL_DIV_CD ?? detail.GPOLL_DIV_CD ?? "";
    const position = readKatecPosition(detail);

    return {
      ...station,
      name: detail.OS_NM ?? station.name,
      brand: brandLabels[brandCode] ?? station.brand,
      address: detail.NEW_ADR ?? detail.VAN_ADR ?? station.address,
      ...position,
      self: detail.SELF_YN === "Y" || station.self,
      open24h: detail.CVS_YN === "Y" || station.open24h
    };
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = toNumber(searchParams.get("lat"), 37.5665);
  const longitude = toNumber(searchParams.get("lon"), 126.978);
  const fuel = normalizeFuel(searchParams.get("fuel"));
  const radius = Math.min(Math.max(toNumber(searchParams.get("radius"), 3000), 500), 5000);
  const certkey = readOpinetCertkey();

  if (certkey) {
    try {
      const katec = wgs84ToKatec(latitude, longitude);
      const params = new URLSearchParams({
        certkey,
        out: "json",
        x: String(katec.x),
        y: String(katec.y),
        radius: String(radius),
        prodcd: fuel,
        sort: "1"
      });
      const response = await fetch(`https://www.opinet.co.kr/api/aroundAll.do?${params}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`Opinet responded ${response.status}`);
      }

      const data = (await response.json()) as { RESULT?: { OIL?: unknown } };
      const stations = toArray(data.RESULT?.OIL)
        .map((station, index) => mapOpinetStation(station, index, fuel))
        .filter((station) => station.price > 0)
        .sort((a, b) => a.price - b.price || a.distanceMeters - b.distanceMeters)
        .slice(0, 5)
        .map((station, index) => ({ ...station, rank: index + 1 }));

      const enrichedStations = stations.length > 0 ? await enrichStations(certkey, stations) : [];

      return NextResponse.json(
        {
          source: "opinet",
          mode: "live",
          updatedAt: new Date().toISOString(),
          radius,
          center: { latitude, longitude },
          stations: enrichedStations
        },
        {
          headers: {
            "Cache-Control": "no-store"
          }
        }
      );
    } catch (error) {
      console.error("Opinet station lookup failed", error);
    }
  }

  return NextResponse.json(
    {
      source: "demo",
      mode: certkey ? "fallback" : "demo",
      updatedAt: new Date().toISOString(),
      radius,
      center: { latitude, longitude },
      stations: buildDemoStations(latitude, longitude, fuel)
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
