<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Tracing\Attributes\Trace;
use Illuminate\Http\JsonResponse;

class ProfileController extends Controller
{
    /**
     * Who I am.
     *
     * The short version the home page reads: role, location, focus and links.
     */
    #[Trace('Profile', why: 'Config-backed rather than a table: it changes with a deploy, not from a panel.', kind: 'controller')]
    public function show(): JsonResponse
    {
        return response()->json(['data' => config('profile')]);
    }
}
