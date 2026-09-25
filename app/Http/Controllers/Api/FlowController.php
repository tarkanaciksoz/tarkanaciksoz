<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\FlowResource;
use App\Models\Flow;
use App\Models\StackItem;
use App\Tracing\Attributes\Trace;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Http\JsonResponse;

class FlowController extends Controller
{
    public function __construct(private readonly Cache $cache) {}

    /**
     * Scenarios through the stack.
     *
     * Each flow is a real job told as the path it takes: the tools it touches in
     * order, with a note on why each hop exists. Steps carry the stack item id so a
     * client can light the matching tool from GET /stack.
     */
    #[Trace('Flows', why: 'Content that changes with a deploy; cached with the stack it points into.', kind: 'controller')]
    public function index(): JsonResponse
    {
        $cached = true;

        $payload = $this->cache->remember('flows:v1', 300, function () use (&$cached) {
            $cached = false;
            $ids = StackItem::query()->where('visible', true)->pluck('id', 'name')->all();

            return FlowResource::withItems(Flow::query()->where('visible', true)->orderBy('position')->get(), $ids);
        });

        return response()->json([
            'data' => $payload,
            'meta' => ['count' => count($payload), 'cache' => $cached ? 'hit' : 'miss'],
        ]);
    }
}
