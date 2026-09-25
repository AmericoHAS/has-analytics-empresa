import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, chmod, open, rm } from 'node:fs/promises';
import { createBrotliDecompress } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function preparePdfRuntime(root = process.cwd()) {
  const directory = join(root, '.has-pdf-runtime');
  await mkdir(directory, { recursive: true });
  const executable = join(directory, 'chromium');
  const temporary = join(directory, `chromium-${process.pid}.partial`);
  try {
    await pipeline(
      createReadStream(join(root, 'node_modules', '@sparticuz', 'chromium', 'bin', 'chromium.br')),
      createBrotliDecompress(),
      createWriteStream(temporary, { mode: 0o755 }),
    );
    const file = await open(temporary, 'r');
    try {
      const magic = Buffer.alloc(4);
      await file.read(magic, 0, 4, 0);
      if (!magic.equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) throw Error('Executável Chromium Linux inválido.');
    } finally { await file.close(); }
    await chmod(temporary, 0o755);
    await rename(temporary, executable);
    return executable;
  } finally {
    // Only this build's exact partial file; never remove shared /tmp contents.
    await rm(temporary, { force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await preparePdfRuntime();
  console.info('[HAS_PDF_BUILD] Chromium preparado no pacote da aplicação.');
}
