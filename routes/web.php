<?php

use App\Http\Controllers\DocController;
use Illuminate\Support\Facades\Route;

Route::get('/', [DocController::class, 'index'])->name('home');
Route::post('/process', [DocController::class, 'process'])->name('docs.process');
Route::get('/process', fn() => redirect('/'));