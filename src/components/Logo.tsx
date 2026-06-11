interface LogoProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
  /**
   * Accessible name. When the logo is paired with a visible label (e.g. the
   * <h1>rendermd</h1> in the brand header), pass `null` to mark the SVG as
   * decorative — otherwise screen readers will announce the name twice.
   */
  title?: string | null;
}

/**
 * rendermd wordmark glyph: a diamond outline with two text-line strokes
 * inside, suggesting "rendered text in a frame." Uses currentColor so it
 * tints to wherever it's placed (--fg for the brand mark, --accent for
 * accent-on-surface contexts).
 *
 * Inner line widths (16 vs 12) are intentionally asymmetric — the
 * diminishing line length implies "text rendered, fading toward an end."
 */
export function Logo({ size = 20, strokeWidth = 2, className, title = 'rendermd' }: LogoProps) {
  const decorative = title === null;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': title })}
    >
      <path d="M12 2 L22 12 L12 22 L2 12 Z" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="12" y2="15" />
    </svg>
  );
}
