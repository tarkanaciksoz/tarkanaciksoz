<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\TerminalCommandRequest;
use App\Terminal\Filesystem;
use App\Terminal\Persona;
use App\Terminal\ResponsesStream;
use App\Terminal\TerminalUnavailable;
use App\Tracing\Attributes\Trace;
use App\Tracing\Tracing;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TerminalController extends Controller
{
    public function __construct(private readonly ResponsesStream $model) {}

    /**
     * Run a command in the home-page terminal.
     *
     * The shell is a model playing a Debian box. The output is streamed as plain text,
     * chunk by chunk, as the model writes it. Rate limited per address and per site.
     */
    #[Trace('Terminal command', why: 'The output is streamed as it is generated, so the first characters reach the visitor before the model has finished.', kind: 'controller')]
    public function run(TerminalCommandRequest $request): StreamedResponse
    {
        $cwd = $request->validated('cwd') ?: '~';
        $command = trim($request->validated('command'));

        $input = [];
        foreach ($request->validated('history') ?? [] as $turn) {
            $input[] = ['role' => 'user', 'content' => '$ '.$turn['command']];
            $input[] = ['role' => 'assistant', 'content' => (string) ($turn['output'] ?? '')];
        }
        $input[] = ['role' => 'user', 'content' => "[cwd {$this->expand($cwd)}] \$ {$command}"];

        $instructions = Persona::instructions();

        return response()->stream(function () use ($instructions, $input) {
            $span = Tracing::begin('Model stream', 'Tokens are forwarded as they arrive; nothing is buffered on the server.', 'external', [
                'model' => config('services.openai.terminal_model'),
            ]);
            $chars = 0;

            try {
                $stream = $this->model->stream($instructions, $input);
                foreach ($stream as $delta) {
                    $chars += strlen($delta);
                    echo $delta;
                    if (ob_get_level() > 0) {
                        ob_flush();
                    }
                    flush();
                }
                Tracing::end($span, ['chars' => $chars, 'usage' => $stream->getReturn()]);
            } catch (TerminalUnavailable $e) {
                echo $e->getMessage();
                Tracing::end($span, ['error' => $e->getMessage()]);
            }
        }, 200, [
            'Content-Type' => 'text/plain; charset=utf-8',
            'Cache-Control' => 'no-cache, no-store',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * The terminal's directory tree.
     *
     * The same tree the shell answers from, so tab completion in the browser and the
     * model never disagree about what exists.
     */
    #[Trace('Terminal filesystem', why: 'One source for completion and for the shell, so they cannot drift apart.', kind: 'controller')]
    public function filesystem(): JsonResponse
    {
        return response()->json(['data' => ['home' => Filesystem::HOME, 'tree' => Filesystem::tree()]]);
    }

    private function expand(string $cwd): string
    {
        return str_starts_with($cwd, '~') ? Filesystem::HOME.substr($cwd, 1) : $cwd;
    }
}
