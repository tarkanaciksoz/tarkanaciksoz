<?php

return [
    // Record a trace for every API request and expose its id in the response header.
    'enabled' => env('TRACING_ENABLED', true),

    // How long a stored trace stays readable through GET /api/traces/{id}.
    'ttl_minutes' => (int) env('TRACING_TTL_MINUTES', 1440),

    // Run EXPLAIN for SELECT statements and attach the plan to the query span.
    'explain' => env('TRACING_EXPLAIN', true),

    // Response header carrying the trace id. nginx's X-Request-Id is reused when present.
    'header' => 'X-Trace-Id',

    // Short commit hash of the deployed code. Falls back to `git rev-parse` when unset.
    'commit' => env('APP_COMMIT'),
];
