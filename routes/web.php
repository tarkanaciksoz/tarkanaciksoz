<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// The site is one public page; everything on it comes from routes/api.php.
Route::get('/', fn () => Inertia::render('home'))->name('home');
