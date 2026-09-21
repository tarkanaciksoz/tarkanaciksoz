import type { ClientTiming, SourceExcerpt, Span, Trace } from '@/types/portfolio';

export type StepKind = 'client' | 'network' | 'server' | 'gap' | 'back';

export type Step = {
    key: string;
    layer: LayerId;
    title: string;
    ms: number;
    kind: StepKind;
    why: string | null;
    detail: string;
    source: SourceExcerpt | null;
    sql?: string;
    explain?: Record<string, unknown>[] | null;
    depth: number;
    slow?: boolean;
};

export type LayerId = 'browser' | 'dns' | 'conn' | 'wire' | 'edge' | 'app' | 'cache' | 'db';

export const LAYERS: { id: LayerId; name: string; sub: string; glyph: string }[] = [
    { id: 'browser', name: 'Browser', sub: 'fetch()', glyph: 'devices' },
    { id: 'dns', name: 'DNS', sub: 'name to address', glyph: 'node' },
    { id: 'conn', name: 'Connection', sub: 'TCP · TLS', glyph: 'node' },
    { id: 'wire', name: 'In flight', sub: 'request on the wire', glyph: 'node' },
    { id: 'edge', name: 'Server entry', sub: 'boot · middleware', glyph: 'grille' },
    { id: 'app', name: 'Application', sub: 'controller · resources', glyph: 'code' },
    { id: 'cache', name: 'Cache', sub: 'payload store', glyph: 'stages' },
    { id: 'db', name: 'Database', sub: 'SQL · query plan', glyph: 'cylinder' },
];

const round = (n: number) => Math.round(n * 100) / 100;

function layerFor(span: Span): LayerId {
    if (span.kind === 'query') return 'db';
    if (span.kind === 'build') return 'cache';
    if (span.kind === 'repository') return 'db';
    return 'app';
}

/** Turns a recorded trace plus the browser's own numbers into the ordered story the page tells. */
export function buildSteps(trace: Trace, client: ClientTiming | null): Step[] {
    const steps: Step[] = [];
    const cached = trace.spans.every((s) => s.kind !== 'query');

    steps.push({
        key: 'fetch',
        layer: 'browser',
        title: 'The page asks',
        ms: 0,
        kind: 'client',
        why: 'Everything on this page is one request. Nothing here was written into the HTML at build time.',
        detail: `fetch('/api${trace.path.replace('/api', '')}') from the page you are reading. The response carries a trace id, and that id is how this view found the record below.`,
        source: null,
        depth: 0,
    });

    if (client) {
        steps.push({
            key: 'dns',
            layer: 'dns',
            title: client.dns_ms > 0 ? 'DNS lookup' : 'DNS · already known',
            ms: round(client.dns_ms),
            kind: 'network',
            why:
                client.dns_ms > 0
                    ? 'The first request of a session pays for the name lookup; the rest read it from the cache in the operating system.'
                    : 'Nothing left the machine. The name was resolved earlier in this session and the answer is still valid.',
            detail: `Measured by the browser, not by the server: ${round(client.dns_ms)} ms of name resolution.`,
            source: null,
            depth: 0,
        });

        steps.push({
            key: 'conn',
            layer: 'conn',
            title: client.tcp_ms + client.tls_ms > 0 ? 'Connection and TLS' : 'Connection · reused',
            ms: round(client.tcp_ms + client.tls_ms),
            kind: 'network',
            why:
                client.tcp_ms + client.tls_ms > 0
                    ? 'A new connection costs a handshake before a single byte of the request is sent. Keeping connections alive is why the second request is cheaper.'
                    : 'The connection from an earlier request is still open, so there is no handshake to pay for.',
            detail: `TCP ${round(client.tcp_ms)} ms, TLS ${round(client.tls_ms)} ms${client.protocol ? `, over ${client.protocol}` : ''}.`,
            source: null,
            depth: 0,
        });

        const serverShare = trace.duration_ms;
        steps.push({
            key: 'wire',
            layer: 'wire',
            title: 'Waiting for the first byte',
            ms: round(client.ttfb_ms),
            kind: 'network',
            why: 'Time to first byte is the honest number: the trip out, everything the server did, and the trip back. The server only owns the middle of it.',
            detail: `${round(client.ttfb_ms)} ms from the browser's point of view, of which the server accounts for ${serverShare.toFixed(1)} ms. The rest is distance.`,
            source: null,
            depth: 0,
        });
    }

    trace.phases
        .filter((phase) => phase.ms > 0.05 && phase.name !== 'controller')
        .forEach((phase) => {
            const detail =
                phase.name === 'bootstrap'
                    ? 'Autoloading, service providers, configuration and route matching, before any of my code runs. On a long-lived worker this is paid once, not per request.'
                    : phase.name === 'middleware'
                      ? 'Rate limiting and the tracer itself. The tracer opens its root span first, so even a rejected request leaves a record.'
                      : 'Serialising the payload and handing it back to the web server.';

            steps.push({
                key: `phase-${phase.name}`,
                layer: 'edge',
                title: phase.name === 'bootstrap' ? 'Framework boot' : phase.name === 'middleware' ? 'Middleware' : 'Response',
                ms: round(phase.ms),
                kind: 'server',
                why: null,
                detail,
                source: null,
                depth: 0,
            });
        });

    const byParent = new Map<string | null, Span[]>();
    trace.spans.forEach((span) => {
        const list = byParent.get(span.parent_id) ?? [];
        list.push(span);
        byParent.set(span.parent_id, list);
    });

    const slowest = trace.spans.reduce<Span | null>((max, s) => (!max || s.duration_ms > max.duration_ms ? s : max), null);

    const walk = (parentId: string | null, depth: number) => {
        (byParent.get(parentId) ?? []).forEach((span) => {
            const sql = typeof span.meta.sql === 'string' ? span.meta.sql : undefined;

            steps.push({
                key: span.id,
                layer: layerFor(span),
                title: sql ? 'Database query' : span.name,
                ms: round(span.duration_ms),
                kind: 'server',
                why: span.why,
                detail: sql
                    ? `One statement on the ${String(span.meta.driver ?? 'sql')} connection. The plan below is the database's own answer to how it will be read.`
                    : span.kind === 'controller'
                      ? 'The controller asks the cache, and only builds the payload when the cache has nothing. It never talks to the database itself.'
                      : span.kind === 'build'
                        ? 'This block runs on a cache miss only. What gets stored is the finished payload, so a later hit skips the database and the transformation entirely.'
                        : 'A unit of work the code named itself.',
                source: span.source,
                sql,
                explain: (span.meta.explain as Record<string, unknown>[] | null) ?? null,
                depth,
                slow: slowest?.id === span.id && span.duration_ms > 1,
            });

            walk(span.id, depth + 1);
        });
    };
    walk(null, 0);

    steps.push({
        key: 'unattributed',
        layer: 'edge',
        title: 'Unattributed',
        ms: round(trace.unattributed_ms),
        kind: 'gap',
        why: 'A tracer that hides the remainder is lying about the total. This is what the spans did not claim.',
        detail: `${trace.leaf_ms.toFixed(1)} ms inside measured spans plus ${trace.unattributed_ms.toFixed(1)} ms outside them makes the ${trace.duration_ms.toFixed(1)} ms the server took. Container resolution, event dispatch and framework plumbing live here.`,
        source: null,
        depth: 0,
    });

    if (client) {
        steps.push({
            key: 'back',
            layer: 'browser',
            title: 'The page draws',
            ms: round(client.download_ms),
            kind: 'back',
            why: cached
                ? 'This run was served from cache: no database, no transformation, same bytes.'
                : 'The payload that came back is the map at the top of this page.',
            detail: `${round(client.download_ms)} ms to read the body${client.transfer_size ? `, ${(client.transfer_size / 1024).toFixed(1)} KB over the wire` : ''}. End to end the browser waited ${round(client.total_ms)} ms.`,
            source: null,
            depth: 0,
        });
    }

    return steps;
}
