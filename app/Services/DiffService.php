<?php

namespace App\Services;

use SebastianBergmann\Diff\Differ;
use SebastianBergmann\Diff\Output\UnifiedDiffOutputBuilder;

class DiffService
{
    public function getRawDiff(string $oldCode, string $newCode): string
    {
        $builder = new UnifiedDiffOutputBuilder("--- Original\n+++ New\n", false);
        $differ = new Differ($builder);

        return $differ->diff($oldCode, $newCode);
    }
}