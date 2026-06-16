# AGENTS.md — rendermd AI / human contributor guide

This file is read automatically by Claude Code, Cursor, and similar
coding agents at the start of every session. It is also the authoritative
checklist for human contributors. If a rule below conflicts with code
review feedback, the code review wins — file a PR to update this file.

The structure mirrors the methodology rendermd uses end-to-end:
deterministic gates (L1–L7) catch what's codifiable; AI heuristic
passes (L8 static audit, L9 dynamic debug) catch what isn't; and
recurring findings should be promoted back into L1–L7 so the
heuristic layer doesn't have to find them twice.

---

## 1. Always-on deterministic gates

The order below is the order the gates run — top to bottom = cheapest
to most expensive. **A new PR must clear them in order**; do not skip.

| Gate                          | Trigger                                | Command                                                          |
| ----------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| **L1 Style**                  | save / pre-commit                      | `pnpm format` / lint-staged auto-fix                             |
| **L2 Static**                 | pre-commit (staged) + pre-push (full)  | `pnpm exec tsc --noEmit`, `pnpm lint --max-warnings 0`           |
| **L3 Convention rules**       | bundled into L2                        | `eslint-config-next` + `jsx-a11y` + `react-hooks`                |
| **L4 Tests**                  | pre-commit (related) + pre-push (full) | `pnpm test:run`                                                  |
| **L5 Asset hygiene**          | pre-push                               | `pnpm knip`                                                      |
| **L6 Visual reviewer-facing** | CI artifact                            | `pnpm tsx scripts/render-corpus.ts` — screenshots uploaded to PR |
| **L7 Commit hygiene**         | commit-msg hook                        | `commitlint`                                                     |

Local pre-push runs L1 → L5 in one shot via `.husky/pre-push`.
**Don't bypass with `--no-verify`.** If a gate fails, fix it; the
escape hatch `SKIP_PREPUSH=1 git push` exists for WIP-only branches
that you intend to rebase before opening a PR.

### Environment determinism (the "L0" beneath L1)

Cross-machine drift in font hinting, browser version, or locale will
make L4 / L6 unreliable in surprising ways. To match the CI runner:

```bash
# Reopen this repo in VS Code / Cursor → "Reopen in Container".
# Same node, pnpm, chromium, fonts as CI uses.
```

The `.devcontainer/Dockerfile` is the institutional answer to "why
does the screenshot look slightly different on my Mac?". Use it when
working on anything visual.

---

## 2. AI heuristic passes — when, who, and what they may NOT do

These are not part of every PR. They run on cadence:

| Pass                                       | Cadence                                           | Tool                                                                              |
| ------------------------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| **L8 Static audit** (3 lenses in parallel) | Major dep upgrade · quarterly · before a release  | `scripts/ai-audit-prompts/{anti-pattern,module-boundary,a11y}.md`                 |
| **L9 Dynamic debug** (multi-modal)         | Anything that touches UI · post-deploy spot-check | `pnpm tsx scripts/dynamic-debug.ts` → `scripts/ai-audit-prompts/dynamic-debug.md` |

### Hard rules for AI agents performing an audit

1. **Self-grounding required.** Every finding must quote the exact
   file:line being criticized. Speculation without a grep hit is a
   bug, not a finding — drop it.
2. **Structured output only.** Each finding goes through the JSON
   schema specified at the bottom of each lens prompt. No prose
   narratives, no "I noticed that…" — the schema field is the
   finding.
3. **Verify before apply.** A finding is a candidate, not a fix. A
   second pass (human or different agent) must confirm the evidence,
   reproduce the failure, and decide scope. Past experience: ~57%
   of first-round findings get dropped at this step (PR #184: 12/21).
4. **No "while you're at it" refactors.** A lens that finds an
   unbounded regex returns a regex fix, not a rewrite of the
   surrounding module. Larger refactors are filed as their own PR
   from a separate analysis.
5. **Respect the Don't-Assume list (§ 4).** Anything on that list is
   a _known_ product decision, not a regression — flagging it is a
   false positive and burns reviewer attention.

### Hard rules for humans evaluating audit findings

1. Read the evidence quote, not the rationale. The evidence either
   exists or doesn't.
2. PRs from audits stay thematic (5–7 findings per PR). 25 findings
   in one PR can't be reviewed; 25 PRs of one finding each can't be
   merged. Group by module or by rule violated.
3. Recurring findings (≥3 across passes) are a signal to promote the
   pattern into L3 (lint rule) or this file's § 4 list — see § 5.

---

## 3. Conventions for new files

| Concern                                   | Rule                                                                                     | Why                                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Regex on user-controlled input**        | Always cap quantifiers: `[\s\S]{1,16384}?`                                               | Past finding: 4 unbounded regexes (#184). Catastrophic backtracking risk on pasted markdown.                                   |
| **`useEffect` with timers**               | Track the id in a `ref` and `clearTimeout` it in the same effect's cleanup               | Past finding: `useDraftStorage.flushPending` (#184). setState on unmounted hook.                                               |
| **Modal dialogs**                         | Use `useFocusTrap` from `src/hooks/useFocusTrap.ts`. Do not hand-roll trap state         | Already-extracted shared hook (PR #181). Duplication regressions are easy.                                                     |
| **`aria-label` on visible-text controls** | Don't add one. The visible text already is the accessible name                           | WCAG 2.5.3 Label-in-Name. Past finding: `aria-label="Export as PDF"` vs visible "Export PDF".                                  |
| **Server vs client component**            | Default to RSC. Add `'use client'` only when the file actually uses hooks / browser APIs | Next App Router transpiles imports from a client component back to client automatically. Don't add `'use client'` defensively. |
| **Mobile breakpoints**                    | `@media (max-width: 480px)`. Test mobile rendering via `dynamic-debug.ts` state 05       | Past finding: toolbar buttons off-screen at 390px (#184).                                                                      |

---

## 4. Don't-Assume list (known product decisions that look like bugs)

If an agent flags one of these, the agent is wrong. Add to this list
whenever an AI pass produces a false positive caused by an unstated
assumption.

- **Theme is a dropdown, not a cycle button.** Clicking the Theme
  control opens a select menu — it does not cycle to the next theme.
  An automated test that clicks Theme and then asserts a different
  theme is in effect will fail.
- **Export PDF skips the modal on non-iOS-Safari.** `ExportButton.handleClick`
  calls `window.print()` directly when `isIOSSafari()` returns false.
  The "Continue / How to print" modal is iOS-Safari-only because that
  is the only environment whose `window.print()` flow benefits from
  guidance. A `[role="dialog"]` wait after clicking Export PDF will
  time out on every other browser — this is by design.
- **`PreviewPane` has no `'use client'`.** It uses hooks but is
  imported through a chain that originates at a `'use client'`
  component, so Next App Router treats it as client without an
  explicit directive. Adding `'use client'` defensively is noise.
- **`editor-active.ts` does not re-export from `editor-active-types`.**
  The split exists to keep `@codemirror/language` out of cold paths.
  Consumers must import types from `editor-active-types` directly.
- **`scripts/render-corpus.ts` does NOT pixel-diff against a baseline.**
  This was tried in PR #184 and rolled back in #185 because cross-
  environment chromium font hinting variance (~5%) made the diff
  fire on every PR without catching real regressions. Screenshots
  are captured as a reviewer-facing CI artifact only. See the doc-
  comment in that file for the longer story.

---

## 5. Promotion path — heuristic finding ⟶ deterministic rule

The job of L8 / L9 is not to catch the same issue forever. When a
pattern surfaces ≥3 times across audits, promote it:

| Promotion target                  | When                                                    | Mechanism                                                                    |
| --------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **§ 4 Don't-Assume list**         | False-positive cause                                    | Add bullet; cite the PR that surfaced it                                     |
| **§ 3 Conventions for new files** | Recurring real finding with a stable shape              | Add row + cite PR                                                            |
| **ESLint custom rule**            | Recurring real finding whose shape is machine-checkable | New rule in `eslint.config.mjs`; document with comment pointing to this file |
| **L6 fixture / L9 state**         | Recurring undefined visual regression                   | Add fixture to `scripts/fixtures/` or state to `scripts/dynamic-debug.ts`    |

The L3 rule set should slowly thicken over time. If a year passes
without § 3 growing, either the project is too small to need
formalisation, or audits are not being run.

---

## 6. References

- `scripts/ai-audit-prompts/anti-pattern.md` — lens prompt for the
  static audit anti-pattern run
- `scripts/ai-audit-prompts/module-boundary.md` — lens prompt for
  duplication / layer-violation findings
- `scripts/ai-audit-prompts/a11y.md` — lens prompt for accessibility
  and UX findings the jsx-a11y/recommended ruleset does not cover
- `scripts/ai-audit-prompts/dynamic-debug.md` — interpreter prompt
  for `scripts/dynamic-debug.ts` artifacts
- `scripts/render-corpus.ts` — L6 reviewer-facing screenshot harness
- `scripts/dynamic-debug.ts` — L9 multi-modal state capture harness
- `.devcontainer/Dockerfile` — environment-control image
- PR #184 — original 7-layer convention + AI heuristic landing
- PR #185 — pixel-diff rollback (the most-cited example of an
  attempted gate that didn't survive contact with reality)
