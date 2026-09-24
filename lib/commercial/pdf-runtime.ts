import { statfs } from "node:fs/promises";
import { tmpdir } from "node:os";

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
  // These documents contain text and static images, not WebGL. Avoid the
  // SwiftShader/GPU path implicated by the production SharedImageManager log.
  return [...defaults.filter((arg) => !/^(--use-gl=|--use-angle=|--enable-unsafe-swiftshader$|--in-process-gpu$|--ignore-gpu-blocklist$|--disk-cache-size=)/.test(arg)),
    "--disable-gpu", "--disable-webgl", "--disk-cache-size=1048576"];
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
