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

    // Commit hash of the deployed code. Read from .git/HEAD when unset.
    'commit' => env('APP_COMMIT'),

    // Public repository the source excerpts link to, at the commit that served the request.
    'repository' => env('TRACING_REPOSITORY', 'https://github.com/tarkanaciksoz/tarkanaciksoz'),
];
