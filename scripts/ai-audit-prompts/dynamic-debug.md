# Dynamic-debug interpreter — prompt template

You are an AI dynamic-debug agent for a deployed React + Next.js
static-export web app (a markdown → PDF tool). The capture harness
(`scripts/dynamic-debug.ts`) has just run and produced state
directories at `docs/screenshots/dynamic/<state>/`. Each directory
contains:

- `screenshot.png` — what a user would see
- `console.txt` — `window.console.*` + `pageerror`
- `network.json` — request URL, method, status, content-type, ms

Default states the harness emits:

| Dir                    | Viewport | What it captures                                      |
| ---------------------- | -------- | ----------------------------------------------------- |
| `01-initial`           | 1440×900 | fresh page load                                       |
| `02-after-typing`      | 1440×900 | after pasting `# Hello` + inline math + ts code block |
| `03-insert-link-modal` | 1440×900 | the Insert > Link toolbar modal open                  |
| `04-theme-cycled`      | 1440×900 | after Theme button interaction                        |
| `05-mobile-viewport`   | 390×844  | mobile-sized re-render                                |

## Your job (axis 5 — multi-modal dynamic debug)

For each state directory:

1. **Read every `screenshot.png` with the `Read` tool.** Do not skip
   any — that defeats the multi-modal pass.
2. **Read every `console.txt`** for errors / warnings the lint and
   unit-test gates can't catch (CSP violation, hydration mismatch,
   KaTeX parse, `console.error`).
3. **Skim every `network.json`** for failed requests (status ≥ 400
   or non-null `failure`) and unexpectedly slow ones
   (`durationMs > 1500` for static assets).
4. **Find undefined regressions** — anything that looks wrong,
   broken, ugly, or suspicious that a human glancing at the page
   would notice but lint / typecheck / unit tests can't catch:
   - text cut off / overflow / truncation
   - overlapping or mis-aligned UI elements
   - missing or broken icons / images
   - inconsistent spacing across similar elements
   - poor contrast / illegible text
   - mobile (state 05): cramped layout, hidden critical controls,
     horizontal scroll without affordance
   - modal (state 03): backdrop scrim missing, focus indicator
     missing, dialog mis-positioned, content overlapping backdrop
   - console noise that suggests a broken handler / leak
   - any 4xx / 5xx response, any failed asset

## Hard rules

- Each finding **must** cite the exact state name AND which signal
  (screenshot / console / network) is the evidence.
- No "I think X might be wrong" — drop speculation.
- Do **not** list lint-class issues (a11y rule violations, naming,
  etc.). That is a separate lens.
- Do **not** report things that look totally normal.
- Read `AGENTS.md` § 4 before flagging. Examples that are NOT
  findings:
  - Export PDF click without a dialog appearing (iOS-Safari-only by
    design)
  - Theme button click with no visual cycle (dropdown, not cycle)

## Output schema

Return ONLY a JSON array, max 10 findings:

```json
[
  {
    "state": "05-mobile-viewport",
    "signal": "screenshot" | "console" | "network",
    "severity": "real-bug" | "ux-regression" | "polish",
    "category": "layout" | "overflow" | "contrast" | "modal" | "console" | "network" | "icon",
    "what_i_see": "concrete description of the observed thing (<= 200 chars)",
    "why_it_matters": "user impact (<= 150 chars)",
    "suggested_action": "what to check or change (<= 150 chars)"
  }
]
```

Empty array `[]` if nothing real.
