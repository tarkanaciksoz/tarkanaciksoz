<?php

use App\Http\Controllers\Api\DecisionController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\StackController;
use App\Http\Controllers\Api\SystemController;
use App\Http\Controllers\Api\TerminalController;
use App\Http\Controllers\Api\TraceController;
use Illuminate\Support\Facades\Route;

Route::get('profile', [ProfileController::class, 'show'])->name('api.profile');
Route::get('stack', [StackController::class, 'index'])->name('api.stack');
Route::get('systems', [SystemController::class, 'index'])->name('api.systems');
Route::get('decisions', [DecisionController::class, 'index'])->name('api.decisions');

Route::get('traces/{id}', [TraceController::class, 'show'])->name('api.traces.show');
Route::post('traces/{id}/client-timing', [TraceController::class, 'storeClientTiming'])->name('api.traces.client');

Route::get('terminal/fs', [TerminalController::class, 'filesystem'])->name('api.terminal.fs');
Route::post('terminal', [TerminalController::class, 'run'])->middleware('throttle:terminal')->name('api.terminal');
