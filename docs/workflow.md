# rendermd — Workflow Draft

## 1. How to break work into units

### Criteria

- **One PR = one vertical slice of a single feature** (UI + logic + styles together).
- **PR size: 50–200 LOC.** Reviewable. Easy to roll back.
- **One component = single responsibility.** Editor handles editing, preview handles preview, parent `page.tsx` orchestrates state.
- **One AI request ≈ one component or one hook.** Larger requests blow up consistency and verification cost.

### Expected work units

| Unit          | Output                                                         | Approx size              |
| ------------- | -------------------------------------------------------------- | ------------------------ |
| Project setup | Next.js + ESLint/Prettier integration + directory structure    | ~150 LOC (mostly config) |
| editor-pane   | CodeMirror editor + markdown mode + left layout                | ~150 LOC                 |
| preview-pane  | react-markdown + plugins (GFM/math/highlight) + right layout   | ~120 LOC                 |
| theme         | CSS variables + toggle UI + ThemeContext/Provider              | ~180 LOC                 |
| draft-storage | localStorage hook + debounced autosave + save status indicator | ~80 LOC                  |
| print-pdf     | `@media print` CSS + ExportButton + print guide modal          | ~150 LOC                 |
| responsive    | Mobile tab switch component + media queries                    | ~100 LOC                 |

### Anti-patterns to avoid

- ❌ One PR with multiple features (theme + localStorage + mobile together) — unreviewable.
- ❌ Stacking component stubs without integration or verification — blows up in the next PR.
- ❌ Separate "setup PR" and "feature PR" — unnecessary round trips.

---

## 2. Prompt patterns — primary coding agent

I work with one primary AI agent (Claude Code) for design and implementation. Three modes:

### A. Plan mode

**When:** Before starting a new feature, when there is more than one approach.
**Context to provide:** What I'm trying to do + constraints + usable/forbidden libraries + desired form of answer.
**Format:**

> "I want to do X. Constraints: A, B, C. Available: D. Off-limits: E. Compare 2–3 options focused on tradeoffs. No code yet."

**Example:**

> "Implementing theme toggle, CSS-variable-based. Constraint: static build, no SSR hydration flash. Restore last theme from localStorage. Compare 2–3 approaches."

### B. Code mode

**When:** After design is settled, when writing actual files.
**Context to provide:** Exact file paths + adjacent files (with snippets if needed) + props interface + behavior spec + styling approach.
**Format:**

> "Write: [path]. props: [A, B, C]. Behavior: [spec]. Parent usage: [snippet]. Styles: CSS Modules. Deps: only [list]."

**Example:**

> "Write `src/components/EditorPane.tsx`. props: `value: string`, `onChange: (next: string) => void`. CodeMirror 6 + lang-markdown. Dark theme → oneDark, light → default. Parent: `<EditorPane value={md} onChange={setMd} />`. CSS Modules. Debounce belongs to parent."

### C. Review mode

**When:** Right after the AI returns code, or before opening a PR.
**Context to provide:** Diff (or full file) + what I'm suspicious of + desired output format.
**Format:**

> "Diff below. I suspect X. Point out other risks I'm missing. Give me a verification checklist."

**Example:**

> "Diff below. I suspect missing useEffect cleanup — possible CodeMirror instance leak. Is `window` reference SSR-safe? Give me a verification checklist."

### Prompt anti-patterns

- ❌ "Make this nicer" — no criteria → AI makes arbitrary choices. Define "nice" together with the ask.
- ❌ "Just write everything" — verification unit too large → can't trust the output. Chunk to 50–200 LOC.
- ❌ Code snippets with no context — AI fills in assumptions. Wrong assumptions = wasted iteration.
- ❌ Paste back the result as-is — never assume one-shot code is correct. **Always** go through review mode.

### Self-check before sending a prompt

- [ ] Did I name the file(s) I want changed?
- [ ] Did I share adjacent files / types?
- [ ] Did I specify the constraints (libs, static build, mobile, etc.)?
- [ ] Did I declare which mode I want (Plan / Code / Review)?

---

## 3. Multi-agent role separation

Beyond the primary coding agent, I delegate independent checks to **three** specialized sub-agents per PR. They get only the diff (or the built site URL) — no context from my chats with the primary agent. **Independence is the point.**

### Agent A — Naive client (verifier)

**Role:** A non-technical user trying to use rendermd for the first time. Has Chrome (browse, click, screenshot), a shell (curl, lighthouse), AND access to the Playwright capture script. **Does not read source code.**

**Job:**

- Launch the dev server or visit the deployed URL.
- Exercise core flows like a real user: paste markdown, switch theme, export PDF, resize to mobile.
- Report what's confusing, broken, or visually off.
- **For any PR that touches rendering or print CSS: run `pnpm dlx tsx scripts/capture.ts`, then `Read` the produced `docs/screenshots/pdf-*.pdf` files (Claude Code's Read tool renders PDF pages as inline images). Inspect for clipping, alignment, margin, theme correctness.**
- **For any PR: run the corpus harness (`pnpm dlx tsx scripts/render-corpus.ts`) to paste each fixture under `scripts/fixtures/` into the live site and assert minimum render counts (KaTeX displays, hljs blocks, page-break markers, zero console errors). Inspect failed fixtures and the per-fixture screenshots under `docs/screenshots/corpus/`.**

**Prompt template:**

> You are a non-technical user. You don't know markdown syntax. You opened rendermd at `<URL>`. Paste this LLM response into the editor: `[...]`. Try to save it as a PDF on desktop Chrome and on iOS Safari (mobile DevTools).
> For any visual/print change: run `pnpm dlx tsx scripts/capture.ts`, then Read the produced PDFs at `/home/wsl/VLSI/rendermd/docs/screenshots/pdf-light.pdf` and `pdf-dark.pdf` — Claude's Read tool renders PDF pages as images. Look at the actual rendered output, not just the CSS.
> For ANY PR: also run `pnpm dlx tsx scripts/render-corpus.ts` — this pastes 10 fixture markdowns (math/code/tables/Korean/nested-GFM/long-paragraph/page-break/empty/edge-cases) into the live site and asserts minimum render counts plus zero console errors. Read the per-fixture screenshots under `docs/screenshots/corpus/` if the script reports failures.
> Report every moment you were confused or stuck, plus any visual issues you can see in the captured PDFs and corpus screenshots.

**Expected output:** A short list of friction points + 1-2 concrete observations from the rendered PDF images + corpus pass/fail summary (and what failed, if anything).

**Adding a fixture:** drop a new `<n>-<topic>.md` under `scripts/fixtures/` and add an `EXPECTATIONS` row in `scripts/render-corpus.ts` keyed by the basename. Unlisted fixtures get a smoke-only run (paste + screenshot, no count assertions).

### Agent B — Senior FE reviewer

**Role:** A senior frontend engineer doing a critical code review. Reads the diff, knows React / TypeScript / Next.js deeply.

**Job:**

- Flag correctness bugs, perf issues, accessibility violations, type-safety gaps, hidden re-renders, hooks-rules violations, security risks (XSS via `dangerouslySetInnerHTML`, etc.), bundle bloat.
- Distinguish "must fix to merge" from "follow-up".
- Suggest minimal changes, not rewrites. No stylistic nits unless they affect correctness.
- **Verify bundle claim:** run `pnpm build`, grep `out/_next/static/chunks/` to confirm the diff's perf claims about chunk splitting / size.

**Prompt template:**

> You are a senior frontend engineer. Review this PR diff against rendermd. Stack: Next.js (static export), TS, CodeMirror 6, react-markdown, CSS Modules, pnpm, Vitest. Focus: correctness, perf, a11y, types, anti-patterns. For each finding give: `file:line`, severity (block / nit / follow-up), why, suggested fix. No stylistic comments. If the PR claims a bundle delta, verify it via `pnpm build` output.

**Expected output:** Finding list keyed by severity, with `file:line` refs.

### Agent C — UI/UX worker

**Role:** A top-tier UI/UX designer reviewing visual quality, interaction design, micro-interactions, accessibility detail, and brand voice consistency.

**Job:**

- Read the relevant component + CSS files (skip pure logic / hook code — Agent B covers that).
- Inspect captured PNGs and PDFs via Read tool.
- Flag visual inconsistencies, spacing/scale issues, contrast violations beyond WCAG minimums, loading-state quality, micro-interaction polish, copy tone mismatches.
- **Critically evaluate premises** (case study: an earlier review flagged dark-theme PDF as "wasting ink" — but PDFs are digital files, not paper. Premise was wrong; finding was rejected.)

**Prompt template:**

> You are a top-tier UI/UX worker reviewing PR #N. Brand voice: Linear / iA Writer / Notion — calm utility, not playful. Read the touched component files + their CSS modules. If the PR changes rendering, read the captured screenshots in `docs/screenshots/` (PNG + PDF, both via Read tool). Be opinionated; if a design is weak, say so directly. Skip code-correctness — Agent B covers that. For each finding: severity (block / nit / follow-up), the visual issue in plain language, a concrete fix.

**Expected output:** Visual / interaction / copy findings; no code-correctness overlap with Agent B.

### My role — orchestrator and final judge

- Read all three agents' reports.
- Reconcile conflicts (e.g., verifier says "PDF export button is hard to find" + reviewer says "the button code is fine" → the UX issue trumps).
- **Test premises before accepting any agent finding.** Premise-checking is the orchestrator's job — an agent confident about a finding built on a wrong premise produces a worse recommendation than a "no findings" report. (See dark-theme-ink case above.)
- Decide scope: which findings block merge, which become follow-up issues.
- Approve and merge.

### Why three separate agents, not one

- **Independence:** an agent that has read the implementation cannot objectively act as a "first-time user".
- **Specialization:** naive-client / FE / UI/UX prompts drive very different output styles. Mixing dilutes all three.
- **Reproducibility:** same prompts on the next PR → consistent review quality.

### What no agent could catch before PDF inspection

Three real production bugs slipped past agent review when verifiers could only inspect HTML:

1. PR #75 era — table clipping in PDF export (user-reported via `reference/export_example.pdf`).
2. PR #82 era — theme hydration mismatch (controlled `<select>` doesn't reconcile SSR-baked `selected=""`).
3. PR #88 era — dark theme blue navy cast (only visible against a bright-monitor render).

All three were diagnosable from actually-rendered output but invisible in CSS / React review. The Playwright + PDF-Read pattern (built in PR #80, formalized here) closes that gap.

---

## 4. Checkpoints I must verify myself

(Things no AI agent can fully verify on its own.)

### Code review level

- [ ] Are the types actually what I intended? (no `any` / overuse of `unknown`)
- [ ] Are the try-catch / defensive paths the AI added actually necessary, or just noise?
- [ ] Is each new dependency justified? (`pnpm ls` to confirm)
- [ ] Are component props minimal? Any unused ones?
- [ ] Did unrelated refactoring sneak in? (review the full diff — AI loves to "tidy up")
- [ ] Do comments explain _why_, not _what_? (delete the latter)

### Functional unit

- [ ] Does the feature actually work? (`pnpm dev` and try it)
- [ ] Edge cases:
  - Empty input
  - Very long input (1MB+)
  - Korean / emoji / special chars (`# 한글 🔥`)
  - Nested markdown (`> - **bold _italic_**`)
  - Markdown inside code fences (must NOT render)
- [ ] **Actually trigger print preview** (Cmd/Ctrl+P, not just DevTools) — this is the PDF core flow.
- [ ] Mobile viewport (DevTools 360px) doesn't break.
- [ ] localStorage quota exceeded (> 5MB) — `QuotaExceededError` handled.

### Deployment

- [ ] `pnpm build` finishes with no warnings.
- [ ] GitHub Pages `basePath: '/rendermd-hyuk'` is set — assets resolve correctly.
- [ ] `out/` alone runs the site (no server dependency).
- [ ] PDF export works on the deployed URL, not just localhost.

### Workflow

- [ ] PR size within 50–200 LOC.
- [ ] Followed feature → dev → main.
- [ ] Commit message answers "why":
  - Bad: `fix typo`
  - Good: `fix(editor): crash on empty input — CodeMirror state init missing when value=""`
- [ ] Pushed only after Husky pre-commit and commit-msg passed.

---

## 5. Do not delegate to AI

- **Product decisions:** what to ship/cut, priority order.
- **UX judgment:** "is this a good experience for the user?" — AI can't know.
- **Final tradeoff selection:** AI proposes options; the human picks.
- **External system decisions:** domains, deployment URLs, secrets.
- **Merge timing:** AI says "done" → I still verify by hand before merging.

---

## 6. Retrospective lives in [retrospective.md](./retrospective.md).
