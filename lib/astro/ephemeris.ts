/* In-house astronomical ephemeris — real positional astronomy (Meeus, low-precision
 * series), NO third-party library. Computes the Sun's and Moon's ecliptic
 * longitudes, the Lahiri ayanamsa, sidereal positions, sign + degree, and the
 * lunar mansion (nakshatra). This is the deterministic, science-grounded core of
 * the psychophysical-nature engine. Pure + unit-tested. */

const D2R = Math.PI / 180
const norm360 = (x: number) => ((x % 360) + 360) % 360
const sind = (x: number) => Math.sin(x * D2R)

/** Julian Day for a UTC Date (Meeus 7.1). */
export function julianDay(date: Date): number {
  let y = date.getUTCFullYear(), m = date.getUTCMonth() + 1
  const d = date.getUTCDate() + (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) / 24
  if (m <= 2) { y -= 1; m += 12 }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5
}

const T = (jd: number) => (jd - 2451545.0) / 36525

/** Sun apparent ecliptic longitude in degrees (Meeus ch. 25, ~0.01°). */
export function sunLongitude(jd: number): number {
  const t = T(jd)
  const L0 = 280.46646 + 36000.76983 * t + 0.0003032 * t * t
  const M = 357.52911 + 35999.05029 * t - 0.0001537 * t * t
  const C = (1.914602 - 0.004817 * t - 0.000014 * t * t) * sind(M)
    + (0.019993 - 0.000101 * t) * sind(2 * M)
    + 0.000289 * sind(3 * M)
  const trueLon = L0 + C
  const omega = 125.04 - 1934.136 * t
  return norm360(trueLon - 0.00569 - 0.00478 * sind(omega))
}

/** Moon ecliptic longitude in degrees (Meeus ch. 47, main terms, ~0.2–0.3°). */
export function moonLongitude(jd: number): number {
  const t = T(jd)
  const Lp = 218.3164477 + 481267.88123421 * t - 0.0015786 * t * t + t * t * t / 538841 - t * t * t * t / 65194000
  const D = 297.8501921 + 445267.1114034 * t - 0.0018819 * t * t
  const M = 357.5291092 + 35999.0502909 * t
  const Mp = 134.9633964 + 477198.8675055 * t + 0.0087414 * t * t
  const F = 93.272095 + 483202.0175233 * t - 0.0036539 * t * t
  const terms: [number, number][] = [
    [6.288774, Mp], [1.274027, 2 * D - Mp], [0.658314, 2 * D], [0.213618, 2 * Mp],
    [-0.185116, M], [-0.114332, 2 * F], [0.058793, 2 * D - 2 * Mp], [0.057066, 2 * D - M - Mp],
    [0.053322, 2 * D + Mp], [0.045758, 2 * D - M], [-0.040923, M - Mp], [-0.034720, D],
    [-0.030383, M + Mp], [0.015327, 2 * D - 2 * F], [-0.012528, Mp + 2 * F], [0.010980, Mp - 2 * F],
    [0.010675, 4 * D - Mp], [0.010034, 3 * Mp], [0.008548, 4 * D - 2 * Mp],
  ]
  let lon = Lp
  for (const [c, arg] of terms) lon += c * sind(arg)
  return norm360(lon)
}

/** Lahiri ayanamsa in degrees (precession offset for sidereal positions). */
export function lahiriAyanamsa(jd: number): number {
  // ~23.853° at J2000, +50.2719"/yr. Good to a few arc-minutes over the era.
  return 23.853 + (jd - 2451545.0) / 365.25 * (50.2719 / 3600)
}

export const SIGN_NAMES = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]
export function signFromLongitude(lon: number): { index: number; name: string; degree: number } {
  const L = norm360(lon)
  const index = Math.floor(L / 30)
  return { index, name: SIGN_NAMES[index], degree: +(L - index * 30).toFixed(2) }
}

// 27 lunar mansions (nakshatras), each 13°20', with their Vimshottari lords.
export const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha",
  "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
]
const NAK_LORDS = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]
export function nakshatra(siderealMoonLon: number): { index: number; name: string; pada: number; lord: string } {
  const span = 360 / 27
  const L = norm360(siderealMoonLon)
  const index = Math.floor(L / span)
  const pada = Math.floor((L - index * span) / (span / 4)) + 1
  return { index, name: NAKSHATRAS[index], pada, lord: NAK_LORDS[index % 9] }
}

export type Chart = {
  jd: number
  ayanamsa: number
  sun: { tropicalLon: number; siderealLon: number; tropical: ReturnType<typeof signFromLongitude>; sidereal: ReturnType<typeof signFromLongitude> }
  moon: { tropicalLon: number; siderealLon: number; sign: ReturnType<typeof signFromLongitude>; nakshatra: ReturnType<typeof nakshatra> } | null
}

/** Compute the chart. Moon is included only when a birth time is supplied (it
 * moves ~13°/day, so without a time the Moon sign is unreliable — we omit it
 * rather than fabricate precision). */
export function computeChart(date: Date, hasTime: boolean): Chart {
  const jd = julianDay(date)
  const ay = lahiriAyanamsa(jd)
  const sunT = sunLongitude(jd)
  const sun = { tropicalLon: sunT, siderealLon: norm360(sunT - ay), tropical: signFromLongitude(sunT), sidereal: signFromLongitude(norm360(sunT - ay)) }
  let moon: Chart["moon"] = null
  if (hasTime) {
    const moonT = moonLongitude(jd)
    const moonS = norm360(moonT - ay)
    moon = { tropicalLon: moonT, siderealLon: moonS, sign: signFromLongitude(moonS), nakshatra: nakshatra(moonS) }
  }
  return { jd, ayanamsa: +ay.toFixed(3), sun, moon }
}
