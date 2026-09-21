<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreClientTimingRequest;
use App\Tracing\Attributes\Trace;
use App\Tracing\TraceStore;
use Illuminate\Http\JsonResponse;

class TraceController extends Controller
{
    public function __construct(private readonly TraceStore $store) {}

    /**
     * Read a recorded trace.
     *
     * Every API response carries its trace id in the X-Trace-Id header. Pass that id
     * here to get the spans, their explanations, the SQL with its query plan, and the
     * source lines each span came from.
     */
    #[Trace('Read a trace', why: 'The anatomy page is a viewer for whatever id it is given; nothing about the trace is generated for display.', kind: 'controller')]
    public function show(string $id): JsonResponse
    {
        $trace = $this->store->get($id);

        if (! $trace) {
            return response()->json([
                'message' => 'No trace with that id. Traces expire after '.config('tracing.ttl_minutes').' minutes.',
            ], 404);
        }

        return response()->json(['data' => $trace]);
    }

    /**
     * Attach browser timings to a trace.
     *
     * The client posts what only the browser can measure: DNS, TCP, TLS, time to first
     * byte and download. They are stored under the same id, so one record holds both
     * halves of the request.
     */
    #[Trace('Attach client timings', why: 'The server cannot see DNS or TLS. Without this the page would be guessing at 90 percent of what the visitor waited for.', kind: 'controller')]
    public function storeClientTiming(StoreClientTimingRequest $request, string $id): JsonResponse
    {
        $trace = $this->store->attachClient($id, $request->validated());

        if (! $trace) {
            return response()->json(['message' => 'No trace with that id.'], 404);
        }

        return response()->json(['data' => $trace['client']]);
    }
}
