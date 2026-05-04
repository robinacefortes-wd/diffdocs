<?php

namespace App\Http\Controllers;

use App\Services\GroqService;
use App\Services\DiffService; // Added this import
use App\Events\DocGenerated;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DocController extends Controller
{
    public function index()
    {
        return Inertia::render('Dashboard');
    }

    public function process(Request $request, GroqService $groq, DiffService $diffService)
    {
        $old = $request->input('old_code') ?? '';
        $new = $request->input('new_code') ?? '';

        // 1. Calculate the actual diff if old code exists
        $rawDiff = !empty($old) ? $diffService->getRawDiff($old, $new) : null;

        // 2. Send the code + the diff to the AI
        $result = $groq->generateDocs($new, $old, $rawDiff);

        // 3. Fire the Broadcast Event (This sends data to Reverb/Websockets)
        broadcast(new DocGenerated($result));

        // 4. Return the data to the frontend props
        return Inertia::render('Dashboard', [
            'technical_docs' => $result['technical_docs'] ?? 'Error generating docs.',
            'pr_summary'     => $result['pr_summary'] ?? 'Error generating summary.',
            'old_code'       => $old,
            'new_code'       => $new,
        ]);
    }
}