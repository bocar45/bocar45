import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard (E14, C4): technical messages (database, storage…) must never reach a screen.
 * They are logged with logError() and replaced by a clear French message.
 */
const ROOTS = ["../app", "../components"].map((p) => path.join(__dirname, p));
const FORBIDDEN = [
  /error:\s*`[^`]*\$\{\s*(?:error|e|err)\??\.message/, // { error: `… ${error.message}` }
  /error:\s*(?:error|e|err)\??\.message\b(?!\.includes)/, // { error: error.message } (matching a known code with .includes is fine)
  /\{\s*(?:error|e|err)\??\.message\s*\}/, // <p>{error.message}</p>
  /throw new Error\(`[^`]*\$\{\s*(?:error|err)\??\.message/, // rethrown into the error page
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(f) && !f.endsWith(".test.ts") ? [p] : [];
  });
}

describe("no technical error message reaches users", () => {
  it("app and components never return or display error.message", () => {
    const offenders = ROOTS.flatMap(files).flatMap((f) =>
      readFileSync(f, "utf8").split("\n").flatMap((line, i) => (FORBIDDEN.some((r) => r.test(line)) ? [`${path.relative(process.cwd(), f)}:${i + 1}: ${line.trim()}`] : [])),
    );
    expect(offenders).toEqual([]);
  });
});
