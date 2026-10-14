<?php

it('serves one public page and no account pages', function () {
    $this->get('/')->assertOk();

    foreach (['/login', '/register', '/dashboard', '/forgot-password', '/settings/profile'] as $path) {
        $this->get($path)->assertNotFound();
    }
});

it('shares nothing a visitor has no use for', function () {
    $page = $this->get('/')->assertOk()->viewData('page');

    expect($page['props'])->not->toHaveKeys(['quote', 'auth', 'ziggy']);
});
