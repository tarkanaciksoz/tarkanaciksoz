<?php

use App\Models\Decision;
use App\Models\Flow;
use App\Models\StackItem;
use App\Models\StackLayer;
use App\Models\System;
use Database\Seeders\PortfolioSeeder;

it('removes on a re-seed whatever the content files no longer name', function () {
    $this->seed(PortfolioSeeder::class);
    $counts = fn () => [StackLayer::count(), StackItem::count(), System::count(), Flow::count(), Decision::count()];
    $before = $counts();

    $layer = StackLayer::create(['slug' => 'gone', 'name' => 'Gone', 'tagline' => 'renamed away', 'glyph' => 'code', 'position' => 99]);
    $layer->items()->create(['name' => 'Old tool', 'usage' => 'nowhere', 'why' => 'renamed', 'position' => 1, 'visible' => true]);
    StackLayer::where('slug', 'app')->first()->items()->create(['name' => 'Retired tool', 'usage' => 'nowhere', 'why' => 'gone', 'position' => 99, 'visible' => true]);
    System::create(['slug' => 'retired', 'title' => 'Retired', 'summary' => 's', 'problem' => 'p', 'approach' => 'a', 'tags' => [], 'position' => 99, 'visible' => true]);
    Flow::create(['slug' => 'retired', 'title' => 'Retired', 'summary' => 's', 'steps' => [], 'position' => 99, 'visible' => true]);
    Decision::create(['title' => 'Retired rule', 'body' => 'b', 'position' => 99, 'visible' => true]);

    $this->seed(PortfolioSeeder::class);

    expect($counts())->toBe($before)
        ->and(StackItem::where('name', 'Retired tool')->exists())->toBeFalse();
});
