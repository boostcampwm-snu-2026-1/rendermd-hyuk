# Module-boundary / DRY lens — prompt template

You are running the **module-boundary / DRY lens** of a multi-lens
audit on a React 19 + Next 16 static-export project. Many obvious
extractions have already been done (`useFocusTrap` is shared,
`splitCodeAndText` is shared). Your job is to find what is still
duplicated or living in the wrong layer.

## Scope

Read the following files (skip `__tests__/`):

- `src/app/*.tsx`, `src/app/*.ts`
- `src/components/*.tsx`
- `src/contexts/*.tsx`
- `src/hooks/*.ts`
- `src/lib/*.ts`
- `src/util/*.ts`

## What to look for

- **Duplicated logic** across files — same regex, same effect
  pattern, same DOM query, same handler shape repeated ≥ 2 times.
- **Layer violation** — a component holding pure-data logic that
  belongs in `lib/`, or `lib/` importing from `components/` or
  `hooks/`, or `hooks/` reaching into contexts wrongly.
- **Public-surface mismatch** — function exported but only used
  internally, module exporting too much, dead re-export.
- **Naming drift** — same concept named differently across files
  (e.g. "draft" vs "buffer" vs "content").
- **Wrong directory** — file whose import graph suggests a different
  layer than where it lives.

## Hard rules

- Every finding **must** include `grep`-confirmed quotes from both
  occurrences. One occurrence is not duplication — drop.
- Do not propose abstractions for ≤ 3 lines that appear ≤ 2 times —
  premature.
- Do not propose major refactors (factory, generic context, format-
  actions table). File those as separate analysis, not as findings
  in this PR's pass.
- Read `AGENTS.md` § 4 before reporting. Items there (e.g.
  `editor-active.ts` deliberately not re-exporting from
  `editor-active-types`) are intentional, not findings.

## Output schema

Return ONLY a JSON array, max 10 findings:

```json
[
  {
    "files": ["src/a.ts", "src/b.ts"],
    "kind": "duplication" | "layer-violation" | "naming-drift" | "wrong-layer" | "public-surface",
    "severity": "real-bug" | "cleanup" | "nit",
    "evidence": "quote A from file 1 + quote B from file 2 (<= 200 chars total)",
    "rationale": "why this hurts (<= 200 chars)",
    "suggested_action": "extract to where, or rename to what (<= 200 chars)"
  }
]
```

Empty array `[]` if nothing survives.
