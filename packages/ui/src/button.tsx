"use client";

import { ReactNode } from "react";

/**
 * Props accepted by the shared `Button` component.
 *
 * @typedef {Object} ButtonProps
 * @property {ReactNode} children - The label or content rendered inside the button.
 * @property {string} [className] - Optional additional CSS class names applied to the `<button>` element.
 * @property {string} appName - Name of the calling app, included in the alert message shown on click.
 */

/**
 * A generic action button used across the internal UI library.
 *
 * On click it shows a browser `alert` identifying the calling application via the `appName` prop.
 *
 * @param {ButtonProps} props - Component props.
 * @returns {JSX.Element} A `<button>` element.
 */
export const Button = ({ children, className, appName }: ButtonProps) => {
  return (
    <button
      className={className}
      onClick={() => alert(`Hello from your ${appName} app!`)}
    >
      {children}
    </button>
  );
};
