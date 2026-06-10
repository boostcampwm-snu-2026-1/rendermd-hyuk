# Code blocks — multiple languages

TypeScript:

```ts
function greet(name: string): string {
  return `Hello, ${name}`;
}
```

Python:

```py
def fib(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
```

Bash:

```bash
for f in *.md; do
  echo "processing $f"
done
```

Inline code: use `pnpm dlx tsx scripts/render-corpus.ts` to run the harness.

Literal `$$` inside backticks: `$$E=mc^2$$` should NOT render as math.

Literal `\[ \]` inside backticks: `\[x\]` should also stay as code.
