<?php

namespace App\Tracing\Middleware;

use App\Tracing\Attributes\Trace;
use App\Tracing\SourceExcerpt;
use App\Tracing\Tracer;
use Closure;
use Illuminate\Http\Request;
use ReflectionMethod;
use Symfony\Component\HttpFoundation\Response;

/**
 * Last middleware in the API group: wraps the controller action in a span named by
 * the action's #[Trace] attribute and marks where middleware ends and the controller begins.
 */
final class TraceRoute
{
    public function __construct(private readonly Tracer $tracer) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->tracer->active()) {
            return $next($request);
        }

        [$name, $why, $source] = $this->describe($request);

        $this->tracer->mark('controller_start');
        $span = $this->tracer->begin($name, $why, 'controller', ['action' => $request->route()?->getActionName()], $source);

        try {
            return $next($request);
        } finally {
            $this->tracer->end($span);
            $this->tracer->mark('controller_end');
        }
    }

    /** @return array{0:string,1:?string,2:?array} */
    private function describe(Request $request): array
    {
        $action = $request->route()?->getActionName() ?? 'Closure';

        if (! str_contains($action, '@')) {
            return ['Route closure', null, null];
        }

        [$class, $method] = explode('@', $action, 2);

        try {
            $ref = new ReflectionMethod($class, $method);
        } catch (\ReflectionException) {
            return [class_basename($class).'@'.$method, null, null];
        }

        $attr = ($ref->getAttributes(Trace::class)[0] ?? null)?->newInstance();

        return [
            $attr?->what ?? class_basename($class).'@'.$method,
            $attr?->why,
            SourceExcerpt::for($ref),
        ];
    }
}
