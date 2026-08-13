import { type JSX } from "react";

/**
 * Props accepted by the `Card` link component.
 *
 * @typedef {Object} CardProps
 * @property {string} [className] - Optional additional CSS class names applied to the anchor element.
 * @property {string} title - The title displayed inside the card.
 * @property {React.ReactNode} children - Body content rendered below the title.
 * @property {string} href - The destination URL for the card link.
 */

/**
 * A clickable card that links to an external URL with UTM tracking parameters pre-appended.
 *
 * Useful for linking to documentation, guides, or external resources from a landing page.
 *
 * @param {CardProps} props - Component props.
 * @returns {JSX.Element} An `<a>` element styled as a card.
 */
export function Card({
  className,
  title,
  children,
  href,
}: {
  className?: string;
  title: string;
  children: React.ReactNode;
  href: string;
}): JSX.Element {
  return (
    <a
      className={className}
      href={`${href}?utm_source=create-turbo&utm_medium=basic&utm_campaign=create-turbo"`}
      rel="noopener noreferrer"
      target="_blank"
    >
      <h2>
        {title} <span>-&gt;</span>
      </h2>
      <p>{children}</p>
    </a>
  );
}
