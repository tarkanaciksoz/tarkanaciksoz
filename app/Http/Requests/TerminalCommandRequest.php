<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TerminalCommandRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'command' => ['required', 'string', 'max:300'],
            'cwd' => ['nullable', 'string', 'max:120', 'regex:#^[~/A-Za-z0-9._\-/]*$#'],
            'history' => ['nullable', 'array', 'max:6'],
            'history.*.command' => ['required', 'string', 'max:300'],
            'history.*.output' => ['nullable', 'string', 'max:800'],
        ];
    }
}
