import { useEffect, useState } from 'react'

// Current weather beside the homepage clock: a small line icon and the temperature, for example
// "22:54:40 [icon] 7°C". Data comes from Open-Meteo (free, no key; credit in the footer).
// How it behaves:
// - Fetched after the page has loaded, kept in this browser for 15 minutes, refreshed every
//   15 minutes only while the tab is visible.
// - A reading whose observation is older than 45 minutes is never shown. If the service fails, is
//   slow (8 s) or sends something unexpected, the weather is simply left out and the clock carries on.
// - Screen readers hear the condition in words ("partly cloudy, 7 degrees Celsius"); the icon is hidden from them.

const FRESH_MS = 15 * 60 * 1000 // use a saved reading for this long after fetching it
const MAX_AGE_MS = 45 * 60 * 1000 // never show an observation older than this
const RETRY_MS = 5 * 60 * 1000 // after a failure, wait this long before trying again
const TIMEOUT_MS = 8000
const WINDY_KMH = 40 // Open-Meteo has no "windy" code, so wind at or above this speed counts as windy

export type Condition = 'thunder' | 'snow' | 'rain' | 'fog' | 'wind' | 'cloudy' | 'partly' | 'clear-day' | 'clear-night'
// at: time of the observation; got: when this browser fetched it.
type Reading = { temp: number; condition: Condition; at: number; got: number }

const words: Record<Condition, string> = {
  thunder: 'thunderstorm',
  snow: 'snow',
  rain: 'rain',
  fog: 'fog',
  wind: 'windy',
  cloudy: 'cloudy',
  partly: 'partly cloudy',
  'clear-day': 'clear',
  'clear-night': 'clear',
}

// WMO weather codes as used by Open-Meteo. When conditions overlap, the most important one wins:
// thunderstorm, snow, rain, fog, wind, cloudy, partly cloudy, clear.
export function conditionFor(code: number, windKmh: number, isDay: boolean): Condition | null {
  if (!Number.isFinite(code)) return null
  if (code >= 95 && code <= 99) return 'thunder'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if (code === 45 || code === 48) return 'fog'
  if (Number.isFinite(windKmh) && windKmh >= WINDY_KMH) return 'wind'
  if (code === 3) return 'cloudy'
  if (code === 2) return 'partly'
  if (code === 0 || code === 1) return isDay ? 'clear-day' : 'clear-night'
  return null
}

// Whole degrees with a true minus sign; "-0" shows as 0.
export function formatTemp(t: number) {
  const r = Math.round(t) || 0
  return `${r < 0 ? '−' : ''}${Math.abs(r)}°C`
}

const key = (lat: number, lon: number) => `home-weather:${lat},${lon}`

function load(lat: number, lon: number): Reading | null {
  try {
    const r = JSON.parse(localStorage.getItem(key(lat, lon)) || 'null')
    return r && typeof r.temp === 'number' && typeof r.at === 'number' && typeof r.got === 'number' && r.condition in words ? r : null
  } catch {
    return null
  }
}

function save(lat: number, lon: number, r: Reading) {
  try {
    localStorage.setItem(key(lat, lon), JSON.stringify(r))
  } catch {
    // Storage full or blocked: the weather still shows, it is just fetched again next time.
  }
}

async function fetchReading(lat: number, lon: number): Promise<Reading | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,is_day&timeformat=unixtime`
    const res = await fetch(url, { signal: ctrl.signal, referrerPolicy: 'no-referrer' })
    if (!res.ok) return null
    const c = (await res.json())?.current
    const temp = Number(c?.temperature_2m)
    const at = Number(c?.time) * 1000
    const condition = conditionFor(Number(c?.weather_code), Number(c?.wind_speed_10m), c?.is_day !== 0)
    if (!Number.isFinite(temp) || !Number.isFinite(at) || !condition) return null
    return { temp, condition, at, got: Date.now() }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function useWeather(lat?: number, lon?: number) {
  const [reading, setReading] = useState<Reading | null>(null)
  useEffect(() => {
    if (typeof lat !== 'number' || typeof lon !== 'number') return
    let stopped = false
    let busy = false // a request is on its way: showing the tab again must not start a second one
    let timer: ReturnType<typeof setTimeout> | undefined
    const show = (r: Reading | null) => setReading(r && Date.now() - r.at <= MAX_AGE_MS ? r : null)
    const schedule = (ms: number) => {
      clearTimeout(timer)
      timer = setTimeout(update, ms)
    }
    async function update() {
      if (stopped || busy || document.visibilityState !== 'visible') return // picked up again when the tab is shown
      const saved = load(lat as number, lon as number)
      if (saved && Date.now() - saved.got < FRESH_MS && Date.now() - saved.at <= MAX_AGE_MS) {
        show(saved)
        return schedule(FRESH_MS - (Date.now() - saved.got))
      }
      busy = true
      const r = await fetchReading(lat as number, lon as number)
      busy = false
      if (stopped) return
      if (r) {
        save(lat as number, lon as number, r)
        show(r)
        schedule(FRESH_MS)
      } else {
        show(saved) // still shown only if its observation is under 45 minutes old
        schedule(RETRY_MS)
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') update()
      else clearTimeout(timer)
    }
    // Wait until the page has finished loading, so the weather never slows the page down.
    const start = () => { timer = setTimeout(update, 0) }
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })
    document.addEventListener('visibilitychange', onVisible)
    // Hide a reading that becomes too old while the page stays open without a successful refresh.
    const ager = setInterval(() => setReading((r) => (r && Date.now() - r.at > MAX_AGE_MS ? null : r)), 60 * 1000)
    return () => {
      stopped = true
      clearTimeout(timer)
      clearInterval(ager)
      window.removeEventListener('load', start)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [lat, lon])
  return reading
}

// Simple line icons drawn in our own code, in the clock's colour.
function Icon({ condition }: { condition: Condition }) {
  const sun = (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  )
  const smallCloud = <path d="M7 16h9a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 7 9.6 3.2 3.2 0 0 0 7 16z" />
  const shapes: Record<Condition, React.ReactNode> = {
    'clear-day': sun,
    'clear-night': <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
    partly: (
      <>
        <path d="M9 3v1.5M3.5 8.5H5M5.1 4.6l1 1M12.9 4.6l-1 1" />
        <path d="M5.8 11.2A3.5 3.5 0 1 1 12.3 7.6" />
        <path d="M9 20h8.5a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 9 13.6 3.2 3.2 0 0 0 9 20z" />
      </>
    ),
    cloudy: <path d="M7 18.5h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 11.2 3.65 3.65 0 0 0 7 18.5z" />,
    fog: <path d="M4 9h16M3 13h18M5 17h14" />,
    rain: (
      <>
        {smallCloud}
        <path d="M9 18.5l-1 2.5M13 18.5l-1 2.5M17 18.5l-1 2.5" />
      </>
    ),
    snow: (
      <>
        {smallCloud}
        <path d="M9 19.5v.01M13 19.5v.01M17 19.5v.01M11 22v.01M15 22v.01" />
      </>
    ),
    thunder: (
      <>
        {smallCloud}
        <path d="M12.5 17l-2 3h3l-2 3" />
      </>
    ),
    wind: <path d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7" />,
  }
  return (
    <svg className="home-wx-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" data-condition={condition}>
      {shapes[condition]}
    </svg>
  )
}

export function Weather({ reading }: { reading: Reading }) {
  const r = Math.round(reading.temp) || 0
  return (
    <span className="home-wx">
      <Icon condition={reading.condition} />
      <span aria-hidden="true">{formatTemp(reading.temp)}</span>
      <span className="visually-hidden">({words[reading.condition]}, {r} degrees Celsius)</span>
    </span>
  )
}
