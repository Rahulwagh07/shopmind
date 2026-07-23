import type { ToolInput, ToolOutput } from "../types/index.ts";

const TIMEOUT_MS = 5_000;
const MAX_CODE_LENGTH = 10_000;

export async function runCode(input: ToolInput): Promise<ToolOutput> {
  const code = input.code;

  if (typeof code !== "string" || code.trim() === "") {
    return { ok: false, error: "run_code requires a non-empty JavaScript snippet." };
  }

  if (code.length > MAX_CODE_LENGTH) {
    return {
      ok: false,
      error: `run_code rejected the snippet: code must be at most ${MAX_CODE_LENGTH} characters.`,
    };
  }

  try {
    const child = Bun.spawn(["bun", "-e", code], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdoutPromise = new Response(child.stdout).text();
    const stderrPromise = new Response(child.stderr).text();
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill(9);
    }, TIMEOUT_MS);

    const exitCode = await child.exited;
    clearTimeout(timeout);

    const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

    if (timedOut) {
      return {
        ok: false,
        error: `run_code timed out after ${TIMEOUT_MS / 1_000} seconds.`,
      };
    }

    if (exitCode !== 0) {
      return {
        ok: false,
        error: `run_code failed with exit code ${exitCode}: ${stderr.trim() || "Unknown subprocess error"}`,
      };
    }

    return { ok: true, stdout: stdout.trimEnd() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `run_code could not start: ${message}` };
  }
}
