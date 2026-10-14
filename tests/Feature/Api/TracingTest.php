<?php

use App\Models\StackLayer;
use Illuminate\Support\Facades\Cache;

beforeEach(function () {
    Cache::flush();
    StackLayer::create(['slug' => 'data', 'name' => 'Data', 'tagline' => 'where state lives', 'glyph' => 'cylinder', 'position' => 1]);
});

it('returns a trace id with every API response', function () {
    $this->getJson('/api/stack')->assertOk()->assertHeader('X-Trace-Id');
});

it('records the spans of a request under that id', function () {
    $response = $this->getJson('/api/stack');
    $id = $response->headers->get('X-Trace-Id');

    $trace = $this->getJson("/api/traces/{$id}")->assertOk()->json('data');

    expect($trace['path'])->toBe('/api/stack')
        ->and($trace['status'])->toBe(200)
        ->and($trace['duration_ms'])->toBeGreaterThan(0)
        ->and(collect($trace['spans'])->pluck('kind'))->toContain('controller', 'repository', 'query');
});

it('explains a span with the text written next to the code', function () {
    $id = $this->getJson('/api/stack')->headers->get('X-Trace-Id');

    $controller = collect($this->getJson("/api/traces/{$id}")->json('data.spans'))
        ->firstWhere('kind', 'controller');

    expect($controller['name'])->toBe('Stack map')
        ->and($controller['why'])->toContain('safe to cache')
        ->and($controller['source']['file'])->toBe('app/Http/Controllers/Api/StackController.php')
        ->and($controller['source']['excerpt'])->not->toBeEmpty();
});

it('carries the sql and its query plan on query spans', function () {
    $id = $this->getJson('/api/stack')->headers->get('X-Trace-Id');

    $query = collect($this->getJson("/api/traces/{$id}")->json('data.spans'))
        ->firstWhere('kind', 'query');

    expect($query['meta']['sql'])->toContain('select')
        ->and($query['meta']['explain'])->toBeArray()
        ->and($query['source']['file'])->toBe('app/Repositories/StackRepository.php');
});

it('keeps cache and framework plumbing out of the trace', function () {
    $id = $this->getJson('/api/stack')->headers->get('X-Trace-Id');

    $statements = collect($this->getJson("/api/traces/{$id}")->json('data.spans'))
        ->where('kind', 'query')
        ->pluck('meta.sql')
        ->implode(' ');

    expect($statements)->not->toContain('"cache"');
});

it('accounts for the time the spans did not claim', function () {
    $id = $this->getJson('/api/stack')->headers->get('X-Trace-Id');
    $trace = $this->getJson("/api/traces/{$id}")->json('data');

    expect($trace['leaf_ms'] + $trace['unattributed_ms'])->toEqualWithDelta($trace['duration_ms'], 0.01);
});

it('stores the browser timings the server cannot see', function () {
    $id = $this->getJson('/api/stack')->headers->get('X-Trace-Id');

    $this->postJson("/api/traces/{$id}/client-timing", [
        'dns_ms' => 18, 'tcp_ms' => 12, 'tls_ms' => 14, 'ttfb_ms' => 160, 'download_ms' => 3, 'total_ms' => 207,
    ])->assertOk();

    expect($this->getJson("/api/traces/{$id}")->json('data.client.ttfb_ms'))->toEqual(160);
});

it('rejects client timings that are not numbers', function () {
    $id = $this->getJson('/api/stack')->headers->get('X-Trace-Id');

    $this->postJson("/api/traces/{$id}/client-timing", ['dns_ms' => 'fast'])->assertStatus(422);
});

it('says so when a trace has expired', function () {
    $this->getJson('/api/traces/01JQQQQQQQQQQQQQQQQQQQQQQQ')->assertNotFound();
});

it('links the source it shows to that commit on the public repository', function () {
    $commit = str_repeat('a1', 20);
    config(['tracing.commit' => $commit, 'tracing.repository' => 'https://github.com/owner/repo']);

    $id = $this->getJson('/api/stack')->headers->get('X-Trace-Id');
    $trace = $this->getJson("/api/traces/{$id}")->json('data');
    $controller = collect($trace['spans'])->firstWhere('kind', 'controller');
    $query = collect($trace['spans'])->firstWhere('kind', 'query');
    $source = $controller['source'];

    expect($trace['commit'])->toBe('a1a1a1a')
        ->and($trace['commit_url'])->toBe("https://github.com/owner/repo/commit/{$commit}")
        ->and($trace['files_url'])->toBe("https://github.com/owner/repo/blob/{$commit}")
        ->and($source['url'])->toBe("https://github.com/owner/repo/blob/{$commit}/app/Http/Controllers/Api/StackController.php#L{$source['line_start']}-L{$source['line_end']}")
        ->and($query['source']['url'])->toBe("https://github.com/owner/repo/blob/{$commit}/app/Repositories/StackRepository.php#L{$query['source']['line_start']}");
});
