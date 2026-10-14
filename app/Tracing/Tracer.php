<?php

namespace App\Tracing;

use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * One instance per request (bound as scoped, so Octane resets it).
 * Keeps a stack of open spans, a flat list of finished ones, and a few named marks
 * that become the request's phases: bootstrap, middleware, controller, response.
 */
final class Tracer
{
    private bool $active = false;

    private string $id = '';

    private float $t0 = 0.0;

    private string $method = '';

    private string $path = '';

    /** @var Span[] */
    private array $spans = [];

    /** @var Span[] */
    private array $stack = [];

    /** @var array<string,float> */
    private array $marks = [];

    public function start(Request $request, string $id): void
    {
        $requestTime = (float) $request->server('REQUEST_TIME_FLOAT', microtime(true));

        $this->active = true;
        $this->id = $id;
        $this->t0 = $requestTime * 1000;
        $this->method = $request->getMethod();
        $this->path = '/'.ltrim($request->getPathInfo(), '/');
        $this->spans = [];
        $this->stack = [];
        $this->marks = [];
    }

    public function active(): bool
    {
        return $this->active;
    }

    public function id(): string
    {
        return $this->id;
    }

    /** Milliseconds since the request reached PHP. */
    public function now(): float
    {
        return microtime(true) * 1000 - $this->t0;
    }

    public function mark(string $name): void
    {
        if ($this->active) {
            $this->marks[$name] = $this->now();
        }
    }

    public function begin(string $name, ?string $why = null, string $kind = 'custom', array $meta = [], ?array $source = null): Span
    {
        $parent = end($this->stack) ?: null;
        $span = new Span((string) Str::ulid(), $parent?->id, $name, $why, $kind, $this->now(), $meta, $source);
        $this->stack[] = $span;

        return $span;
    }

    public function end(Span $span, array $meta = []): void
    {
        $span->durationMs = $this->now() - $span->startMs;
        $span->meta = array_merge($span->meta, $meta);

        // Close anything left open above this span, then pop it.
        while ($open = array_pop($this->stack)) {
            if ($open === $span) {
                break;
            }
            $open->durationMs ??= $this->now() - $open->startMs;
            $this->spans[] = $open;
        }

        $this->spans[] = $span;
    }

    /**
     * Records work that already happened (a query reported by the connection),
     * positioned so that it ends now.
     */
    public function event(string $name, string $kind, float $durationMs, array $meta = [], ?string $why = null, ?array $source = null): Span
    {
        $parent = end($this->stack) ?: null;
        $span = new Span((string) Str::ulid(), $parent?->id, $name, $why, $kind, $this->now() - $durationMs, $meta, $source);
        $span->durationMs = $durationMs;
        $this->spans[] = $span;

        return $span;
    }

    public function finish(int $status): array
    {
        while ($open = array_pop($this->stack)) {
            $open->durationMs ??= $this->now() - $open->startMs;
            $this->spans[] = $open;
        }

        $total = $this->now();
        usort($this->spans, fn (Span $a, Span $b) => $a->startMs <=> $b->startMs);

        $parentIds = array_filter(array_map(fn (Span $s) => $s->parentId, $this->spans));
        $leafMs = 0.0;
        foreach ($this->spans as $span) {
            if (! in_array($span->id, $parentIds, true)) {
                $leafMs += $span->durationMs ?? 0;
            }
        }

        $routeMatched = $this->marks['route_matched'] ?? 0.0;
        $controllerStart = $this->marks['controller_start'] ?? $routeMatched;
        $controllerEnd = $this->marks['controller_end'] ?? $controllerStart;

        $this->active = false;

        return [
            'id' => $this->id,
            'method' => $this->method,
            'path' => $this->path,
            'status' => $status,
            'commit' => Repository::short(),
            // Links for the reader: the commit, and a base that any file path can be appended to.
            'commit_url' => Repository::commitUrl(),
            'files_url' => Repository::filesUrl(),
            'runtime' => [
                'php' => PHP_VERSION,
                'laravel' => app()->version(),
                'server' => isset($_SERVER['LARAVEL_OCTANE']) ? 'octane' : (PHP_SAPI === 'cli-server' ? 'artisan serve' : PHP_SAPI),
            ],
            'started_at' => now()->subMilliseconds((int) $total)->toIso8601String(),
            'duration_ms' => round($total, 3),
            'phases' => [
                ['name' => 'bootstrap', 'ms' => round($routeMatched, 3)],
                ['name' => 'middleware', 'ms' => round($controllerStart - $routeMatched, 3)],
                ['name' => 'controller', 'ms' => round($controllerEnd - $controllerStart, 3)],
                ['name' => 'response', 'ms' => round($total - $controllerEnd, 3)],
            ],
            'spans' => array_map(fn (Span $s) => $s->toArray(), $this->spans),
            'leaf_ms' => round($leafMs, 3),
            'unattributed_ms' => round(max(0, $total - $leafMs), 3),
            'client' => null,
        ];
    }
}
