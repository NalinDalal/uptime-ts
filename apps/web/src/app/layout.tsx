import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * Loads and configures the Inter font family for the sans-serif text variable.
 *
 * Applied to the HTML root element via the `--font-sans` CSS variable.
 *
 * @type {import("next/font/google").InterOptions}
 */
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

/**
 * Loads and configures the JetBrains Mono font family for monospaced text.
 *
 * Applied to the HTML root element via the `--font-mono` CSS variable.
 *
 * @type {import("next/font/google").JetBrainsMonoOptions}
 */
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

/**
 * Default metadata for the application, used by Next.js for the `<head>` element and SEO.
 *
 * @type {Metadata}
 */
export const metadata: Metadata = {
  title: "Uptime",
  description: "Monitor your websites from multiple regions",
};

/**
 * Root layout component wrapping every page in the application.
 *
 * Responsibilities:
 * - Injects the configured font CSS variables onto the `<html>` element.
 * - Sets the document language (`en`) and enables antialiasing.
 * - Renders a favicon in the `<head>`.
 * - Applies base body styles (background, text color, flex column layout).
 *
 * @param {{ children: React.ReactNode }} props - Layout props.
 * @returns {JSX.Element} The root HTML document shell.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-text">
        {children}
      </body>
    </html>
  );
}
