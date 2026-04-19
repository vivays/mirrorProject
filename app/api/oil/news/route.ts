import { NextResponse } from "next/server";
import { fallbackNews, type OilNews } from "@/lib/oil-data";

export const runtime = "nodejs";

function decodeEntities(value: string) {
  return value
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
}

function pickTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeEntities(match[1].trim()) : "";
}

function looksEnglish(value: string) {
  const letters = value.match(/[A-Za-z]/g)?.length ?? 0;
  const hangul = value.match(/[가-힣]/g)?.length ?? 0;

  return letters > 12 && hangul === 0;
}

async function translateTitle(title: string) {
  if (!looksEnglish(title)) {
    return undefined;
  }

  try {
    const params = new URLSearchParams({
      client: "gtx",
      sl: "auto",
      tl: "ko",
      dt: "t",
      q: title
    });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, {
      next: { revalidate: 60 * 60 }
    });

    if (!response.ok) {
      throw new Error(`Translate responded ${response.status}`);
    }

    const data = (await response.json()) as unknown;

    if (!Array.isArray(data) || !Array.isArray(data[0])) {
      return undefined;
    }

    const translated = data[0]
      .map((part) => (Array.isArray(part) && typeof part[0] === "string" ? part[0] : ""))
      .join("")
      .trim();

    return translated.length > 0 && translated !== title ? translated : undefined;
  } catch (error) {
    console.error("Oil news title translation failed", error);
    return undefined;
  }
}

function parseGoogleNews(xml: string): OilNews[] {
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g))
    .slice(0, 6)
    .map((match, index) => {
      const block = match[1];
      const title = pickTag(block, "title");
      const source = pickTag(block, "source") || title.split(" - ").at(-1) || "Google News";
      const publishedAt = new Date(pickTag(block, "pubDate") || Date.now()).toISOString();

      return {
        id: `news-${index}`,
        title,
        source,
        url: pickTag(block, "link") || "https://news.google.com/search?q=crude%20oil%20price",
        publishedAt
      };
    })
    .filter((item) => item.title.length > 0);
}

export async function GET() {
  try {
    const query = encodeURIComponent("crude oil price OR brent OR wti when:7d");
    const response = await fetch(
      `https://news.google.com/rss/search?q=${query}&hl=en&gl=US&ceid=US:en`,
      { next: { revalidate: 60 * 15 } }
    );

    if (!response.ok) {
      throw new Error(`Google News responded ${response.status}`);
    }

    const news = await Promise.all(
      parseGoogleNews(await response.text()).map(async (item) => ({
        ...item,
        translatedTitle: await translateTitle(item.title)
      }))
    );

    if (news.length > 0) {
      return NextResponse.json({
        source: "google-news-rss",
        mode: "live",
        updatedAt: new Date().toISOString(),
        news
      });
    }
  } catch (error) {
    console.error("Oil news lookup failed", error);
  }

  return NextResponse.json({
    source: "demo",
    mode: "fallback",
    updatedAt: new Date().toISOString(),
    news: fallbackNews
  });
}
