export type FuelCode = "B027" | "D047" | "B034" | "C004" | "K015";

export type FuelOption = {
  code: FuelCode;
  label: string;
  shortLabel: string;
};

export type AreaOption = {
  code: string;
  name: string;
};

export type Station = {
  id: string;
  rank: number;
  name: string;
  brand: string;
  address: string;
  price: number;
  distanceMeters: number;
  latitude?: number;
  longitude?: number;
  fuel: FuelCode;
  self: boolean;
  open24h: boolean;
  delta: number;
};

export type DomesticAverage = {
  code: FuelCode;
  label: string;
  price: number;
  diff: number;
};

export type LowestStation = {
  id: string;
  rank: number;
  name: string;
  brand: string;
  address: string;
  price: number;
  fuel: FuelCode;
};

export type GlobalOil = {
  code: string;
  name: string;
  region: string;
  price: number;
  diff: number;
  trend?: number;
  history?: {
    week: number[];
    month: number[];
  };
  historyLabels?: {
    week: string[];
    month: string[];
  };
  unit: string;
  live: boolean;
};

export type OilNews = {
  id: string;
  title: string;
  translatedTitle?: string;
  source: string;
  url: string;
  publishedAt: string;
};

export const fuelOptions: FuelOption[] = [
  { code: "B027", label: "휘발유", shortLabel: "휘발유" },
  { code: "D047", label: "자동차용 경유", shortLabel: "경유" },
  { code: "B034", label: "고급 휘발유", shortLabel: "고급" },
  { code: "C004", label: "실내 등유", shortLabel: "등유" },
  { code: "K015", label: "자동차용 부탄", shortLabel: "LPG" }
];

export const brandLabels: Record<string, string> = {
  SKE: "SK",
  GSC: "GS",
  HDO: "HD",
  SOL: "S-OIL",
  RTE: "알뜰",
  RTX: "도로알뜰",
  NHO: "농협",
  ETC: "자가",
  E1G: "E1",
  SKG: "SK Gas"
};

export const fallbackAreas: AreaOption[] = [
  { code: "", name: "전국" },
  { code: "01", name: "서울" },
  { code: "02", name: "경기" },
  { code: "03", name: "강원" },
  { code: "04", name: "충북" },
  { code: "05", name: "충남" },
  { code: "06", name: "전북" },
  { code: "07", name: "전남" },
  { code: "08", name: "경북" },
  { code: "09", name: "경남" },
  { code: "10", name: "부산" },
  { code: "11", name: "제주" },
  { code: "14", name: "대구" },
  { code: "15", name: "인천" },
  { code: "16", name: "광주" },
  { code: "17", name: "대전" },
  { code: "18", name: "울산" },
  { code: "19", name: "세종" }
];

const demoBase = [
  {
    id: "demo-01",
    name: "시청앞 에너지 스테이션",
    brand: "알뜰",
    address: "서울 중구 세종대로 110",
    lat: 37.5661,
    lon: 126.9786,
    self: true,
    open24h: true,
    seed: 0
  },
  {
    id: "demo-02",
    name: "을지로 스마트 주유소",
    brand: "GS",
    address: "서울 중구 을지로 88",
    lat: 37.5658,
    lon: 126.985,
    self: true,
    open24h: false,
    seed: 14
  },
  {
    id: "demo-03",
    name: "광화문 모빌리티 허브",
    brand: "S-OIL",
    address: "서울 종로구 새문안로 76",
    lat: 37.5704,
    lon: 126.9768,
    self: false,
    open24h: true,
    seed: 22
  },
  {
    id: "demo-04",
    name: "남산 빠른 주유소",
    brand: "HD",
    address: "서울 용산구 소월로 40",
    lat: 37.5549,
    lon: 126.9824,
    self: true,
    open24h: false,
    seed: 31
  },
  {
    id: "demo-05",
    name: "서대문 로컬오일",
    brand: "SK",
    address: "서울 서대문구 통일로 130",
    lat: 37.5687,
    lon: 126.9665,
    self: false,
    open24h: true,
    seed: 43
  },
  {
    id: "demo-06",
    name: "동대문 이코노미 주유소",
    brand: "농협",
    address: "서울 종로구 종로 260",
    lat: 37.5712,
    lon: 127.0089,
    self: true,
    open24h: true,
    seed: 58
  }
];

const fuelBasePrice: Record<FuelCode, number> = {
  B027: 1668,
  D047: 1539,
  B034: 1915,
  C004: 1308,
  K015: 1049
};

const demoLowestBase = [
  {
    id: "lowest-01",
    name: "충주 알뜰에너지",
    brand: "알뜰",
    address: "충북 충주시 중원대로 3506",
    seed: -112
  },
  {
    id: "lowest-02",
    name: "논산 스마트오일",
    brand: "GS",
    address: "충남 논산시 계백로 822",
    seed: -96
  },
  {
    id: "lowest-03",
    name: "김제 로컬주유소",
    brand: "HD",
    address: "전북 김제시 벽성로 214",
    seed: -88
  },
  {
    id: "lowest-04",
    name: "구미 오일드림",
    brand: "S-OIL",
    address: "경북 구미시 구미중앙로25길 38",
    seed: -83
  },
  {
    id: "lowest-05",
    name: "원주 착한주유소",
    brand: "SK",
    address: "강원 원주시 북원로 2412",
    seed: -75
  },
  {
    id: "lowest-06",
    name: "나주 세이브오일",
    brand: "농협",
    address: "전남 나주시 영산로 5331",
    seed: -66
  },
  {
    id: "lowest-07",
    name: "여주 빠른주유소",
    brand: "HD",
    address: "경기 여주시 세종로 378",
    seed: -58
  },
  {
    id: "lowest-08",
    name: "진주 국민주유소",
    brand: "알뜰",
    address: "경남 진주시 대신로 298",
    seed: -49
  },
  {
    id: "lowest-09",
    name: "제천 드라이브오일",
    brand: "GS",
    address: "충북 제천시 의림대로 612",
    seed: -41
  },
  {
    id: "lowest-10",
    name: "상주 에코스테이션",
    brand: "S-OIL",
    address: "경북 상주시 경상대로 3012",
    seed: -35
  }
];

export const fallbackGlobalOil: GlobalOil[] = [
  {
    code: "WTI",
    name: "West Texas Intermediate",
    region: "미국 NYMEX",
    price: 82.4,
    diff: -0.7,
    trend: -1.2,
    history: {
      week: [83.6, 83.1, 82.9, 82.7, 82.1, 82.6, 82.4],
      month: [85.2, 84.9, 85.4, 84.7, 84.2, 83.9, 84.1, 83.6, 83.2, 82.9, 83.4, 83.0, 82.6, 82.4]
    },
    unit: "USD/bbl",
    live: false
  },
  {
    code: "BRENT",
    name: "Brent Crude",
    region: "북해 ICE",
    price: 86.2,
    diff: 0.4,
    trend: 0.8,
    history: {
      week: [85.4, 85.7, 85.9, 86.1, 85.8, 86.0, 86.2],
      month: [84.9, 85.3, 85.1, 85.6, 85.9, 86.0, 85.7, 85.8, 86.1, 86.4, 86.0, 86.3, 86.1, 86.2]
    },
    unit: "USD/bbl",
    live: false
  },
  {
    code: "DUBAI",
    name: "Dubai Crude",
    region: "중동 현물",
    price: 84.8,
    diff: 0.2,
    trend: 0.5,
    history: {
      week: [84.3, 84.5, 84.4, 84.6, 84.7, 84.6, 84.8],
      month: [84.1, 84.0, 84.3, 84.2, 84.5, 84.6, 84.4, 84.7, 84.8, 84.6, 84.9, 84.7, 84.6, 84.8]
    },
    unit: "USD/bbl",
    live: false
  },
  {
    code: "OPEC",
    name: "OPEC Basket",
    region: "산유국 바스켓",
    price: 85.1,
    diff: -0.1,
    trend: -0.3,
    history: {
      week: [85.4, 85.3, 85.2, 85.0, 85.2, 85.1, 85.1],
      month: [85.9, 85.7, 85.8, 85.6, 85.5, 85.4, 85.2, 85.3, 85.1, 85.0, 85.2, 85.1, 85.0, 85.1]
    },
    unit: "USD/bbl",
    live: false
  }
];

export const fallbackNews: OilNews[] = [
  {
    id: "demo-news-1",
    title: "산유국 감산 논의와 달러 흐름이 유가 변동성을 키우는 중",
    source: "Market Wire",
    url: "https://news.google.com/search?q=crude%20oil%20price",
    publishedAt: new Date().toISOString()
  },
  {
    id: "demo-news-2",
    title: "해상 운임과 정제 마진 변화가 아시아 휘발유 가격에 영향",
    source: "Energy Brief",
    url: "https://news.google.com/search?q=oil%20refining%20margin",
    publishedAt: new Date(Date.now() - 3600 * 1000 * 6).toISOString()
  },
  {
    id: "demo-news-3",
    title: "중국 수요 전망과 재고 지표가 브렌트 가격 방향을 좌우",
    source: "Global Desk",
    url: "https://news.google.com/search?q=brent%20crude%20demand",
    publishedAt: new Date(Date.now() - 3600 * 1000 * 12).toISOString()
  }
];

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);

  return Math.round(r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function getFuelLabel(code: FuelCode) {
  return fuelOptions.find((fuel) => fuel.code === code)?.label ?? "휘발유";
}

export function buildDemoStations(latitude: number, longitude: number, fuel: FuelCode) {
  return demoBase
    .map((station, index) => {
      const distance = distanceMeters(latitude, longitude, station.lat, station.lon);
      const price = fuelBasePrice[fuel] + station.seed + Math.round(distance / 820) - index * 3;

      return {
        id: station.id,
        rank: 0,
        name: station.name,
        brand: station.brand,
        address: station.address,
        price,
        distanceMeters: distance,
        latitude: station.lat,
        longitude: station.lon,
        fuel,
        self: station.self,
        open24h: station.open24h,
        delta: index % 2 === 0 ? -1.8 + index * 0.2 : 0.9 + index * 0.35
      } satisfies Station;
    })
    .sort((a, b) => a.price - b.price || a.distanceMeters - b.distanceMeters)
    .slice(0, 5)
    .map((station, index) => ({ ...station, rank: index + 1 }));
}

export function buildDemoAverages() {
  return fuelOptions.map((fuel, index) => ({
    code: fuel.code,
    label: fuel.label,
    price: fuelBasePrice[fuel.code] + index * 8,
    diff: index % 2 === 0 ? -0.5 - index * 0.1 : 0.4 + index * 0.15
  }));
}

export function buildDemoLowestStations(fuel: FuelCode, count = 10) {
  return demoLowestBase
    .map((station, index) => ({
      id: station.id,
      rank: index + 1,
      name: station.name,
      brand: station.brand,
      address: station.address,
      price: fuelBasePrice[fuel] + station.seed + index * 2,
      fuel
    }))
    .slice(0, count) satisfies LowestStation[];
}

export function normalizeFuel(value: string | null): FuelCode {
  return fuelOptions.some((fuel) => fuel.code === value) ? (value as FuelCode) : "B027";
}
