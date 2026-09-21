<?php

namespace App\Tracing\Middleware;

use App\Tracing\Tracer;
use App\Tracing\TraceStore;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Opens the root span before anything else in the API group and, after the response
 * has been sent, stores the finished trace under the id the client received.
 */
final class TraceRequest
{
    public function __construct(private readonly Tracer $tracer, private readonly TraceStore $store) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! config('tracing.enabled')) {
            return $next($request);
        }

        $id = $request->header('X-Request-Id') ?: (string) Str::ulid();
        $this->tracer->start($request, $id);

        // Everything before this point is framework bootstrap: autoload, providers, route matching.
        $this->tracer->mark('route_matched');

        $response = $next($request);

        $response->headers->set(config('tracing.header'), $id);
        $response->headers->set('Access-Control-Expose-Headers', config('tracing.header'));

        return $response;
    }

    public function terminate(Request $request, Response $response): void
    {
        if (! $this->tracer->active()) {
            return;
        }

        $this->store->put($this->tracer->finish($response->getStatusCode()));
    }
}
