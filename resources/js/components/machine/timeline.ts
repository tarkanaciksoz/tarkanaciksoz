import type { ClientTiming, Trace } from '@/types/portfolio';
import type { Step } from './steps';

/** Which clock a row is drawn on: the browser's whole wait, or the server's slice of it, zoomed. */
export type Clock = 'browser' | 'server';

export type Row = { step: Step; clock: Clock; start: number; end: number };

export type Timeline = {
    rows: Row[];
    /** Milliseconds each clock spans; the server clock is the browser's server window, stretched. */
    browserMs: number;
    serverMs: number;
    /** Where the server's work sits on the browser clock. */
    window: [number, number];
};

/**
 * Places every step on a clock, in the order it happened. The browser rows use
 * Resource Timing; the server rows use the trace's own marks and span starts,
 * which share the server's clock (boot starts at zero).
 */
export function buildTimeline(steps: Step[], trace: Trace, client: ClientTiming | null): Timeline {
    const serverMs = trace.duration_ms;
    const phase = (name: string) => trace.phases.find((p) => p.name === name)?.ms ?? 0;
    const boot = phase('bootstrap');
    const middleware = phase('middleware');
    const controller = phase('controller');
    const response = phase('response');
    const phased = boot + middleware + controller + response;
    const spans = new Map(trace.spans.map((s) => [s.id, s]));

    const dns = client?.dns_ms ?? 0;
    const conn = (client?.tcp_ms ?? 0) + (client?.tls_ms ?? 0);
    const ttfb = client?.ttfb_ms ?? serverMs;
    const connEnd = dns + conn;
    // The server's slice of the wait, centred in it: half the distance out, half back.
    const s0 = connEnd + Math.max(0, ttfb - serverMs) / 2;
    const s1 = Math.min(connEnd + ttfb, s0 + serverMs);
    const browserMs = Math.max(client?.total_ms ?? 0, connEnd + ttfb + (client?.download_ms ?? 0), s1);

    const placed = steps.map((step): Row => {
        const span = spans.get(step.key);
        if (span) return { step, clock: 'server', start: span.start_ms, end: span.start_ms + span.duration_ms };

        switch (step.key) {
            case 'fetch':
                return { step, clock: 'browser', start: 0, end: 0 };
            case 'dns':
                return { step, clock: 'browser', start: 0, end: dns };
            case 'conn':
                return { step, clock: 'browser', start: dns, end: connEnd };
            case 'wire':
                return { step, clock: 'browser', start: connEnd, end: connEnd + ttfb };
            case 'back':
                return { step, clock: 'browser', start: connEnd + ttfb, end: browserMs };
            case 'phase-bootstrap':
                return { step, clock: 'server', start: 0, end: boot };
            case 'phase-middleware':
                return { step, clock: 'server', start: boot, end: boot + middleware };
            case 'phase-response':
                return { step, clock: 'server', start: boot + middleware + controller, end: phased };
            case 'unattributed':
                return { step, clock: 'server', start: Math.min(phased, serverMs), end: serverMs };
            default:
                return { step, clock: 'server', start: 0, end: step.ms };
        }
    });

    // Browser rows before the server's, the server's in the order they started, then the walk back.
    const order = (r: Row) => (r.clock === 'browser' ? (r.step.key === 'back' ? 2 : 0) : 1);
    const rows = placed
        .map((r, i) => ({ r, i }))
        .sort((a, b) => order(a.r) - order(b.r) || a.r.start - b.r.start || a.i - b.i)
        .map(({ r }) => r);

    return { rows, browserMs: Math.max(browserMs, 0.001), serverMs: Math.max(serverMs, 0.001), window: [s0, s1] };
}
