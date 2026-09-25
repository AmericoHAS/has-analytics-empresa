import { access, statfs } from "node:fs/promises";
import { tmpdir } from "node:os";
import { constants } from "node:fs";
import { join } from "node:path";

// One Chromium per Node worker: concurrent requests otherwise share the same
// small serverless /tmp volume and compete for renderer memory.
let pending: Promise<unknown> = Promise.resolve();
export function withPdfCapacity<T>(work: () => Promise<T>): Promise<T> {
  const result = pending.then(work);
  pending = result.catch(() => undefined);
  return result;
}

export function isClosedBrowser(error: unknown): boolean {
  return error instanceof Error &&
    /Target (?:page, context or browser has been closed|closed)|browser (?:has been closed|disconnected)|Page crashed/i.test(error.message);
}

export function documentBrowserArgs(defaults: string[]): string[] {
  // Preserve the package's serverless process model, including in-process-gpu.
  // Disabling WebGL is handled by chromium.setGraphicsMode, not by removing
  // GPU process flags: headless Chromium still uses its graphics compositor.
  return [...defaults.filter(arg => !arg.startsWith("--disk-cache-size=")),
    "--disk-cache-size=1048576"];
}

export async function temporarySpaceMb(): Promise<number | null> {
  try {
    const stats = await statfs(tmpdir());
    return Math.round(stats.bavail * stats.bsize / 1048576);
  } catch {
    return null;
  }
}

export async function recoverClosedBrowser<T>(
  render: () => Promise<T>,
  onRetry: () => void,
): Promise<T> {
  try {
    return await render();
  } catch (error) {
    if (!isClosedBrowser(error)) throw error;
    // render must close its previous browser in finally before this retry.
    onRetry();
    return render();
  }
}

// Playwright normally redirects Linux shared memory into /tmp. Under disk
// pressure, use the separate shared-memory volume only when it has more room.
export function shouldUseSharedMemory(temporaryMb: number | null, sharedMb: number | null) {
  return temporaryMb !== null && temporaryMb < 64 && sharedMb !== null && sharedMb >= 48 && sharedMb > temporaryMb;
}
export async function pdfResources() {
  const temporaryFreeMb = await temporarySpaceMb();
  let sharedFreeMb: number | null = null;
  if (process.platform === "linux") {
    try {
      await access("/dev/shm", constants.W_OK);
      const stats = await statfs("/dev/shm");
      sharedFreeMb = Math.floor(stats.bavail * stats.bsize / 1048576);
    } catch { /* Keep Playwright's default when shared memory is unavailable. */ }
  }
  return { temporaryFreeMb, sharedFreeMb,
    useSharedMemory: process.platform === "linux" && shouldUseSharedMemory(temporaryFreeMb, sharedFreeMb),
    lowTemporarySpace: process.platform === "linux" && temporaryFreeMb !== null && temporaryFreeMb < 64 };
}
export function browserFailureSignal(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  // Fixed labels only: browser logs can contain document text or private paths.
  if (/No space left|ENOSPC/i.test(message)) return "disk_full";
  if (/SIGBUS/i.test(message)) return "sigbus";
  if (/SIGKILL|out of memory|oom-kill/i.test(message)) return "memory_or_kill";
  if (/SIGSEGV/i.test(message)) return "segmentation_fault";
  if (/SIGTRAP/i.test(message)) return "trap";
  return "unknown";
}

// The large executable lives in the read-only deployment bundle, not /tmp.
// Missing packaging must fail explicitly rather than silently consume /tmp.
export async function preparedChromiumPath(root = process.cwd()) {
  const executable = join(root, ".has-pdf-runtime", "chromium");
  try { await access(executable, constants.R_OK | constants.X_OK); }
  catch { throw Error("Chromium não preparado no build. Configure o Build Command como npm run build e publique novamente."); }
  return executable;
}
