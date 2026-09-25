<?php

use App\Models\System;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\RateLimiter;

function sse(array $deltas): string
{
    $out = "event: response.created\ndata: {\"type\":\"response.created\"}\n\n";
    foreach ($deltas as $delta) {
        $out .= "event: response.output_text.delta\ndata: ".json_encode(['type' => 'response.output_text.delta', 'delta' => $delta])."\n\n";
    }

    return $out."event: response.completed\ndata: {\"type\":\"response.completed\",\"response\":{\"usage\":{\"output_tokens\":7}}}\n\n";
}

beforeEach(function () {
    config(['services.openai.key' => 'test-key', 'services.openai.terminal_model' => 'gpt-5.6-luna']);
    RateLimiter::clear('m:127.0.0.1');
    System::create(['slug' => 'payments', 'title' => 'Payments', 'summary' => 'Store webhooks in, typed events out.', 'problem' => 'p', 'approach' => 'a', 'tags' => [], 'position' => 1]);
});

it('streams the model output back as plain text', function () {
    Http::fake(['api.openai.com/*' => Http::response(sse(['README.md  ', 'stack.json', "\n"]), 200, ['Content-Type' => 'text/event-stream'])]);

    $response = $this->post('/api/terminal', ['command' => 'ls']);

    $response->assertOk()->assertHeader('Content-Type', 'text/plain; charset=utf-8');
    expect($response->streamedContent())->toBe("README.md  stack.json\n");
});

it('asks the configured model, without storing the conversation', function () {
    Http::fake(['api.openai.com/*' => Http::response(sse(['ok']), 200)]);

    $this->post('/api/terminal', ['command' => 'pwd', 'cwd' => '~/systems'])->streamedContent();

    Http::assertSent(function (Request $request) {
        $body = $request->data();

        return $body['model'] === 'gpt-5.6-luna'
            && $body['stream'] === true
            && $body['store'] === false
            && $body['reasoning'] === ['effort' => 'none']
            && str_contains(end($body['input'])['content'], '[cwd /home/guest/systems] $ pwd');
    });
});

it('keeps the shell in character and grounds it in the site data', function () {
    Http::fake(['api.openai.com/*' => Http::response(sse(['ok']), 200)]);

    $this->post('/api/terminal', ['command' => 'cat systems/payments.md'])->streamedContent();

    Http::assertSent(function (Request $request) {
        $instructions = $request->data()['instructions'];

        return str_contains($instructions, 'Never say you are an AI')
            && str_contains($instructions, 'payments.md: Payments. Store webhooks in, typed events out.');
    });
});

it('replays the recent session so the shell stays consistent', function () {
    Http::fake(['api.openai.com/*' => Http::response(sse(['ok']), 200)]);

    $this->post('/api/terminal', [
        'command' => 'ls',
        'history' => [['command' => 'cd systems', 'output' => '']],
    ])->streamedContent();

    Http::assertSent(fn (Request $request) => $request->data()['input'][0] === ['role' => 'user', 'content' => '$ cd systems']);
});

it('prints a shell error when no key is configured', function () {
    config(['services.openai.key' => null]);
    Http::fake();

    expect($this->post('/api/terminal', ['command' => 'ls'])->streamedContent())->toContain('backend offline');
    Http::assertNothingSent();
});

it('prints a shell error when the upstream fails', function () {
    Http::fake(['api.openai.com/*' => Http::response('nope', 500)]);

    expect($this->post('/api/terminal', ['command' => 'ls'])->streamedContent())->toContain('upstream returned 500');
});

it('rejects empty and oversized commands', function () {
    $this->postJson('/api/terminal', ['command' => ''])->assertStatus(422);
    $this->postJson('/api/terminal', ['command' => str_repeat('a', 301)])->assertStatus(422);
});

it('rate limits each address', function () {
    config(['services.openai.key' => null]);
    Http::fake();

    foreach (range(1, 15) as $i) {
        $this->post('/api/terminal', ['command' => 'ls'])->assertOk();
    }

    $this->postJson('/api/terminal', ['command' => 'ls'])->assertStatus(429);
});

it('serves the same tree the shell answers from', function () {
    $this->getJson('/api/terminal/fs')
        ->assertOk()
        ->assertJsonPath('data.home', '/home/guest')
        ->assertJsonPath('data.tree./home/guest/systems.0', 'payments.md');
});
