import type { ClientTiming, Trace } from '@/types/portfolio';

export type ApiResult<T> = {
    body: T;
    traceId: string | null;
    cache: string | null;
    status: number;
    /** What the browser measured for this exact request. */
    timing: ClientTiming | null;
};

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
    const body = (await response.json()) as T;
    const elapsed = performance.now() - started;

    return {
        body,
        status: response.status,
        traceId: response.headers.get('X-Trace-Id'),
        cache: response.headers.get('Cache-Status'),
        timing: readTiming(path, Math.round(elapsed * 100) / 100),
    };
}

/** Posts the browser's own numbers so one record holds both halves of the request. */
export async function postClientTiming(traceId: string, timing: ClientTiming): Promise<void> {
    await fetch(`/api/traces/${traceId}/client-timing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(timing),
    }).catch(() => undefined);
}

export async function fetchTrace(traceId: string): Promise<Trace | null> {
    try {
        const response = await fetch(`/api/traces/${traceId}`, { headers: { Accept: 'application/json' } });
        if (!response.ok) return null;
        const json = (await response.json()) as { data: Trace };
        return json.data;
    } catch {
        return null;
    }
}

export const ms = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));
