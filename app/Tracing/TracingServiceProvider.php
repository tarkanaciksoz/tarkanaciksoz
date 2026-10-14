<?php

namespace App\Tracing;

use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;

final class TracingServiceProvider extends ServiceProvider
{
    private bool $explaining = false;

    public function register(): void
    {
        // Scoped: one tracer per request, reset between Octane requests.
        $this->app->scoped(Tracer::class, fn () => new Tracer);
        $this->app->singleton(TraceStore::class);
    }

    public function boot(): void
    {
        if (! config('tracing.enabled')) {
            return;
        }

        DB::listen(function (QueryExecuted $query) {
            $tracer = $this->app->make(Tracer::class);
            if (! $tracer->active() || $this->explaining || $this->isPlumbing($query->sql)) {
                return;
            }

            $meta = [
                'sql' => $query->sql,
                'bindings' => array_map(fn ($b) => is_scalar($b) || $b === null ? $b : (string) $b, $query->bindings),
                'connection' => $query->connectionName,
                'driver' => $query->connection->getDriverName(),
            ];

            if (config('tracing.explain') && str_starts_with(strtolower(ltrim($query->sql)), 'select')) {
                $meta['explain'] = $this->explain($query);
            }

            $tracer->event('Database query', 'query', (float) $query->time, $meta, null, $this->callSite());
        });
    }

    /** Cache, session and rate-limiter traffic is plumbing, not the story of the request. */
    private function isPlumbing(string $sql): bool
    {
        return (bool) preg_match('/\b(cache|cache_locks|sessions|jobs|job_batches|failed_jobs)\b/i', $sql);
    }

    /** The first application frame that led to this query: file and line, with an excerpt. */
    private function callSite(): ?array
    {
        $frames = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 40);

        foreach ($frames as $frame) {
            $file = $frame['file'] ?? null;
            $isVendor = str_contains($file, DIRECTORY_SEPARATOR.'vendor'.DIRECTORY_SEPARATOR);
            $isTracer = str_contains($file, DIRECTORY_SEPARATOR.'app'.DIRECTORY_SEPARATOR.'Tracing'.DIRECTORY_SEPARATOR);

            if (! $file || $isVendor || $isTracer) {
                continue;
            }

            $line = $frame['line'] ?? 0;
            $lines = @file($file, FILE_IGNORE_NEW_LINES) ?: [];
            $from = max(1, $line - 3);
            $to = min(count($lines), $line + 3);
            $excerpt = [];
            for ($n = $from; $n <= $to; $n++) {
                $excerpt[] = ['n' => $n, 'text' => $lines[$n - 1] ?? ''];
            }

            return SourceExcerpt::record(SourceExcerpt::relative($file), $line, $line, $excerpt);
        }

        return null;
    }

    private function explain(QueryExecuted $query): ?array
    {
        $this->explaining = true;

        try {
            $prefix = $query->connection->getDriverName() === 'sqlite' ? 'EXPLAIN QUERY PLAN ' : 'EXPLAIN ';
            $rows = $query->connection->select($prefix.$query->sql, $query->bindings);

            return array_map(fn ($row) => (array) $row, $rows);
        } catch (\Throwable) {
            return null;
        } finally {
            $this->explaining = false;
        }
    }
}
