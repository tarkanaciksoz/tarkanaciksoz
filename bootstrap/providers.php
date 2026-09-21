<?php

use App\Providers\AppServiceProvider;
use App\Providers\RateLimitServiceProvider;
use App\Tracing\TracingServiceProvider;

return [
    AppServiceProvider::class,
    RateLimitServiceProvider::class,
    TracingServiceProvider::class,
];
