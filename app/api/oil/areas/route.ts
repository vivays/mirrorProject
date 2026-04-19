import { NextResponse } from "next/server";
import { fallbackAreas, type AreaOption } from "@/lib/oil-data";
import { readOpinetCertkey } from "@/lib/opinet-env";

export const runtime = "nodejs";

type OpinetArea = {
  AREA_CD?: string;
  AREA_NM?: string;
};

function toArray(value: unknown): OpinetArea[] {
  if (Array.isArray(value)) {
    return value as OpinetArea[];
  }

  if (value && typeof value === "object") {
    return [value as OpinetArea];
  }

  return [];
}

function normalizeTopAreaName(value: string) {
  return value
    .replace("특별시", "")
    .replace("광역시", "")
    .replace("특별자치시", "")
    .replace("특별자치도", "")
    .replace("자치도", "")
    .replace("도", "")
    .trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parentArea = searchParams.get("area")?.trim() ?? "";
  const certkey = readOpinetCertkey();

  if (certkey) {
    try {
      const params = new URLSearchParams({
        certkey,
        out: "json"
      });

      if (parentArea) {
        params.set("area", parentArea);
      }

      const response = await fetch(`https://www.opinet.co.kr/api/areaCode.do?${params}`, {
        next: { revalidate: 60 * 60 * 24 }
      });

      if (!response.ok) {
        throw new Error(`Opinet responded ${response.status}`);
      }

      const data = (await response.json()) as { RESULT?: { OIL?: unknown } };
      const regionalAreas = toArray(data.RESULT?.OIL)
        .map((area) => ({
          code: area.AREA_CD ?? "",
          name: area.AREA_NM ? (parentArea ? area.AREA_NM.trim() : normalizeTopAreaName(area.AREA_NM)) : ""
        }))
        .filter((area): area is AreaOption => area.code.length > 0 && area.name.length > 0);

      if (regionalAreas.length > 0) {
        return NextResponse.json({
          source: "opinet",
          mode: "live",
          updatedAt: new Date().toISOString(),
          parentArea,
          areas: parentArea ? regionalAreas : [fallbackAreas[0], ...regionalAreas]
        });
      }
    } catch (error) {
      console.error("Opinet area code lookup failed", error);
    }
  }

  return NextResponse.json({
    source: "demo",
    mode: certkey ? "fallback" : "demo",
    updatedAt: new Date().toISOString(),
    parentArea,
    areas: parentArea ? [] : fallbackAreas
  });
}
