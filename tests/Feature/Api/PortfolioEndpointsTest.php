<?php

use App\Models\Decision;
use App\Models\System;
use Illuminate\Support\Facades\Cache;

beforeEach(fn () => Cache::flush());

it('describes who the site belongs to', function () {
    $this->getJson('/api/profile')
        ->assertOk()
        ->assertJsonStructure(['data' => ['name', 'role', 'location', 'headline', 'intro', 'focus', 'links']]);
});

it('returns systems in the order they are meant to be read', function () {
    System::create(['slug' => 'second', 'title' => 'Second', 'summary' => 's', 'problem' => 'p', 'approach' => 'a', 'tags' => ['x'], 'position' => 2]);
    System::create(['slug' => 'first', 'title' => 'First', 'summary' => 's', 'problem' => 'p', 'approach' => 'a', 'tags' => ['x'], 'position' => 1]);

    $this->getJson('/api/systems')
        ->assertOk()
        ->assertJsonPath('data.0.slug', 'first')
        ->assertJsonPath('meta.count', 2);
});

it('leaves hidden systems out', function () {
    System::create(['slug' => 'draft', 'title' => 'Draft', 'summary' => 's', 'problem' => 'p', 'approach' => 'a', 'tags' => [], 'position' => 1, 'visible' => false]);

    $this->getJson('/api/systems')->assertOk()->assertJsonPath('meta.count', 0);
});

it('returns the operating decisions', function () {
    Decision::create(['title' => 'ARM by default', 'body' => 'Cheaper for the same work.', 'position' => 1]);

    $this->getJson('/api/decisions')->assertOk()->assertJsonPath('data.0.title', 'ARM by default');
});

it('publishes an OpenAPI document for the whole API', function () {
    $document = $this->getJson('/docs/api.json')->assertOk()->json();

    expect(array_keys($document['paths']))->toContain('/stack', '/systems', '/decisions', '/profile', '/traces/{id}');
});
