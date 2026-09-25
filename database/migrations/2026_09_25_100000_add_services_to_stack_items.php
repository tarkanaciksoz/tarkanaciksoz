<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stack_items', function (Blueprint $table) {
            // How many services use this tool, when it was actually counted. Null means
            // "not counted", which the views draw differently rather than guessing.
            $table->unsignedSmallInteger('services')->nullable()->after('usage');
        });
    }

    public function down(): void
    {
        Schema::table('stack_items', function (Blueprint $table) {
            $table->dropColumn('services');
        });
    }
};
