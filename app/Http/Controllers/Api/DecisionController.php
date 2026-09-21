<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DecisionResource;
use App\Repositories\DecisionRepository;
use App\Tracing\Attributes\Trace;
use App\Tracing\Tracing;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Http\JsonResponse;

class DecisionController extends Controller
{
    public function __construct(
        private readonly DecisionRepository $decisions,
        private readonly Cache $cache,
    ) {}

    /**
     * Operating decisions.
     *
     * The rules I run servers by, each with the incident or measurement behind it.
     */
    #[Trace('Decisions', why: 'A short ordered list; cached with the rest of the page payloads.', kind: 'controller')]
    public function index(): JsonResponse
    {
        $cached = true;

        $payload = $this->cache->remember('decisions:v1', 300, function () use (&$cached) {
            $cached = false;

            return DecisionResource::collection(Tracing::call([$this->decisions, 'visible']))->resolve();
        });

        return response()->json([
            'data' => $payload,
            'meta' => ['count' => count($payload), 'cache' => $cached ? 'hit' : 'miss'],
        ]);
    }
}
