import { NextResponse } from "next/server";
import { buildDemoAverages, fuelOptions, type DomesticAverage, type FuelCode } from "@/lib/oil-data";

export const runtime = "nodejs";

type OpinetAverage = {
  PRODCD?: string;
  PRODNM?: string;
  PRICE?: string | number;
  DIFF?: string | number;
};

function toArray(value: unknown): OpinetAverage[] {
  if (Array.isArray(value)) {
    return value as OpinetAverage[];
  }

  if (value && typeof value === "object") {
    return [value as OpinetAverage];
  }

  return [];
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function GET() {
  const certkey = process.env.OPINET_CERTKEY ?? process.env.OPINET_API_KEY;

  if (certkey) {
    try {
      const params = new URLSearchParams({ certkey, out: "json" });
      const response = await fetch(`https://www.opinet.co.kr/api/avgAllPrice.do?${params}`, {
        next: { revalidate: 60 * 20 }
      });

      if (!response.ok) {
        throw new Error(`Opinet responded ${response.status}`);
      }

      const data = (await response.json()) as { RESULT?: { OIL?: unknown } };
      const averages = toArray(data.RESULT?.OIL)
        .map((item) => ({
          code: item.PRODCD as FuelCode,
          label:
            fuelOptions.find((fuel) => fuel.code === item.PRODCD)?.label ?? item.PRODNM ?? "유종",
          price: toNumber(item.PRICE),
          diff: toNumber(item.DIFF)
        }))
        .filter((item): item is DomesticAverage => item.price > 0);

      if (averages.length > 0) {
        return NextResponse.json({
          source: "opinet",
          mode: "live",
          updatedAt: new Date().toISOString(),
          averages
        });
      }
    } catch (error) {
      console.error("Opinet averages lookup failed", error);
    }
  }

  return NextResponse.json({
    source: "demo",
    mode: certkey ? "fallback" : "demo",
    updatedAt: new Date().toISOString(),
    averages: buildDemoAverages()
  });
}
