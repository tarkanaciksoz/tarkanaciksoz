<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A flow is a real scenario told as a path through the stack: which tools a
        // request touches, in order, and why each hop is there.
        Schema::create('flows', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->string('summary');
            $table->json('steps');
            $table->boolean('visible')->default(true);
            $table->unsignedSmallInteger('position');
            $table->timestamps();

            $table->index(['visible', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flows');
    }
};
