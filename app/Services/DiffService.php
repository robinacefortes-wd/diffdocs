<?php

namespace App\Services;

use SebastianBergmann\Diff\Differ;
use SebastianBergmann\Diff\Output\UnifiedDiffOutputBuilder;

class DiffService
{
    public function getRawDiff(string $oldCode, string $newCode): string
    {
        // UnifiedDiffOutputBuilder creates the standard "---/+++" format 
        // that developers are used to seeing in Git.
        $builder = new UnifiedDiffOutputBuilder("--- Original\n+++ New\n", false);
        $differ = new Differ($builder);

        return $differ->diff($oldCode, $newCode);
    }
}