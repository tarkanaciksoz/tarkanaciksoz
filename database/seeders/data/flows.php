<?php

// Scenarios through the stack. Tool names must match stack items exactly; the seeder
// refuses a flow that points at a tool the map does not have.
return [
    [
        'slug' => 'generate',
        'title' => 'Turn a photo into an AI image',
        'summary' => 'The request comes back in milliseconds. The work takes a minute.',
        'steps' => [
            ['tool' => 'iOS', 'note' => 'The app uploads a photo and picks a style.'],
            ['tool' => 'Cloudflare', 'note' => 'TLS ends at the edge; the origin address is never public.'],
            ['tool' => 'nginx', 'note' => 'Hands the request to a worker that is already booted.'],
            ['tool' => 'Octane · Swoole', 'note' => 'No framework boot per request on the busy apps.'],
            ['tool' => 'Sanctum · JWT', 'note' => 'A device token says who is asking, with no login screen.'],
            ['tool' => 'S3', 'note' => 'The original is stored before anything else happens.'],
            ['tool' => 'Redis', 'note' => 'A job is queued and the request returns. The phone is not kept waiting.'],
            ['tool' => 'Replicate · fal', 'note' => 'The model runs for ten seconds to two minutes. This is the slow hop.', 'hot' => true],
            ['tool' => 'libvips · ffmpeg', 'note' => 'Resized and optimised once, on write, never on read.'],
            ['tool' => 'Firebase FCM', 'note' => 'A push tells the phone the result is ready.'],
        ],
    ],
    [
        'slug' => 'renew',
        'title' => 'Renew a subscription',
        'summary' => 'A store notification becomes one typed event and one database write.',
        'steps' => [
            ['tool' => 'App Store · Google Play', 'note' => 'The store reports a renewal, a refund or a grace period.'],
            ['tool' => 'Cloudflare', 'note' => 'Webhooks come through the same edge as users.'],
            ['tool' => 'Laravel 12', 'note' => 'The purchase package maps 17 kinds of store event to typed ones.'],
            ['tool' => 'Adapty', 'note' => 'Reconciled with the subscription platform so both agree.', 'hot' => true],
            ['tool' => 'MySQL 8', 'note' => 'The entitlement lands in the app’s own database.'],
            ['tool' => 'Redis', 'note' => 'The cached profile is dropped so the next request sees the change.'],
            ['tool' => 'Nightwatch', 'note' => 'A failed renewal shows up as an exception, not a support ticket.'],
        ],
    ],
    [
        'slug' => 'push',
        'title' => 'Push to a million devices',
        'summary' => 'One notification class, a queue, and workers that do not give up.',
        'steps' => [
            ['tool' => 'Laravel 12', 'note' => 'One notification class; the provider is a driver switch in the environment.'],
            ['tool' => 'Redis', 'note' => 'Devices are sliced into batches of 500 and queued.'],
            ['tool' => 'Supervisor · PM2', 'note' => 'Workers drain the queue in parallel and restart if they die.'],
            ['tool' => 'Firebase FCM', 'note' => 'The OAuth token is refreshed five minutes before it expires, not after.', 'hot' => true],
            ['tool' => 'iOS', 'note' => 'Delivered.'],
            ['tool' => 'Android', 'note' => 'Delivered.'],
            ['tool' => 'Nightwatch', 'note' => 'The real bug was silent failure. Now failures are loud.'],
        ],
    ],
    [
        'slug' => 'dashboard',
        'title' => 'Open a dashboard without touching production',
        'summary' => 'Thirty-second aggregates, now under one second, and production never sees them.',
        'steps' => [
            ['tool' => 'Web · React', 'note' => 'The control plane asks for last month’s revenue across apps.'],
            ['tool' => 'Cloudflare', 'note' => 'Same edge, same rules.'],
            ['tool' => 'Laravel 12', 'note' => 'The API switches its database connection per request.'],
            ['tool' => 'ClickHouse', 'note' => 'The aggregate runs on a column store and returns in under a second.', 'hot' => true],
            ['tool' => 'PeerDB', 'note' => 'Change data capture keeps that copy seconds behind production.'],
            ['tool' => 'MySQL 8', 'note' => 'Production never runs the analytics query.'],
        ],
    ],
    [
        'slug' => 'deploy',
        'title' => 'Ship a deploy',
        'summary' => 'From a tag on main to traffic on new tasks, with nothing dropped.',
        'steps' => [
            ['tool' => 'GitLab CI · Envoy', 'note' => 'A tag on main and a manual production job.'],
            ['tool' => 'Docker', 'note' => 'An arm64 image with the dependencies baked in.'],
            ['tool' => 'ECS · ECR', 'note' => 'Pushed to the registry; the task definition gets a new revision.'],
            ['tool' => 'AWS EC2 · Graviton', 'note' => 'New tasks start on Graviton instances.'],
            ['tool' => 'Load balancer', 'note' => 'Traffic moves once health checks pass; old tasks drain first.', 'hot' => true],
            ['tool' => 'Slack alerts', 'note' => 'The channel hears about it before anyone asks.'],
        ],
    ],
    [
        'slug' => 'incident',
        'title' => 'Something breaks at 3 a.m.',
        'summary' => 'From a memory graph to the line of code, and back to a flat graph.',
        'steps' => [
            ['tool' => 'Zabbix', 'note' => 'Memory on one box crosses its threshold.'],
            ['tool' => 'Slack alerts', 'note' => 'The alert lands in the channel.'],
            ['tool' => 'Telegram', 'note' => '…and on the phone that has to wake up.'],
            ['tool' => 'Nightwatch', 'note' => 'The trace names the route, the job and the query.'],
            ['tool' => 'MySQL 8', 'note' => 'A cache had fallen back to the database and was eating connections.', 'hot' => true],
            ['tool' => 'Redis', 'note' => 'Cache moved back to Redis, connections capped, graph flat again.'],
        ],
    ],
];
