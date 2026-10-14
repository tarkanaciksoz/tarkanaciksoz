<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stack_items', function (Blueprint $table) {
            // Public path of the tool's brand mark, when one exists; null draws a monogram.
            $table->string('icon')->nullable()->after('name');
        });
    }

    public function down(): void
    {
        Schema::table('stack_items', function (Blueprint $table) {
            $table->dropColumn('icon');
        });
    }
};
