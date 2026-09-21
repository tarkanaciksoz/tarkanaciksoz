<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SystemResource;
use App\Repositories\SystemRepository;
use App\Tracing\Attributes\Trace;
use App\Tracing\Tracing;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Http\JsonResponse;

class SystemController extends Controller
{
    public function __construct(
        private readonly SystemRepository $systems,
        private readonly Cache $cache,
    ) {}

    /**
     * Systems I have built.
     *
     * Each entry is a problem, the approach that answered it, and what it taught.
     */
    #[Trace('Systems', why: 'Same read-heavy shape as the stack map; cached together with it.', kind: 'controller')]
    public function index(): JsonResponse
    {
        $cached = true;

        $payload = $this->cache->remember('systems:v1', 300, function () use (&$cached) {
            $cached = false;

            return SystemResource::collection(Tracing::call([$this->systems, 'visible']))->resolve();
        });

        return response()->json([
            'data' => $payload,
            'meta' => ['count' => count($payload), 'cache' => $cached ? 'hit' : 'miss'],
        ]);
    }
}
