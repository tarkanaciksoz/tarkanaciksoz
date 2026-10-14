import type { ClientTiming, Trace } from '@/types/portfolio';

export type ApiResult<T> = {
    body: T;
    /** The exact bytes that came back, before parsing. */
    raw: string;
    traceId: string | null;
    cache: string | null;
    status: number;
    /** What the browser measured for this exact request. */
    timing: ClientTiming | null;
};

/** One call this page made to its own API, as the page saw it. */
export type LogEntry = { method: string; path: string; status: number; ms: number; cache: string | null };

const entries: LogEntry[] = [];
const listeners = new Set<(entry: LogEntry) => void>();

/** Every request the page has made so far, in order; the boot screen and the marquee read it. */
export const requestLog = {
    entries: (): readonly LogEntry[] => entries,
    subscribe(listener: (entry: LogEntry) => void): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};

function record(entry: LogEntry) {
    entries.push(entry);
    listeners.forEach((listener) => listener(entry));
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function readTiming(url: string, fallbackMs: number): ClientTiming | null {
    if (typeof performance === 'undefined' || !performance.getEntriesByType) return null;

    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const entry = entries.filter((e) => e.name.endsWith(url) || e.name.includes(url)).at(-1);
    if (!entry) return { dns_ms: 0, tcp_ms: 0, tls_ms: 0, ttfb_ms: fallbackMs, download_ms: 0, total_ms: fallbackMs };

    const round = (n: number) => Math.max(0, Math.round(n * 100) / 100);

    return {
        dns_ms: round(entry.domainLookupEnd - entry.domainLookupStart),
        tcp_ms: round((entry.secureConnectionStart || entry.connectEnd) - entry.connectStart),
        tls_ms: round(entry.secureConnectionStart ? entry.connectEnd - entry.secureConnectionStart : 0),
        ttfb_ms: round(entry.responseStart - entry.requestStart),
        download_ms: round(entry.responseEnd - entry.responseStart),
        total_ms: round(entry.duration || fallbackMs),
        transfer_size: entry.transferSize ?? null,
        protocol: entry.nextHopProtocol || null,
    };
}

/** Calls the site's own API and keeps what only the browser can measure. */
export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
    const started = performance.now();
    const response = await fetch(path, { headers: { Accept: 'application/json' } });
    const raw = await response.text();
    const body = JSON.parse(raw) as T;
    const elapsed = performance.now() - started;
    record({ method: 'GET', path, status: response.status, ms: round2(elapsed), cache: response.headers.get('Cache-Status') });

    return {
        body,
        raw,
        status: response.status,
        traceId: response.headers.get('X-Trace-Id'),
        cache: response.headers.get('Cache-Status'),
        timing: readTiming(path, Math.round(elapsed * 100) / 100),
    };
}

/** Posts the browser's own numbers so one record holds both halves of the request. */
export async function postClientTiming(traceId: string, timing: ClientTiming): Promise<void> {
    const started = performance.now();
    const response = await fetch(`/api/traces/${traceId}/client-timing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(timing),
    }).catch(() => null);
    if (response)
        record({
            method: 'POST',
            path: '/api/traces/{id}/client-timing',
            status: response.status,
            ms: round2(performance.now() - started),
            cache: null,
        });
}

export async function fetchTrace(traceId: string): Promise<Trace | null> {
    try {
        const started = performance.now();
        const response = await fetch(`/api/traces/${traceId}`, { headers: { Accept: 'application/json' } });
        record({ method: 'GET', path: '/api/traces/{id}', status: response.status, ms: round2(performance.now() - started), cache: null });
        if (!response.ok) return null;
        const json = (await response.json()) as { data: Trace };
        return json.data;
    } catch {
        return null;
    }
}

export const ms = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));
