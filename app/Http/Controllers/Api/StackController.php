<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\StackLayerResource;
use App\Repositories\StackRepository;
use App\Tracing\Attributes\Trace;
use App\Tracing\Tracing;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Http\JsonResponse;

class StackController extends Controller
{
    private const CACHE_KEY = 'stack:v2';

    private const TTL_SECONDS = 300;

    public function __construct(
        private readonly StackRepository $stack,
        private readonly Cache $cache,
    ) {}

    /**
     * The stack map.
     *
     * Every layer of the stack with the tools inside it, in map order. This is the
     * endpoint the home page draws, and the one the anatomy page traces.
     */
    #[Trace('Stack map', why: 'Read-heavy, changes a few times a month, safe to cache for five minutes.', kind: 'controller')]
    public function index(): JsonResponse
    {
        $cached = true;

        $payload = $this->cache->remember(self::CACHE_KEY, self::TTL_SECONDS, function () use (&$cached) {
            $cached = false;

            return Tracing::span(
                #[Trace('Build the map', why: 'Runs only on a cache miss. The final payload is cached, not the models, so a hit skips hydration and transformation entirely.', kind: 'build')]
                fn () => StackLayerResource::collection(
                    Tracing::call([$this->stack, 'map']),
                )->resolve(),
            );
        });

        return response()->json([
            'data' => $payload,
            'meta' => [
                'layers' => count($payload),
                'items' => array_sum(array_map(fn ($l) => count($l['items']), $payload)),
                'counted' => array_sum(array_map(fn ($l) => count(array_filter($l['items'], fn ($i) => $i['services'] !== null)), $payload)),
                'cache' => $cached ? 'hit' : 'miss',
                'ttl_seconds' => self::TTL_SECONDS,
            ],
        ])->header('Cache-Status', $cached ? 'hit' : 'miss');
    }
}
