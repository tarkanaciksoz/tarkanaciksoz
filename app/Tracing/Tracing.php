<?php

namespace App\Tracing;

use App\Tracing\Attributes\Trace;
use Closure;
use ReflectionFunction;
use ReflectionFunctionAbstract;
use ReflectionMethod;

/**
 * The small static surface application code uses:
 *
 *   Tracing::call([$repo, 'visible']);            // runs a #[Trace]-annotated method inside a span
 *   Tracing::span(#[Trace('...')] fn () => ..., ); // same for a closure
 *   $s = Tracing::begin(...); ...; Tracing::end($s, ['hit' => true]);
 */
final class Tracing
{
    public static function tracer(): Tracer
    {
        return app(Tracer::class);
    }

    public static function begin(string $name, ?string $why = null, string $kind = 'custom', array $meta = []): ?Span
    {
        $tracer = self::tracer();

        return $tracer->active() ? $tracer->begin($name, $why, $kind, $meta) : null;
    }

    public static function end(?Span $span, array $meta = []): void
    {
        if ($span) {
            self::tracer()->end($span, $meta);
        }
    }

    /** Run a callable inside a span described by its #[Trace] attribute (or the given name). */
    public static function call(callable $callable, ?string $name = null, ?string $why = null, ?string $kind = null, array $meta = [], mixed ...$args): mixed
    {
        $tracer = self::tracer();
        if (! $tracer->active()) {
            return $callable(...$args);
        }

        $ref = self::reflect($callable);
        $attr = $ref ? (($ref->getAttributes(Trace::class)[0] ?? null)?->newInstance()) : null;

        $span = $tracer->begin(
            $name ?? $attr?->what ?? self::nameOf($callable),
            $why ?? $attr?->why,
            $kind ?? $attr?->kind ?? 'custom',
            $meta,
            $ref ? SourceExcerpt::for($ref) : null,
        );

        try {
            return $callable(...$args);
        } finally {
            $tracer->end($span);
        }
    }

    public static function span(Closure $closure, ?string $name = null, ?string $why = null, ?string $kind = null, array $meta = []): mixed
    {
        return self::call($closure, $name, $why, $kind, $meta);
    }

    private static function reflect(callable $callable): ?ReflectionFunctionAbstract
    {
        try {
            if ($callable instanceof Closure) {
                return new ReflectionFunction($callable);
            }
            if (is_array($callable)) {
                return new ReflectionMethod($callable[0], $callable[1]);
            }
            if (is_string($callable) && str_contains($callable, '::')) {
                return new ReflectionMethod($callable);
            }
            if (is_object($callable)) {
                return new ReflectionMethod($callable, '__invoke');
            }
        } catch (\ReflectionException) {
            return null;
        }

        return null;
    }

    private static function nameOf(callable $callable): string
    {
        if (is_array($callable)) {
            return class_basename(is_object($callable[0]) ? $callable[0]::class : $callable[0]).'::'.$callable[1];
        }

        return 'closure';
    }
}
