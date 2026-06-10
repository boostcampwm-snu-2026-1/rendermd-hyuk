# Edge cases

## Inline HTML (should NOT execute scripts)

<div>Plain div content.</div>

<script>alert('xss')</script>

## Unclosed code fence — text below should still render

```ts
function broken(
```

still here

## Trailing whitespace and tabs

A line with trailing spaces.  
Another line.

## Reference-style link

This is [a reference link][ref] back to the docs.

[ref]: https://example.com

## Hard break via backslash

First line.\
Second line on a new visual line.

## Horizontal rule

Above

---

Below
