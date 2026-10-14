<?php

use Database\Seeders\PortfolioSeeder;
use Illuminate\Support\Facades\Cache;

beforeEach(function () {
    Cache::flush();
    $this->seed(PortfolioSeeder::class);
});

it('points every tool mark at a file that is really served, and draws the rest as monograms', function () {
    $items = collect($this->getJson('/api/stack')->assertOk()->json('data'))->flatMap(fn (array $layer) => $layer['items']);

    expect($items->every(fn (array $item) => array_key_exists('icon', $item)))->toBeTrue();
    $items->pluck('icon')->filter()->each(fn (string $path) => expect(public_path($path))->toBeFile());
});
