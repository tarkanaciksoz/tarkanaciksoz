<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class RateLimitServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        RateLimiter::for('public', fn (Request $request) => Limit::perMinute(60)->by($request->ip()));

        // A public endpoint in front of a paid model: cap each address, and cap the whole site.
        RateLimiter::for('terminal', fn (Request $request) => [
            Limit::perMinute((int) env('TERMINAL_PER_MINUTE', 15))->by('m:'.$request->ip()),
            Limit::perDay((int) env('TERMINAL_PER_DAY', 200))->by('d:'.$request->ip()),
            Limit::perDay((int) env('TERMINAL_SITE_PER_DAY', 3000))->by('site'),
        ]);
    }
}
