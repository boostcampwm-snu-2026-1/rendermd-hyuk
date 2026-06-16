# Anti-pattern lens — prompt template

You are running the **anti-pattern lens** of a multi-lens audit on a
React 19 + Next 16 (App Router) static-export project. The codebase
already passes `eslint --max-warnings 0` and `tsc --noEmit`; your job
is to find anti-patterns the lint ruleset does not encode.

## Scope

Read the following files (skip `__tests__/`):

- `src/app/*.tsx`, `src/app/*.ts`
- `src/components/*.tsx`
- `src/contexts/*.tsx`
- `src/hooks/*.ts`
- `src/lib/*.ts`
- `src/util/*.ts`

## What to look for

Only these patterns. Anything else is a different lens.

- **React 19 anti-patterns**: setState during render, ref read/write
  during render, set-state in `useEffect` without proper guards,
  missing `useMemo` on context value, `useEffect` dependencies wrong
  / missing / over-broad.
- **Server / Client component boundary**: missing or unnecessary
  `'use client'`, importing server-only API in a client component,
  misuse of the React `use()` hook.
- **Effect / cleanup bugs**: missing cleanup, race conditions, fetch
  without `AbortController`.
- **Regex without length bound** (catastrophic-backtracking risk):
  any `/.../` with `*` or `+` on user input lacking an explicit
  `{1,N}` cap.
- **Memory leaks**: subscriptions not unsubscribed, timers not
  cleared, event listeners not removed.
- **Stale closure** in async / event handlers.

## Hard rules

- Every finding **must** be backed by a `grep` or `Read` quote of the
  exact line — no speculation.
- Drop the finding if you cannot quote the line.
- Do **not** report style / naming / missing-comment nits — that is
  a different lens.
- Do **not** report things `eslint-plugin-react-hooks` would catch —
  those run at lint time and are already enforced.
- Read `AGENTS.md` § 4 before reporting. Anything on the
  Don't-Assume list is _not_ a finding.

## Output schema

Return ONLY a JSON array, max 12 findings, sorted by confidence:

```json
[
  {
    "file": "src/path/to/file.ts",
    "line": 42,
    "severity": "real-bug" | "cleanup" | "nit",
    "rule_violated": "react-19/set-state-in-render" | "regex/no-unbounded" | "effect/timer-not-cleared" | "...",
    "evidence": "exact quoted code snippet (<= 120 chars)",
    "rationale": "why this is wrong (<= 200 chars)",
    "suggested_patch": "concrete fix (<= 200 chars)"
  }
]
```

Empty array `[]` if nothing real survives the rules above.
