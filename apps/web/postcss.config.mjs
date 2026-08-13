/**
 * PostCSS configuration for the web application.
 *
 * Configures the Tailwind CSS PostCSS plugin so that Tailwind directives
 * (e.g. `@tailwind`, `@apply`) are processed during the Next.js build pipeline.
 *
 * @type {import("postcss").Config}
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
