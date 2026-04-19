"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  fallbackAreas,
  fuelOptions,
  getFuelLabel,
  type AreaOption,
  type DomesticAverage,
  type FuelCode,
  type GlobalOil,
  type LowestStation,
  type OilNews,
  type Station
} from "@/lib/oil-data";

type ApiMode = "live" | "mixed" | "fallback" | "demo";

type StationResponse = {
  mode: ApiMode;
  source: string;
  updatedAt: string;
  radius: number;
  center: { latitude: number; longitude: number };
  stations: Station[];
};

type StationResult = StationResponse & {
  queryKey: string;
};

type BestStationSnapshot = {
  name: string;
  brand: string;
  price: number;
  distanceMeters: number;
  updatedAt?: string;
};

type AverageResponse = {
  mode: ApiMode;
  source: string;
  updatedAt: string;
  averages: DomesticAverage[];
};

type GlobalResponse = {
  mode: ApiMode;
  source: string;
  updatedAt: string;
  oils: GlobalOil[];
};

type LocationResponse = {
  mode: ApiMode;
  source: string;
  updatedAt: string;
  label: string;
  sido?: string;
  sigungu?: string;
  dong?: string;
};

type LocationResult = LocationResponse & {
  queryKey: string;
};

type AreaResponse = {
  mode: ApiMode;
  source: string;
  updatedAt: string;
  parentArea: string;
  areas: AreaOption[];
};

type AreaResult = AreaResponse & {
  queryKey: string;
};

type LowestResponse = {
  mode: ApiMode;
  source: string;
  updatedAt: string;
  fuel: FuelCode;
  area: string;
  lowest: LowestStation[];
};

type LowestResult = LowestResponse & {
  queryKey: string;
};

type NewsResponse = {
  mode: ApiMode;
  source: string;
  updatedAt: string;
  news: OilNews[];
};

type PermissionStateLabel = "unknown" | "granted" | "prompt" | "denied" | "unsupported";

type OutlookTone = "up" | "down" | "flat" | "wait";
type OutlookPressure = "strong" | "normal";

const defaultPosition = {
  latitude: 37.5665,
  longitude: 126.978
};

const radii = [1000, 3000, 5000];
const tileSize = 256;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function baseZoomForRadius(radius: number) {
  if (radius <= 1000) {
    return 15;
  }

  if (radius <= 3000) {
    return 14;
  }

  return 13;
}

function latLonToWorld(latitude: number, longitude: number, zoom: number) {
  const sinLat = Math.sin((clamp(latitude, -85.05112878, 85.05112878) * Math.PI) / 180);
  const scale = tileSize * 2 ** zoom;

  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale
  };
}

function tileUrl(x: number, y: number, zoom: number) {
  const max = 2 ** zoom;
  const wrappedX = ((x % max) + max) % max;
  const clampedY = clamp(y, 0, max - 1);

  return `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${clampedY}.png`;
}

function kakaoDirectionUrl(station: Station, fallback: { latitude: number; longitude: number }) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(station.name)},${station.latitude ?? fallback.latitude},${station.longitude ?? fallback.longitude}`;
}

function OsmMap({
  center,
  highlightedStationId,
  onHoverStation,
  onSelectStation,
  radius,
  selectedStationId,
  stations
}: {
  center: { latitude: number; longitude: number };
  highlightedStationId?: string;
  onHoverStation: (stationId?: string) => void;
  onSelectStation: (stationId: string) => void;
  radius: number;
  selectedStationId?: string;
  stations: Station[];
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 360, height: 290 });
  const [zoomOffset, setZoomOffset] = useState(0);
  const zoom = clamp(baseZoomForRadius(radius) + zoomOffset, 11, 17);
  const selectedStation = stations.find(
    (station) =>
      station.id === selectedStationId && Number.isFinite(station.latitude) && Number.isFinite(station.longitude)
  );
  const viewCenter = selectedStation
    ? {
        latitude: selectedStation.latitude ?? center.latitude,
        longitude: selectedStation.longitude ?? center.longitude
      }
    : center;
  const viewCenterWorld = latLonToWorld(viewCenter.latitude, viewCenter.longitude, zoom);
  const userWorld = latLonToWorld(center.latitude, center.longitude, zoom);
  const left = viewCenterWorld.x - size.width / 2;
  const top = viewCenterWorld.y - size.height / 2;
  const userPosition = {
    x: userWorld.x - left,
    y: userWorld.y - top
  };
  const minTileX = Math.floor(left / tileSize);
  const maxTileX = Math.floor((left + size.width) / tileSize);
  const minTileY = Math.floor(top / tileSize);
  const maxTileY = Math.floor((top + size.height) / tileSize);
  const tiles = [];
  const positionedStations = stations
    .filter((station) => Number.isFinite(station.latitude) && Number.isFinite(station.longitude))
    .map((station) => {
      const world = latLonToWorld(station.latitude ?? center.latitude, station.longitude ?? center.longitude, zoom);

      return {
        station,
        x: world.x - left,
        y: world.y - top
      };
    })
    .filter((marker) => marker.x >= -30 && marker.x <= size.width + 30 && marker.y >= -30 && marker.y <= size.height + 30);
  const focusedStationId = highlightedStationId ?? selectedStationId;
  const selectedMarker =
    positionedStations.find((marker) => marker.station.id === focusedStationId) ?? positionedStations[0];

  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      tiles.push({ x, y, left: x * tileSize - left, top: y * tileSize - top });
    }
  }

  useEffect(() => {
    const node = mapRef.current;

    if (!node) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="osm-map" ref={mapRef}>
      <div className="map-tiles" aria-hidden="true">
        {tiles.map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            draggable={false}
            key={`${tile.x}:${tile.y}:${zoom}`}
            src={tileUrl(tile.x, tile.y, zoom)}
            style={{ left: tile.left, top: tile.top }}
          />
        ))}
      </div>
      {userPosition.x >= -20 && userPosition.x <= size.width + 20 && userPosition.y >= -20 && userPosition.y <= size.height + 20 && (
        <div className="user-marker" style={{ left: userPosition.x, top: userPosition.y }} title="현재 기준 위치" />
      )}
      {positionedStations.map(({ station, x, y }) => (
        <button
          className={[
            "map-marker",
            station.id === selectedStationId ? "active" : "",
            station.id === highlightedStationId ? "highlighted" : ""
          ]
            .filter(Boolean)
            .join(" ")}
          key={station.id}
          onBlur={() => onHoverStation(undefined)}
          onClick={() => onSelectStation(station.id)}
          onFocus={() => onHoverStation(station.id)}
          onMouseEnter={() => onHoverStation(station.id)}
          onMouseLeave={() => onHoverStation(undefined)}
          style={{ left: x, top: y }}
          title={`${station.rank}. ${station.name} ${formatWon(station.price)}원/L`}
          type="button"
        >
          {station.rank}
        </button>
      ))}
      {selectedMarker && (
        <div
          className="map-popover"
          style={{
            left: clamp(selectedMarker.x, 116, size.width - 116),
            top: clamp(selectedMarker.y - 78, 12, size.height - 118)
          }}
        >
          <strong>{selectedMarker.station.name}</strong>
          <span>
            {formatWon(selectedMarker.station.price)}원/L · {formatDistance(selectedMarker.station.distanceMeters)}
          </span>
          <div className="map-popover-tags">
            <em>{selectedMarker.station.brand}</em>
            {selectedMarker.station.self && <em>SELF</em>}
            {selectedMarker.station.open24h && <em>24H</em>}
          </div>
          <a
            href={kakaoDirectionUrl(selectedMarker.station, center)}
            rel="noreferrer"
            target="_blank"
          >
            카카오맵 길찾기
          </a>
        </div>
      )}
      <div className="map-controls" aria-label="지도 확대 축소">
        <button onClick={() => setZoomOffset((value) => clamp(value + 1, -2, 3))} type="button">
          +
        </button>
        <button onClick={() => setZoomOffset((value) => clamp(value - 1, -2, 3))} type="button">
          -
        </button>
      </div>
      <a className="map-credit" href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">
        OpenStreetMap
      </a>
    </div>
  );
}

function formatWon(value: number) {
  return new Intl.NumberFormat("ko-KR").format(Math.round(value));
}

function formatDistance(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}km`;
  }

  return `${Math.max(value, 0)}m`;
}

function distanceBetween(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const earthRadius = 6371000;
  const fromLat = (from.latitude * Math.PI) / 180;
  const toLat = (to.latitude * Math.PI) / 180;
  const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatTime(value?: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatAxisDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function fallbackChartLabels(length: number) {
  const today = new Date();

  return Array.from({ length }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (length - 1 - index));

    return formatAxisDate(date);
  });
}

function chartSeries(item: GlobalOil, period: "week" | "month") {
  const values = item.history?.[period]?.filter((value) => Number.isFinite(value)) ?? [];

  if (values.length >= 2) {
    return {
      labels: item.historyLabels?.[period]?.length === values.length ? item.historyLabels[period] : fallbackChartLabels(values.length),
      values
    };
  }

  const fallbackValues = [item.price - item.diff, item.price].filter((value) => Number.isFinite(value));

  return {
    labels: fallbackChartLabels(fallbackValues.length),
    values: fallbackValues
  };
}

function MiniOilChart({ label, series }: { label: string; series: { labels: string[]; values: number[] } }) {
  const { labels, values } = series;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const left = 42;
  const right = 202;
  const top = 10;
  const bottom = 62;
  const middle = min + range / 2;
  const yTicks = [
    { label: max.toFixed(1), value: max },
    { label: middle.toFixed(1), value: middle },
    { label: min.toFixed(1), value: min }
  ];
  const xIndexes =
    label === "주간" && values.length <= 7
      ? values.map((_, index) => index)
      : Array.from(new Set([0, Math.floor((values.length - 1) / 2), values.length - 1]));
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? (left + right) / 2 : left + (index / (values.length - 1)) * (right - left);
      const y = bottom - ((value - min) / range) * (bottom - top);

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const first = values[0] ?? 0;
  const last = values.at(-1) ?? first;
  const change = last - first;
  const tone = last >= first ? "up" : "down";
  const areaPoints = `${left},${bottom} ${points} ${right},${bottom}`;

  return (
    <div className={`mini-oil-chart ${tone}`} aria-label={`${label} 유가 그래프`}>
      <div className="mini-chart-head">
        <span>{label}</span>
        <strong>
          {change > 0 ? "+" : ""}
          {change.toFixed(2)}
        </strong>
      </div>
      <svg aria-hidden="true" focusable="false" viewBox="0 0 210 96">
        {yTicks.map((tick) => {
          const y = bottom - ((tick.value - min) / range) * (bottom - top);

          return (
            <g key={`${label}-y-${tick.label}`}>
              <text className="chart-y-label" x="0" y={y + 3}>
                {tick.label}
              </text>
              <line className="chart-grid" x1={left} x2={right} y1={y} y2={y} />
            </g>
          );
        })}
        <line className="chart-axis" x1={left} x2={right} y1={bottom} y2={bottom} />
        <line className="chart-axis" x1={left} x2={left} y1={top} y2={bottom} />
        <polygon points={areaPoints} />
        <polyline points={points} />
        {xIndexes.map((index) => {
          const x = values.length === 1 ? (left + right) / 2 : left + (index / (values.length - 1)) * (right - left);

          return (
            <g key={`${label}-x-${index}`}>
              <line className="chart-x-tick" x1={x} x2={x} y1={bottom} y2={bottom + 4} />
              <text className="chart-x-label" x={x} y={label === "주간" ? 78 : 80}>
                {labels[index]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function modeLabel(mode?: ApiMode) {
  if (mode === "live") {
    return "LIVE";
  }

  if (mode === "mixed") {
    return "MIXED";
  }

  if (mode === "fallback") {
    return "FALLBACK";
  }

  return "DEMO";
}

function modeTone(mode?: ApiMode) {
  if (mode === "live" || mode === "mixed") {
    return "good";
  }

  if (mode === "fallback") {
    return "warn";
  }

  return "demo";
}

function permissionLabel(value: PermissionStateLabel) {
  if (value === "granted") {
    return "권한 허용";
  }

  if (value === "prompt") {
    return "권한 대기";
  }

  if (value === "denied") {
    return "권한 거부";
  }

  if (value === "unsupported") {
    return "권한 확인 불가";
  }

  return "권한 확인 중";
}

function locationLabelFromAddress(address?: string) {
  if (!address) {
    return "위치 확인 중";
  }

  const parts = address.split(/\s+/).filter(Boolean);
  const dongIndex = parts.findIndex((part) => /(?:동|읍|면|가|리)$/.test(part));
  const endIndex = dongIndex >= 0 ? dongIndex + 1 : Math.min(parts.length, 3);

  return parts.slice(0, endIndex).join(" ");
}

function oilOutlook(oils?: GlobalOil[]): {
  detail: string;
  label: string;
  pressure: OutlookPressure;
  summary: string;
  tone: OutlookTone;
} {
  if (!oils?.length) {
    return {
      detail: "시장 데이터 확인 중",
      label: "전망 대기",
      pressure: "normal",
      summary: "실시간 유가를 불러오면 전망을 갱신합니다.",
      tone: "wait"
    };
  }

  const watched = oils.filter((item) => item.code === "WTI" || item.code === "BRENT");
  const base = watched.length > 0 ? watched : oils;
  const averageDiff = base.reduce((sum, item) => sum + item.diff, 0) / base.length;
  const averageTrend = base.reduce((sum, item) => sum + (item.trend ?? item.diff), 0) / base.length;
  const score = averageTrend * 0.65 + averageDiff * 0.35;
  const sign = score > 0 ? "+" : "";
  const detail = `5일 ${sign}${score.toFixed(2)} / 전일 ${averageDiff > 0 ? "+" : ""}${averageDiff.toFixed(2)}`;

  if (score >= 1.2) {
    return {
      detail,
      label: "상승 압력",
      pressure: "strong",
      summary: "최근 흐름이 강하게 올라 국내 가격에도 부담이 커질 수 있습니다.",
      tone: "up"
    };
  }

  if (score >= 0.25) {
    return {
      detail,
      label: "상승 우세",
      pressure: "normal",
      summary: "단기 흐름은 소폭 상승 쪽이지만 변동성은 남아 있습니다.",
      tone: "up"
    };
  }

  if (score <= -1.2) {
    return {
      detail,
      label: "하락 압력",
      pressure: "strong",
      summary: "최근 흐름이 뚜렷하게 내려 단기 유가 하락 가능성이 커졌습니다.",
      tone: "down"
    };
  }

  if (score <= -0.25) {
    return {
      detail,
      label: "하락 우세",
      pressure: "normal",
      summary: "단기 흐름은 하락 쪽으로 기울었지만 큰 폭은 아닙니다.",
      tone: "down"
    };
  }

  return {
    detail,
    label: "보합권",
    pressure: "normal",
    summary: "상승과 하락 신호가 엇갈려 당장은 큰 방향성이 약합니다.",
    tone: "flat"
  };
}

export default function OilDashboard() {
  const [fuel, setFuel] = useState<FuelCode>("B027");
  const [radius, setRadius] = useState(3000);
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [position, setPosition] = useState(defaultPosition);
  const [previousPosition, setPreviousPosition] = useState(defaultPosition);
  const positionRef = useRef(defaultPosition);
  const [locationState, setLocationState] = useState<"loading" | "ready" | "blocked">("loading");
  const [permissionState, setPermissionState] = useState<PermissionStateLabel>("unknown");
  const [stationData, setStationData] = useState<StationResult | null>(null);
  const [averageData, setAverageData] = useState<AverageResponse | null>(null);
  const [globalData, setGlobalData] = useState<GlobalResponse | null>(null);
  const [locationData, setLocationData] = useState<LocationResult | null>(null);
  const [areaData, setAreaData] = useState<AreaResponse | null>(null);
  const [districtData, setDistrictData] = useState<AreaResult | null>(null);
  const [lowestData, setLowestData] = useState<LowestResult | null>(null);
  const [newsData, setNewsData] = useState<NewsResponse | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string>();
  const [hoveredStationId, setHoveredStationId] = useState<string>();
  const [previousBestStation, setPreviousBestStation] = useState<BestStationSnapshot | null>(null);
  const [stationRefreshSeq, setStationRefreshSeq] = useState(0);
  const stationQueryKey = `${position.latitude.toFixed(5)}:${position.longitude.toFixed(5)}:${fuel}:${radius}:${stationRefreshSeq}`;
  const locationQueryKey = `${position.latitude.toFixed(5)}:${position.longitude.toFixed(5)}:${stationRefreshSeq}`;
  const movedMeters = distanceBetween(previousPosition, position);
  const lowestArea = selectedDistrict || selectedArea;
  const lowestQueryKey = `${fuel}:${lowestArea}`;
  const areas = areaData?.areas ?? fallbackAreas;
  const districtAreas = districtData?.queryKey === selectedArea ? districtData.areas : [];
  const selectedAreaName =
    districtAreas.find((area) => area.code === selectedDistrict)?.name ??
    areas.find((area) => area.code === selectedArea)?.name ??
    "전국";

  const applyPosition = useCallback((nextPosition: { latitude: number; longitude: number }) => {
    setPreviousPosition(positionRef.current);
    positionRef.current = nextPosition;
    setPosition(nextPosition);
    setStationRefreshSeq((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!("permissions" in navigator)) {
      const timeout = window.setTimeout(() => setPermissionState("unsupported"), 0);
      return () => window.clearTimeout(timeout);
    }

    let active = true;
    let status: PermissionStatus | undefined;

    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (!active) {
          return;
        }

        status = result;
        setPermissionState(result.state);
        result.onchange = () => setPermissionState(result.state);
      })
      .catch(() => {
        if (active) {
          setPermissionState("unsupported");
        }
      });

    return () => {
      active = false;

      if (status) {
        status.onchange = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      const timeout = window.setTimeout(() => setLocationState("blocked"), 0);
      return () => window.clearTimeout(timeout);
    }

    navigator.geolocation.getCurrentPosition(
      (result) => {
        applyPosition(
          {
            latitude: result.coords.latitude,
            longitude: result.coords.longitude
          }
        );
        setLocationState("ready");
      },
      () => {
        setPermissionState("denied");
        setLocationState("blocked");
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 1000 * 60 * 10
      }
    );
  }, [applyPosition]);

  useEffect(() => {
    const controller = new AbortController();

    const params = new URLSearchParams({
      lat: String(position.latitude),
      lon: String(position.longitude),
      fuel,
      radius: String(radius),
      refresh: String(stationRefreshSeq)
    });

    fetch(`/api/oil/stations?${params}`, { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((data: StationResponse) => {
        setStationData({ ...data, queryKey: stationQueryKey });
        setSelectedStationId(data.stations[0]?.id);
        setHoveredStationId(undefined);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          console.error(error);
        }
      });

    return () => controller.abort();
  }, [fuel, position, radius, stationQueryKey, stationRefreshSeq]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      lat: String(position.latitude),
      lon: String(position.longitude),
      refresh: String(stationRefreshSeq)
    });

    fetch(`/api/oil/location?${params}`, { cache: "no-store", signal: controller.signal })
      .then((response) => response.json())
      .then((data: LocationResponse) => setLocationData({ ...data, queryKey: locationQueryKey }))
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          console.error(error);
        }
      });

    return () => controller.abort();
  }, [locationQueryKey, position, stationRefreshSeq]);

  useEffect(() => {
    let active = true;

    Promise.all([
      fetch("/api/oil/averages").then((response) => response.json()),
      fetch("/api/oil/global").then((response) => response.json()),
      fetch("/api/oil/news").then((response) => response.json())
    ])
      .then(([averages, globalOil, news]: [AverageResponse, GlobalResponse, NewsResponse]) => {
        if (!active) {
          return;
        }

        setAverageData(averages);
        setGlobalData(globalOil);
        setNewsData(news);
      })
      .catch((error) => console.error(error));

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/oil/areas", { signal: controller.signal })
      .then((response) => response.json())
      .then((data: AreaResponse) => setAreaData(data))
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          console.error(error);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedArea) {
      return;
    }

    const controller = new AbortController();
        const params = new URLSearchParams({ area: selectedArea });

    fetch(`/api/oil/areas?${params}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: AreaResponse) => setDistrictData({ ...data, queryKey: selectedArea }))
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          console.error(error);
        }
      });

    return () => controller.abort();
  }, [selectedArea]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ fuel, cnt: "10" });

    if (lowestArea) {
      params.set("area", lowestArea);
    }

    fetch(`/api/oil/lowest?${params}`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data: LowestResponse) => setLowestData({ ...data, queryKey: lowestQueryKey }))
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          console.error(error);
        }
      });

    return () => controller.abort();
  }, [fuel, lowestArea, lowestQueryKey]);

  const bestStation = stationData?.stations[0];
  const selectedStation =
    stationData?.stations.find((station) => station.id === selectedStationId) ?? stationData?.stations[0];
  const compareBaseStation =
    previousBestStation ??
    (bestStation
      ? {
          name: bestStation.name,
          brand: bestStation.brand,
          price: bestStation.price,
          distanceMeters: bestStation.distanceMeters,
          updatedAt: stationData?.updatedAt
        }
      : null);
  const loadingLowest = lowestData?.queryKey !== lowestQueryKey;
  const regionalBestStation = !loadingLowest ? lowestData?.lowest[0] : undefined;
  const averageForFuel = averageData?.averages.find((item) => item.code === fuel);
  const loadingStations = stationData?.queryKey !== stationQueryKey;
  const currentLocationLabel =
    locationData?.queryKey === locationQueryKey
      ? locationData.label
      : locationLabelFromAddress(bestStation?.address);
  const globalOutlook = useMemo(() => oilOutlook(globalData?.oils), [globalData?.oils]);
  const savings = useMemo(() => {
    if (!bestStation || !averageForFuel) {
      return 0;
    }

    return Math.max(averageForFuel.price - bestStation.price, 0);
  }, [averageForFuel, bestStation]);

  function refreshLocation() {
    if (!("geolocation" in navigator)) {
      setLocationState("blocked");
      setStationRefreshSeq((value) => value + 1);
      return;
    }

    if (bestStation) {
      setPreviousBestStation({
        name: bestStation.name,
        brand: bestStation.brand,
        price: bestStation.price,
        distanceMeters: bestStation.distanceMeters,
        updatedAt: stationData?.updatedAt
      });
    }

    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        applyPosition(
          {
            latitude: result.coords.latitude,
            longitude: result.coords.longitude
          }
        );
        setLocationState("ready");
      },
      () => {
        setStationRefreshSeq((value) => value + 1);
        setPermissionState("denied");
        setLocationState("blocked");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }

  function changeArea(value: string) {
    setSelectedArea(value);
    setSelectedDistrict("");
  }

  function handleStationKeyDown(event: KeyboardEvent<HTMLElement>, stationId: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedStationId(stationId);
    }
  }

  return (
    <main className="oil-app">
      <section className="hero-band">
        <div className="hero-copy">
          <div className="topline">
            <span className="stamp">OPINET REMIX</span>
            <span className={`data-pill ${modeTone(stationData?.mode)}`}>
              {modeLabel(stationData?.mode)} DATA
            </span>
          </div>
          <h1>OIL/RUSH</h1>
          <p className="hero-subtitle">가장 가까운 싼 주유소 5개, 전국 최저가, 세계 유가 신호를 한 화면에.</p>
          <div className="hero-metrics" aria-label="주요 지표">
            <div>
              <strong>{bestStation ? `${formatWon(bestStation.price)}원` : "---"}</strong>
              <span>{getFuelLabel(fuel)} 최저가</span>
            </div>
            <div>
              <strong>{bestStation ? formatDistance(bestStation.distanceMeters) : "---"}</strong>
              <span>가장 싼 곳까지</span>
            </div>
            <div>
              <strong>{savings ? `${formatWon(savings)}원/L` : "---"}</strong>
              <span>전국 평균 대비</span>
            </div>
            <div>
              <strong>{regionalBestStation ? `${formatWon(regionalBestStation.price)}원` : "---"}</strong>
              <span>{selectedAreaName} 최저가 TOP</span>
            </div>
          </div>
        </div>
        <div className="photo-slab" aria-hidden="true">
          <Image
            src="https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1100&q=80"
            alt=""
            fill
            priority
            sizes="(max-width: 980px) 100vw, 46vw"
          />
          <div className="pump-card">
            <span>10</span>
            <strong>LOWEST</strong>
          </div>
        </div>
      </section>

      <section className="control-strip" aria-label="유종 및 위치 컨트롤">
        <div className="segmented" role="tablist" aria-label="유종 선택">
          {fuelOptions.map((option) => (
            <button
              aria-selected={fuel === option.code}
              className={fuel === option.code ? "active" : ""}
              key={option.code}
              onClick={() => setFuel(option.code)}
              role="tab"
              type="button"
            >
              {option.shortLabel}
            </button>
          ))}
        </div>

        <div className="radius-control">
          {radii.map((item) => (
            <button
              className={radius === item ? "active" : ""}
              key={item}
              onClick={() => setRadius(item)}
              type="button"
            >
              {item / 1000}km
            </button>
          ))}
        </div>

        <label className="area-select">
          <span>시도</span>
          <select
            aria-label="최저가 시도 선택"
            onChange={(event) => changeArea(event.target.value)}
            value={selectedArea}
          >
            {areas.map((area) => (
              <option key={area.code || "national"} value={area.code}>
                {area.name}
              </option>
            ))}
          </select>
        </label>

        <label className="area-select district-select">
          <span>시군구</span>
          <select
            aria-label="최저가 시군구 선택"
            disabled={!selectedArea || districtAreas.length === 0}
            onChange={(event) => setSelectedDistrict(event.target.value)}
            value={selectedDistrict}
          >
            <option value="">전체</option>
            {districtAreas.map((area) => (
              <option key={area.code} value={area.code}>
                {area.name}
              </option>
            ))}
          </select>
        </label>

        <button className="locate-button" onClick={refreshLocation} type="button">
          <span className="locate-icon" aria-hidden="true" />
          {locationState === "loading" ? "갱신 중" : locationState === "ready" ? "위치 갱신" : "위치 확인"}
        </button>
        <span className="location-place">{currentLocationLabel}</span>

      </section>

      <section className="dashboard-grid">
        <div className="price-panels">
          <div className="price-column">
            <div className="rank-panel panel">
              <div className="panel-heading">
                <div>
                  <span className="label">NEARBY TOP 5</span>
                  <h2>주변 최저가 순위</h2>
                </div>
                <span className="updated">{formatTime(stationData?.updatedAt)}</span>
              </div>

              <div className="station-list">
                {loadingStations &&
                  Array.from({ length: 5 }, (_, index) => <div className="station-row skeleton" key={index} />)}

                {!loadingStations &&
                  stationData?.stations.length === 0 && (
                    <div className="station-empty">
                      <strong>반경 {radius / 1000}km 안에 표시할 주유소가 없습니다.</strong>
                      <span>반경을 3km 또는 5km로 넓히면 주변 최저가를 다시 조회합니다.</span>
                    </div>
                  )}

                {!loadingStations &&
                  stationData?.stations.map((station) => (
                    <article
                      className={[
                        "station-row",
                        station.id === selectedStationId ? "active" : "",
                        station.id === hoveredStationId ? "highlighted" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={station.id}
                      onBlur={() => setHoveredStationId(undefined)}
                      onClick={() => setSelectedStationId(station.id)}
                      onFocus={() => setHoveredStationId(station.id)}
                      onKeyDown={(event) => handleStationKeyDown(event, station.id)}
                      onMouseEnter={() => setHoveredStationId(station.id)}
                      onMouseLeave={() => setHoveredStationId(undefined)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="rank">{station.rank}</div>
                      <div className="station-main">
                        <div className="station-title">
                          <strong>{station.name}</strong>
                          <span>{station.brand}</span>
                        </div>
                        <p>{station.address}</p>
                        <div className="station-tags">
                          <span>{formatDistance(station.distanceMeters)}</span>
                          {station.self && <span>SELF</span>}
                          {station.open24h && <span>24H</span>}
                        </div>
                      </div>
                      <div className="station-price">
                        <strong>{formatWon(station.price)}</strong>
                        <span>원/L</span>
                      </div>
                    </article>
                  ))}
              </div>
            </div>

            <div className="averages-panel panel">
              <div className="panel-heading">
                <div>
                  <span className="label">KOREA AVG</span>
                  <h2>국내 평균</h2>
                </div>
                <span className={`data-pill ${modeTone(averageData?.mode)}`}>
                  {modeLabel(averageData?.mode)}
                </span>
              </div>
              <div className="average-grid">
                {averageData?.averages.map((item) => (
                  <div className={item.code === fuel ? "average-card active" : "average-card"} key={item.code}>
                    <span>{item.label}</span>
                    <strong>{formatWon(item.price)}</strong>
                    <em className={item.diff > 0 ? "up" : "down"}>
                      {item.diff > 0 ? "+" : ""}
                      {item.diff.toFixed(2)}
                    </em>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lowest-panel panel">
            <div className="panel-heading">
              <div>
                <span className="label">OPINET TOP 10</span>
                <h2>{selectedAreaName} 최저가</h2>
              </div>
              <span className={`data-pill ${modeTone(lowestData?.mode)}`}>
                {modeLabel(lowestData?.mode)}
              </span>
            </div>
            <div className="lowest-list">
              {loadingLowest &&
                Array.from({ length: 4 }, (_, index) => <div className="lowest-row skeleton" key={index} />)}

              {!loadingLowest &&
                lowestData?.lowest.map((station) => (
                  <article className="lowest-row" key={station.id}>
                    <div className="rank">{station.rank}</div>
                    <div>
                      <strong>{station.name}</strong>
                      <span>{station.brand}</span>
                      <p>{station.address}</p>
                    </div>
                    <div className="station-price">
                      <strong>{formatWon(station.price)}</strong>
                      <span>원/L</span>
                    </div>
                  </article>
                ))}
            </div>
          </div>

          <div className="map-panel panel">
            <div className="panel-heading">
              <div>
                <span className="label">LIVE MAP</span>
                <h2>주변 지도</h2>
              </div>
              <span className={`location-chip ${locationState}`}>{locationState.toUpperCase()}</span>
            </div>
            <OsmMap
              center={position}
              highlightedStationId={hoveredStationId}
              onHoverStation={setHoveredStationId}
              onSelectStation={setSelectedStationId}
              radius={radius}
              selectedStationId={selectedStationId}
              stations={stationData?.stations ?? []}
            />
            <div className="coord-row">
              <span>{position.latitude.toFixed(4)}</span>
              <span>{position.longitude.toFixed(4)}</span>
              <span>{stationData ? formatTime(stationData.updatedAt) : "--:--"}</span>
            </div>
            <div className="location-diagnostics">
              <span>현재 {currentLocationLabel}</span>
              <span className={`permission-state ${permissionState}`}>{permissionLabel(permissionState)}</span>
              <span>이동 {formatDistance(Math.round(movedMeters))}</span>
              <span>{loadingStations ? "주변 순위 갱신 중" : "주변 순위 반영 완료"}</span>
            </div>
            <div className="best-compare" aria-label="주변 최저가 비교">
              <div>
                <span>주변 최저가</span>
                <strong>{compareBaseStation ? `${formatWon(compareBaseStation.price)}원` : "---"}</strong>
                <em>{compareBaseStation ? compareBaseStation.name : "조회 전"}</em>
              </div>
              <div>
                <span>위치 갱신 최저가</span>
                <strong>{bestStation ? `${formatWon(bestStation.price)}원` : "---"}</strong>
                <em>{bestStation ? bestStation.name : "결과 없음"}</em>
              </div>
            </div>
            {selectedStation && (
              <div className="map-detail">
                <div className="map-detail-main">
                  <span className="label">SELECTED</span>
                  <strong>{selectedStation.name}</strong>
                  <p>{selectedStation.address}</p>
                  <div className="station-tags">
                    <span>{selectedStation.brand}</span>
                    <span>{formatDistance(selectedStation.distanceMeters)}</span>
                    {selectedStation.self && <span>SELF</span>}
                    {selectedStation.open24h && <span>24H</span>}
                  </div>
                </div>
                <div className="map-detail-side">
                  <strong>{formatWon(selectedStation.price)}</strong>
                  <span>원/L</span>
                  <a href={kakaoDirectionUrl(selectedStation, position)} rel="noreferrer" target="_blank">
                    길찾기
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="global-panel panel">
          <div className="panel-heading">
            <div>
              <span className="label">GLOBAL CRUDE</span>
              <div className="global-title-row">
                <h2>국제 유가</h2>
                <span className={`outlook-pill ${globalOutlook.tone} ${globalOutlook.pressure}`}>
                  {globalOutlook.label}
                </span>
              </div>
              <strong className={`global-outlook-summary ${globalOutlook.tone} ${globalOutlook.pressure}`}>
                {globalOutlook.summary}
              </strong>
              <span className="global-outlook-detail">{globalOutlook.detail}</span>
            </div>
            <span className={`data-pill ${modeTone(globalData?.mode)}`}>
              {modeLabel(globalData?.mode)}
            </span>
          </div>
          <div className="global-list">
            {globalData?.oils.map((item) => (
              <article className="global-row" key={item.code}>
                <div>
                  <strong>{item.code}</strong>
                  <span>{item.region}</span>
                </div>
                <div className="global-price">
                  <strong>{item.price.toFixed(2)}</strong>
                  <span>{item.unit}</span>
                </div>
                <em className={item.diff > 0 ? "up" : "down"}>
                  {item.diff > 0 ? "+" : ""}
                  {item.diff.toFixed(2)}
                </em>
                <div className="global-charts">
                  <MiniOilChart label="주간" series={chartSeries(item, "week")} />
                  <MiniOilChart label="월간" series={chartSeries(item, "month")} />
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="news-panel panel">
          <div className="panel-heading">
            <div>
              <span className="label">WORLD OIL NEWS</span>
              <h2>세계 뉴스</h2>
            </div>
            <span className={`data-pill ${modeTone(newsData?.mode)}`}>{modeLabel(newsData?.mode)}</span>
          </div>
          <div className="news-list">
            {newsData?.news.slice(0, 5).map((item) => (
              <a href={item.url} key={item.id} rel="noreferrer" target="_blank">
                <strong>{item.title}</strong>
                {item.translatedTitle && <em>{item.translatedTitle}</em>}
                <span>
                  {item.source} / {formatTime(item.publishedAt)}
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
