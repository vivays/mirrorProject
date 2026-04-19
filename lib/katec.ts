const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

const KATEC = {
  a: 6377397.155,
  b: 6356078.96325,
  lat0: 38 * DEG_TO_RAD,
  lon0: 128 * DEG_TO_RAD,
  k0: 0.9999,
  x0: 400000,
  y0: 600000
};

function meridianArc(phi: number, a: number, e2: number) {
  const e4 = e2 * e2;
  const e6 = e4 * e2;

  return (
    a *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi))
  );
}

function projectKatec(latitude: number, longitude: number) {
  const lat = latitude * DEG_TO_RAD;
  const lon = longitude * DEG_TO_RAD;
  const { a, b, lat0, lon0, k0, x0, y0 } = KATEC;
  const e2 = 1 - (b * b) / (a * a);
  const ep2 = e2 / (1 - e2);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const tanLat = Math.tan(lat);
  const n = a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const t = tanLat * tanLat;
  const c = ep2 * cosLat * cosLat;
  const dLon = lon - lon0;
  const aa = cosLat * dLon;
  const m = meridianArc(lat, a, e2);
  const m0 = meridianArc(lat0, a, e2);

  const x =
    x0 +
    k0 *
      n *
      (aa +
        ((1 - t + c) * Math.pow(aa, 3)) / 6 +
        ((5 - 18 * t + t * t + 72 * c - 58 * ep2) * Math.pow(aa, 5)) / 120);

  const y =
    y0 +
    k0 *
      (m -
        m0 +
        n *
          tanLat *
          ((aa * aa) / 2 +
            ((5 - t + 9 * c + 4 * c * c) * Math.pow(aa, 4)) / 24 +
            ((61 - 58 * t + t * t + 600 * c - 330 * ep2) * Math.pow(aa, 6)) / 720));

  return {
    x,
    y
  };
}

export function wgs84ToKatec(latitude: number, longitude: number) {
  const projected = projectKatec(latitude, longitude);

  return {
    x: Math.round(projected.x),
    y: Math.round(projected.y)
  };
}

function initialKatecGuess(x: number, y: number) {
  const latitude = RAD_TO_DEG * KATEC.lat0 + (y - KATEC.y0) / 111000;
  const longitude =
    RAD_TO_DEG * KATEC.lon0 + (x - KATEC.x0) / (88000 * Math.max(Math.cos(latitude * DEG_TO_RAD), 0.2));

  return { latitude, longitude };
}

export function katecToWgs84(x: number, y: number) {
  let { latitude, longitude } = initialKatecGuess(x, y);
  const delta = 0.0001;

  for (let index = 0; index < 10; index += 1) {
    const current = projectKatec(latitude, longitude);
    const errorX = current.x - x;
    const errorY = current.y - y;

    if (Math.hypot(errorX, errorY) < 0.05) {
      break;
    }

    const byLat = projectKatec(latitude + delta, longitude);
    const byLon = projectKatec(latitude, longitude + delta);
    const a = (byLat.x - current.x) / delta;
    const b = (byLon.x - current.x) / delta;
    const c = (byLat.y - current.y) / delta;
    const d = (byLon.y - current.y) / delta;
    const determinant = a * d - b * c;

    if (Math.abs(determinant) < 1e-9) {
      break;
    }

    latitude -= (d * errorX - b * errorY) / determinant;
    longitude -= (-c * errorX + a * errorY) / determinant;
  }

  return { latitude, longitude };
}
