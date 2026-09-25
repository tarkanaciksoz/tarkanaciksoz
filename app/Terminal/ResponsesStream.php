<?php

namespace App\Terminal;

use Generator;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Streams a Responses API call and yields the output text as it arrives.
 * The generator's return value is the usage block from the final event.
 */
final class ResponsesStream
{
    /**
     * @param  list<array{role:string, content:string}>  $input
     * @return Generator<int, string, mixed, array<string, mixed>>
     */
    public function stream(string $instructions, array $input): Generator
    {
        $key = config('services.openai.key');
        if (! $key) {
            throw new TerminalUnavailable('glassbox: shell backend offline (no API key configured)');
        }

        try {
            $response = Http::withToken($key)
                ->withOptions(['stream' => true])
                ->timeout(config('services.openai.timeout'))
                ->acceptJson()
                ->post(rtrim(config('services.openai.base_url'), '/').'/responses', [
                    'model' => config('services.openai.terminal_model'),
                    'instructions' => $instructions,
                    'input' => $input,
                    'stream' => true,
                    'store' => false,
                    'max_output_tokens' => config('services.openai.terminal_max_output_tokens'),
                    'reasoning' => ['effort' => 'none'],
                ]);
        } catch (ConnectionException) {
            throw new TerminalUnavailable('glassbox: connection timed out');
        }

        if (! $response->successful()) {
            throw new TerminalUnavailable('glassbox: upstream returned '.$response->status());
        }

        $body = $response->toPsrResponse()->getBody();
        $buffer = '';
        $usage = [];

        while (! $body->eof()) {
            $buffer .= $body->read(1024);

            while (($newline = strpos($buffer, "\n")) !== false) {
                $line = rtrim(substr($buffer, 0, $newline), "\r");
                $buffer = substr($buffer, $newline + 1);

                if (! str_starts_with($line, 'data:')) {
                    continue;
                }

                $event = json_decode(trim(substr($line, 5)), true);
                if (! is_array($event)) {
                    continue;
                }

                match ($event['type'] ?? null) {
                    'response.output_text.delta' => yield (string) ($event['delta'] ?? ''),
                    'response.completed' => $usage = $event['response']['usage'] ?? [],
                    'error', 'response.failed' => throw new TerminalUnavailable('glassbox: stream interrupted'),
                    default => null,
                };
            }
        }

        return $usage;
    }
}
