<?php

namespace App\Tracing\Attributes;

use Attribute;

/**
 * Explains a unit of work where it lives: on the method or closure that does it.
 * The tracer reads it at runtime and ships it with the span, so the explanation
 * a visitor reads on the anatomy page is the one written next to the code.
 */
#[Attribute(Attribute::TARGET_METHOD | Attribute::TARGET_FUNCTION)]
final class Trace
{
    public function __construct(
        public readonly string $what,
        public readonly ?string $why = null,
        public readonly string $kind = 'custom',
    ) {}
}
