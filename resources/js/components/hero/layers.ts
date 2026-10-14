import type { ClientTiming, Trace } from '@/types/portfolio';
import { layerFor } from '../portfolio/anatomy-steps';
import type { SceneLayer } from './glass-scene';

const NAMES: Record<string, string> = {
    network: 'network',
    edge: 'server entry',
    app: 'application',
    cache: 'cache',
    db: 'database',
};

/**
 * Where one request's time went, per layer, with nothing counted twice: a span
 * only owns the time its children did not claim. The network is what the
 * browser waited for that the server cannot account for.
 */
export function heroLayers(trace: Trace, client: ClientTiming | null, cache: string | null): SceneLayer[] {
    const own: Record<string, number> = { network: 0, edge: 0, app: 0, cache: 0, db: 0 };

    if (client) {
        own.network = client.dns_ms + client.tcp_ms + client.tls_ms + Math.max(0, client.ttfb_ms - trace.duration_ms) + client.download_ms;
    }

    // Boot, middleware and the response are outside every span: that is the unattributed time.
    own.edge = trace.unattributed_ms;

    trace.spans.forEach((span) => {
        const children = trace.spans.filter((s) => s.parent_id === span.id).reduce((n, s) => n + s.duration_ms, 0);
        own[layerFor(span)] += Math.max(0, span.duration_ms - children);
    });

    const slowest = Object.entries(own).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
    // A cache hit is read inside the application span; the request turns back there and the database never sees it.
    const hit = cache === 'hit';

    return Object.keys(NAMES).map((id) => ({
        id,
        name: NAMES[id],
        ms: Math.round(own[id] * 100) / 100,
        slowest: id === slowest && own[id] > 0,
        reached: own[id] > 0 || (id === 'cache' && hit),
        note: own[id] > 0 ? null : id === 'cache' && hit ? 'hit' : 'not touched',
    }));
}
