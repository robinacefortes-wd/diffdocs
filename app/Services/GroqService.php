<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GroqService
{
    protected string $apiKey;
    protected string $baseUrl = 'https://api.groq.com/openai/v1/chat/completions';

    public function __construct()
    {
        $this->apiKey = config('services.groq.key') ?? '';
    }

    public function generateDocs(string $code, string $oldCode = null, string $diff = null)
    {
        $prompt = $this->buildPrompt($code, $oldCode, $diff);

        try {
            return $this->sendRequest($prompt);
        } catch (\Exception $e) {
            Log::error("Groq API Error: " . $e->getMessage());

            return [
                'technical_docs' => "Error: " . $e->getMessage(),
                'pr_summary'     => "Could not generate summary due to a connection issue.",
            ];
        }
    }

    protected function buildPrompt(string $code, ?string $oldCode, ?string $diff): string
    {
        $prompt = "";

        if ($oldCode) {
            $prompt .= "ORIGINAL CODE:\n```\n$oldCode\n```\n\n";
        }

        if ($diff) {
            $prompt .= "RAW GIT DIFF:\n```\n$diff\n```\n\n";
        }

        $prompt .= "UPDATED CODE:\n```\n$code\n```\n\n";

        $prompt .= 'You are a Senior Software Engineer at a professional software agency. '
            . 'Analyze the code change above and return a JSON object with exactly two keys: "technical_docs" and "pr_summary".' . "\n\n"

            . "CRITICAL JSON RULES — follow exactly or the response will be rejected:\n"
            . "- Output must be a single valid JSON object and nothing else\n"
            . "- Use double quotes for all strings — never triple quotes, never single quotes\n"
            . "- Escape all newlines inside string values as \\n\n"
            . "- Escape all double quotes inside string values as \\\"\n"
            . "- Escape all backticks inside string values as \`\n"
            . "- Do not add trailing commas\n\n"

            . "---\n\n"

            . "For \"technical_docs\", write entirely in flowing prose paragraphs. No bullet points anywhere. No tables. No bold text. No emojis. No markdown headers with #. Use plain section labels followed by a colon on their own line instead.\n\n"
            . "Follow this exact structure, where every section body is a single paragraph of 4-6 complete sentences:\n\n"
            . "Overview\\n"
            . "[Write 4-6 sentences as a single unbroken paragraph. Describe the purpose, intent, and architectural significance of the change. Explain what problem it solves or what improvement it introduces. Provide enough context that a developer unfamiliar with the codebase can understand why this change exists. Do not use bullet points, lists, or line breaks within the paragraph.]\\n\\n"
            . "Implementation Details\\n"
            . "[Write 4-6 sentences as a single unbroken paragraph. Describe exactly what was changed at the code level, naming the specific functions, classes, methods, or patterns involved. Explain how each modified component works after the change and how the pieces interact. Avoid vague descriptions — be precise about the mechanics of the implementation.]\\n\\n"
            . "Technical Considerations\\n"
            . "[Write 4-6 sentences as a single unbroken paragraph. Cover side effects, dependencies, edge cases, or anything a reviewer or future maintainer should be aware of. Discuss any trade-offs made, assumptions embedded in the implementation, or areas that may require follow-up. If nothing notable exists, write about how the change aligns with existing code style, patterns, or conventions in the codebase.]\n\n"

            . "---\n\n"

            . "For \"pr_summary\", write in a clean professional tone. No emojis. No bold text. No markdown symbols. Use plain section labels followed by a colon on their own line.\n\n"
            . "Follow this exact structure:\n\n"
            . "Summary\\n"
            . "[One clear sentence stating what this PR does and the reason for the change.]\\n\\n"
            . "Changes\\n"
            . "- [Specific change #1 — name the function, class, or file affected.]\\n"
            . "- [Specific change #2.]\\n"
            . "- [Specific change #3 if applicable.]\\n\\n"
            . "Impact\\n"
            . "- [One concrete benefit per bullet, e.g. reduced cognitive overhead, improved type safety, better testability.]\\n"
            . "- [Another benefit if applicable.]\\n\n\n"

            . "---\n\n"

            . "Strict style rules for both outputs:\n"
            . "- No emojis of any kind\n"
            . "- No bold text — do not use ** or __\n"
            . "- No markdown tables\n"
            . "- No # headers — use plain text labels with a colon instead\n"
            . "- For technical_docs: write bullets as full sentences, not fragments\n"
            . "- Be specific and technical — name real classes, methods, and patterns\n"
            . "- Do not invent changes not present in the code\n"
            . "- Do not use vague filler phrases like 'improved the code' or 'better approach'\n";

        return $prompt;
    }

    protected function sendRequest(string $prompt)
    {
        $response = Http::withToken($this->apiKey)
            ->timeout(60)
            ->retry(2, 1000) // Retry once after 1 second on failure — fixes the inconsistency issue
            ->post($this->baseUrl, [
                'model'       => 'llama-3.3-70b-versatile',
                'temperature' => 0.3, // Lower temperature = more consistent, deterministic output
                'messages'    => [
                    [
                        'role'    => 'system',
                        'content' => 'You are a documentation expert at a senior software engineering level. '
                            . 'You write precise, professional, semi-formal, yet simple, easy to understand and readable documentation. '
                            . 'Always return a valid JSON object with exactly two keys: "technical_docs" and "pr_summary". '
                            . 'Both values are plain Markdown strings. '
                            . 'Rules: no emojis, no bold text (no ** or __), no markdown tables, no # headers. '
                            . 'Use plain section labels with a colon instead of headers. '
                            . 'For technical_docs specifically: write in pure paragraph form only — no bullet points, no lists, only flowing prose paragraphs of 4-6 sentences under each section label. '
                            . 'Escape all newlines as \\n and all internal double quotes as \\" inside string values. '
                            . 'Never use triple quotes. Never output anything outside the JSON object.',
                    ],
                    [
                        'role'    => 'user',
                        'content' => $prompt,
                    ],
                ],
                'response_format' => ['type' => 'json_object'],
            ]);

        if ($response->failed()) {
            throw new \Exception("Groq API returned status " . $response->status() . ": " . $response->body());
        }

        $data = $response->json();

        $content = $data['choices'][0]['message']['content'] ?? null;

        if (!$content) {
            throw new \Exception("The AI returned an empty response.");
        }

        $decoded = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new \Exception("Failed to parse AI response as JSON: " . json_last_error_msg());
        }

        return $decoded;
    }
}