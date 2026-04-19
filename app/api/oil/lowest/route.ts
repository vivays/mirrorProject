import { NextResponse } from "next/server";
import {
  brandLabels,
  buildDemoLowestStations,
  normalizeFuel,
  type FuelCode,
  type LowestStation
} from "@/lib/oil-data";
import { readOpinetCertkey } from "@/lib/opinet-env";

export const runtime = "nodejs";

type OpinetLowestStation = {
  UNI_ID?: string;
  PRICE?: string | number;
  POLL_DIV_CD?: string;
  POLL_DIV_CO?: string;
  OS_NM?: string;
  VAN_ADR?: string;
  NEW_ADR?: string;
};

function toArray(value: unknown): OpinetLowestStation[] {
  if (Array.isArray(value)) {
    return value as OpinetLowestStation[];
  }

  if (value && typeof value === "object") {
    return [value as OpinetLowestStation];
  }

  return [];
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapLowestStation(item: OpinetLowestStation, index: number, fuel: FuelCode) {
  const brandCode = item.POLL_DIV_CD ?? item.POLL_DIV_CO ?? "";

  return {
    id: item.UNI_ID ?? `lowest-${index}`,
    rank: index + 1,
    name: item.OS_NM ?? "이름 없는 주유소",
    brand: brandLabels[brandCode] ?? brandCode ?? "기타",
    address: item.NEW_ADR ?? item.VAN_ADR ?? "주소 정보 없음",
    price: toNumber(item.PRICE),
    fuel
  } satisfies LowestStation;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fuel = normalizeFuel(searchParams.get("fuel"));
  const area = searchParams.get("area")?.trim() ?? "";
  const count = Math.min(Math.max(toNumber(searchParams.get("cnt"), 10), 1), 20);
  const certkey = readOpinetCertkey();

  if (certkey) {
    try {
      const params = new URLSearchParams({
        certkey,
        out: "json",
        prodcd: fuel,
        cnt: String(count)
      });

      if (area) {
        params.set("area", area);
      }

      const response = await fetch(`https://www.opinet.co.kr/api/lowTop10.do?${params}`, {
        next: { revalidate: 60 * 10 }
      });

      if (!response.ok) {
        throw new Error(`Opinet responded ${response.status}`);
      }

      const data = (await response.json()) as { RESULT?: { OIL?: unknown } };
      const lowest = toArray(data.RESULT?.OIL)
        .map((station, index) => mapLowestStation(station, index, fuel))
        .filter((station) => station.price > 0)
        .sort((a, b) => a.price - b.price)
        .slice(0, count)
        .map((station, index) => ({ ...station, rank: index + 1 }));

      if (lowest.length > 0) {
        return NextResponse.json({
          source: "opinet",
          mode: "live",
          updatedAt: new Date().toISOString(),
          fuel,
          area: area || "national",
          lowest
        });
      }
    } catch (error) {
      console.error("Opinet lowest lookup failed", error);
    }
  }

  return NextResponse.json({
    source: "demo",
    mode: certkey ? "fallback" : "demo",
    updatedAt: new Date().toISOString(),
    fuel,
    area: area || "national",
    lowest: buildDemoLowestStations(fuel, count)
  });
}
