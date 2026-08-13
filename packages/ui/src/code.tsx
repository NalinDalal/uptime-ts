import { type JSX } from "react";

/**
 * Props accepted by the `Code` inline element.
 *
 * @typedef {Object} CodeProps
 * @property {React.ReactNode} children - The code snippet to render.
 * @property {string} [className] - Optional additional CSS class names for styling.
 */

/**
 * A simple inline `<code>` element for rendering code snippets.
 *
 * Intended for short inline usage inside paragraphs or headings.
 *
 * @param {CodeProps} props - Component props.
 * @returns {JSX.Element} A `<code>` HTML element.
 */
export function Code({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return <code className={className}>{children}</code>;
}
