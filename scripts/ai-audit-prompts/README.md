# AI audit lens prompts

This directory holds prompt templates that drive the AI heuristic
verification layer (L8 static audit + L9 dynamic debug) described in
`/AGENTS.md` § 2.

The four files are reused verbatim across audit cycles; the goal is
that the workflow itself is institutional knowledge — anyone (human
operator or coding agent) can dispatch the same passes by handing
the relevant prompt to an LLM with file-access tools.

| File                 | Layer | Lens                                                | When                          |
| -------------------- | ----- | --------------------------------------------------- | ----------------------------- |
| `anti-pattern.md`    | L8    | React 19 / TS / effect anti-patterns                | Major dep upgrade, quarterly  |
| `module-boundary.md` | L8    | DRY / module-boundary / public surface              | Quarterly, before release     |
| `a11y.md`            | L8    | Accessibility + UX beyond `jsx-a11y`                | Each visual-touching PR cycle |
| `dynamic-debug.md`   | L9    | Multi-modal regression detection on captured states | After deploy, after UI change |

## Typical session shape

1. Build + serve the site (or use the live deploy URL).
2. Run `pnpm tsx scripts/dynamic-debug.ts` to populate
   `docs/screenshots/dynamic/<state>/`.
3. For L8: dispatch three parallel agents, each handed one of the
   L8 prompt files plus `Read` / `Bash` (grep) tool access. They
   return a JSON array each.
4. For L9: dispatch one agent with the `dynamic-debug.md` prompt
   plus image-capable `Read` access. Returns one JSON array.
5. Dedupe by `file:line`, then run the **verify** stage manually
   (or via a second agent pass) — every finding must reproduce
   before it becomes a fix.
6. Group surviving findings into thematic PRs (5–7 each).
7. If a finding pattern has appeared ≥ 3 times across cycles,
   promote it via `/AGENTS.md` § 5 — either into the conventions
   table, the Don't-Assume list, or as an ESLint custom rule.

## Why these prompts live in the repo

So that the verification flow is reproducible by the next
contributor without re-deriving the schema, the don't-assume list,
or the hard rules from scratch. Diff-able prompts also let us
review changes to the heuristic process the same way we review code.
