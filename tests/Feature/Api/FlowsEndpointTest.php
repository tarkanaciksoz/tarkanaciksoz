<?php

use App\Models\Flow;
use App\Models\StackItem;
use App\Models\StackLayer;
use Database\Seeders\PortfolioSeeder;
use Illuminate\Support\Facades\Cache;

beforeEach(fn () => Cache::flush());

it('returns flows with the stack item each step lights', function () {
    $layer = StackLayer::create(['slug' => 'data', 'name' => 'Data', 'tagline' => 't', 'glyph' => 'g', 'position' => 1]);
    $redis = StackItem::create(['stack_layer_id' => $layer->id, 'name' => 'Redis', 'why' => 'w', 'position' => 1]);
    Flow::create(['slug' => 'push', 'title' => 'Push', 'summary' => 's', 'position' => 1, 'steps' => [
        ['tool' => 'Redis', 'note' => 'Batches of 500.', 'hot' => true],
    ]]);

    $this->getJson('/api/flows')
        ->assertOk()
        ->assertJsonPath('data.0.slug', 'push')
        ->assertJsonPath('data.0.steps.0.item_id', $redis->id)
        ->assertJsonPath('data.0.steps.0.hot', true)
        ->assertJsonPath('meta.count', 1);
});

it('seeds only flows whose tools exist on the map', function () {
    $this->seed(PortfolioSeeder::class);

    $unknown = collect($this->getJson('/api/flows')->json('data'))
        ->flatMap(fn ($flow) => $flow['steps'])
        ->whereNull('item_id');

    expect(Flow::count())->toBeGreaterThan(3)->and($unknown)->toBeEmpty();
});
