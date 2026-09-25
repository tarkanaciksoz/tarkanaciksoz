<?php

use App\Models\StackItem;
use App\Models\StackLayer;
use Illuminate\Support\Facades\Cache;

beforeEach(function () {
    Cache::flush();

    $layer = StackLayer::create(['slug' => 'data', 'name' => 'Data', 'tagline' => 'where state lives', 'glyph' => 'cylinder', 'position' => 1]);

    StackItem::create([
        'stack_layer_id' => $layer->id,
        'name' => 'MySQL',
        'usage' => 'one database per app',
        'services' => 12,
        'why' => 'Per-app databases keep the blast radius small.',
        'instead_of' => 'One shared schema.',
        'visible' => true,
        'position' => 1,
    ]);

    StackItem::create([
        'stack_layer_id' => $layer->id,
        'name' => 'Draft tool',
        'why' => 'Not ready to show.',
        'visible' => false,
        'position' => 2,
    ]);
});

it('returns layers with their visible items', function () {
    $response = $this->getJson('/api/stack');

    $response->assertOk()
        ->assertJsonPath('data.0.slug', 'data')
        ->assertJsonPath('data.0.items.0.name', 'MySQL')
        ->assertJsonPath('meta.layers', 1)
        ->assertJsonPath('meta.items', 1);
});

it('serves the counted services, and null where nothing was counted', function () {
    $response = $this->getJson('/api/stack');

    $response->assertJsonPath('data.0.items.0.services', 12)
        ->assertJsonPath('meta.counted', 1);
});

it('hides items that are not visible', function () {
    $names = collect($this->getJson('/api/stack')->json('data.0.items'))->pluck('name');

    expect($names)->not->toContain('Draft tool');
});

it('reports a cache miss first and a hit afterwards', function () {
    expect($this->getJson('/api/stack')->json('meta.cache'))->toBe('miss');
    expect($this->getJson('/api/stack')->json('meta.cache'))->toBe('hit');
});

it('serves the second request without touching the database', function () {
    $this->getJson('/api/stack');

    $queries = 0;
    DB::listen(function () use (&$queries) {
        $queries++;
    });

    $this->getJson('/api/stack')->assertOk();

    expect($queries)->toBe(0);
});
