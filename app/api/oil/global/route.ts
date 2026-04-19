import { NextResponse } from "next/server";
import { fallbackGlobalOil, type GlobalOil } from "@/lib/oil-data";

export const runtime = "nodejs";

type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
};

const yahooSymbols = [
  {
    symbol: "CL=F",
    code: "WTI",
    name: "West Texas Intermediate",
    region: "미국 NYMEX"
  },
  {
    symbol: "BZ=F",
    code: "BRENT",
    name: "Brent Crude",
    region: "북해 ICE"
  }
];

function formatChartDate(timestampSeconds?: number) {
  if (!timestampSeconds) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(timestampSeconds * 1000));
}

async function fetchYahooOil(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=1mo&interval=1d`;
  const response = await fetch(url, { next: { revalidate: 60 * 20 } });

  if (!response.ok) {
    throw new Error(`Yahoo responded ${response.status}`);
  }

  const data = (await response.json()) as YahooChart;
  const result = data.chart?.result?.[0];
  const meta = result?.meta;

  if (!meta?.regularMarketPrice) {
    throw new Error(`Yahoo price unavailable for ${symbol}`);
  }

  const previous = meta.chartPreviousClose ?? meta.regularMarketPrice;
  const rawCloses = result?.indicators?.quote?.[0]?.close ?? [];
  const timestamps = result?.timestamp ?? [];
  const history = rawCloses
    .map((close, index) => ({
      date: formatChartDate(timestamps[index]),
      price: close
    }))
    .filter((point): point is { date: string; price: number } => typeof point.price === "number");
  const closes = history.map((point) => point.price);
  const labels = history.map((point) => point.date);
  const trendBase = closes[0] ?? previous;
  const week = history.slice(-7);

  return {
    price: meta.regularMarketPrice,
    diff: meta.regularMarketPrice - previous,
    trend: meta.regularMarketPrice - trendBase,
    history: {
      week: week.map((point) => point.price),
      month: closes
    },
    historyLabels: {
      week: week.map((point) => point.date),
      month: labels
    }
  };
}

export async function GET() {
  try {
    const liveItems = await Promise.all(
      yahooSymbols.map(async (item) => {
        const quote = await fetchYahooOil(item.symbol);

        return {
          code: item.code,
          name: item.name,
          region: item.region,
          price: Number(quote.price.toFixed(2)),
          diff: Number(quote.diff.toFixed(2)),
          trend: Number(quote.trend.toFixed(2)),
          history: {
            week: quote.history.week.map((value) => Number(value.toFixed(2))),
            month: quote.history.month.map((value) => Number(value.toFixed(2)))
          },
          historyLabels: quote.historyLabels,
          unit: "USD/bbl",
          live: true
        } satisfies GlobalOil;
      })
    );

    const merged = fallbackGlobalOil.map((item) => {
      const live = liveItems.find((quote) => quote.code === item.code);
      return live ?? item;
    });

    return NextResponse.json({
      source: "market-feed",
      mode: liveItems.length > 0 ? "mixed" : "demo",
      updatedAt: new Date().toISOString(),
      oils: merged
    });
  } catch (error) {
    console.error("Global oil lookup failed", error);

    return NextResponse.json({
      source: "demo",
      mode: "fallback",
      updatedAt: new Date().toISOString(),
      oils: fallbackGlobalOil
    });
  }
}
