<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stack_layers', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('name');
            $table->string('tagline');
            $table->string('glyph', 32);
            $table->unsignedSmallInteger('position')->index();
            $table->timestamps();
        });

        Schema::create('stack_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stack_layer_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('usage')->nullable();
            $table->text('why');
            $table->text('instead_of')->nullable();
            $table->boolean('visible')->default(true);
            $table->unsignedSmallInteger('position');
            $table->timestamps();

            $table->index(['visible', 'stack_layer_id', 'position'], 'idx_stack_visible_layer_pos');
        });

        Schema::create('systems', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->string('summary');
            $table->text('problem');
            $table->text('approach');
            $table->text('lesson')->nullable();
            $table->json('tags');
            $table->string('scale')->nullable();
            $table->boolean('visible')->default(true);
            $table->unsignedSmallInteger('position');
            $table->timestamps();

            $table->index(['visible', 'position']);
        });

        Schema::create('decisions', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('body');
            $table->boolean('visible')->default(true);
            $table->unsignedSmallInteger('position');
            $table->timestamps();

            $table->index(['visible', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('decisions');
        Schema::dropIfExists('systems');
        Schema::dropIfExists('stack_items');
        Schema::dropIfExists('stack_layers');
    }
};
