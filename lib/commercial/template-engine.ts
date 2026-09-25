import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { printTemplatePdf, isChromiumPrintFailure } from "./pdf-print";
import { withPdfCapacity, recoverClosedBrowser, isClosedBrowser, documentBrowserArgs, temporarySpaceMb, pdfResources, browserFailureSignal, preparedChromiumPath } from "./pdf-runtime";
import { randomUUID, createHash } from "node:crypto";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import JSZip from "jszip";
import { chromium as browserEngine, type Page } from "playwright-core";
import chromium, { inflate, setupLambdaEnvironment } from "@sparticuz/chromium";
import { tmpdir } from "node:os";
export type TemplateKind = "orcamento" | "contrato" | "recibo";
const root = () => join(process.cwd(), "templates", "has");
const xmlEscape = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
export async function fillHasTemplate(
  kind: TemplateKind,
  values: Record<string, string>,
  extra = "",
) {
  const source = await readFile(join(root(), `modelo_${kind}_HAS.docx`));
  const zip = new PizZip(source);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => {
      throw Error("O modelo contém um campo sem correspondência no site.");
    },
  });
  doc.render(values);
  const filled = doc.getZip();
  // Preserve native template parts. Only add per-document conditions and version metadata.
  if (extra) {
    const part = filled.file("word/document.xml");
    if (!part) throw Error("Modelo inválido.");
    let xml = part.asText();
    const paragraphs = extra
      .split(/\r?\n/)
      .map(
        (line) =>
          `<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`,
      )
      .join("");
    xml = xml.replace(/<w:sectPr(?:\s|>)/, (m) => paragraphs + m);
    filled.file("word/document.xml", xml);
  }
  return {
    word: filled.generate({ type: "nodebuffer", compression: "DEFLATE" }),
    templateHash: createHash("sha256").update(source).digest("hex"),
  };
}
export function hasTemplatePdf(word: Buffer, kind: TemplateKind) {
  return withPdfCapacity(() => generateTemplatePdf(word, kind));
}
async function generateTemplatePdf(word: Buffer, kind: TemplateKind) {
  const diagnostic = {
    reference: randomUUID().slice(0, 8),
    stage: "assets",
    browser: "unknown",
    temporaryFreeMbBeforePrint: null as number | null,
    sharedFreeMb: null as number | null,
    memoryStorage: "temporary",
    lightweightPrint: false,
  };
  try {
    return await recoverClosedBrowser(
      () => renderHasTemplatePdf(word, kind, diagnostic),
      () => { diagnostic.lightweightPrint = true; console.warn("[HAS_PDF_BROWSER_RESTART]", { ...diagnostic, kind }); },
    );
  } catch (error) {
    // Never log the DOCX, HTML, budget text, client identity or authentication data.
    console.error("[HAS_PDF_FAILED]", {
      ...diagnostic,
      kind,
      bytes: word.length,
      signal: browserFailureSignal(error),
      platform: process.platform,
      rssMb: Math.round(process.memoryUsage().rss / 1048576),
      temporaryFreeMb: await temporarySpaceMb(),
      code: isClosedBrowser(error) ? "chromium_closed" : isChromiumPrintFailure(error)
        ? "chromium_print_failed"
        : error instanceof Error && error.name === "TimeoutError"
          ? "timeout"
          : "document_render_failed",
    });
    throw Error(
      `Não foi possível gerar o PDF. Nenhum documento novo foi publicado. Referência: ${diagnostic.reference}. Tente novamente; se persistir, informe esta referência à HAS.`,
    );
  }
}
async function renderHasTemplatePdf(
  word: Buffer,
  kind: TemplateKind,
  diagnostic: { reference: string; stage: string; browser: string; temporaryFreeMbBeforePrint: number | null; sharedFreeMb: number | null; memoryStorage: string; lightweightPrint: boolean },
) {
  diagnostic.temporaryFreeMbBeforePrint = null;
  const scripts = await Promise.all([
    readFile(
      join(process.cwd(), "node_modules/jszip/dist/jszip.min.js"),
      "utf8",
    ),
    readFile(
      join(process.cwd(), "node_modules/docx-preview/dist/docx-preview.min.js"),
      "utf8",
    ),
  ]);
  const fonts = await Promise.all(
    ["Regular", "Bold", "Italic", "BoldItalic"].map(async (style) => ({
      style,
      data: (
        await readFile(join(root(), "fonts", `Tinos-${style}.ttf`))
      ).toString("base64"),
    })),
  );
  const zip = await JSZip.loadAsync(word);
  // Verified individually in all three official templates: 1=logo, 2=signature, 3=watermark.
  const watermark = await zip.file("word/media/image3.png")?.async("base64");
  const local =
    process.env.DOCUMENT_BROWSER_PATH ||
    (process.platform === "win32"
      ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
      : undefined);
  diagnostic.stage = "launch";
  if (!local) chromium.setGraphicsMode = false;
  let executablePath = local;
  if (!executablePath) {
    diagnostic.stage = "prepare_runtime";
    executablePath = await preparedChromiumPath();
    // Only small support assets are extracted. Never invoke executablePath(),
    // which would duplicate the entire executable in the temporary volume.
    const bin = join(process.cwd(), "node_modules", "@sparticuz", "chromium", "bin");
    await Promise.all(["fonts.tar.br", "swiftshader.tar.br", "al2023.tar.br"].map(file => inflate(join(bin, file))));
    setupLambdaEnvironment(join(tmpdir(), "al2023", "lib"));
  }
  diagnostic.stage = "launch";
  const resources = await pdfResources();
  diagnostic.sharedFreeMb = resources.sharedFreeMb;
  diagnostic.memoryStorage = !local && resources.useSharedMemory ? "shared_memory" : "temporary";
  diagnostic.lightweightPrint ||= !local && resources.lowTemporarySpace;
  // A fresh default context avoids Chromium single-process/incognito crashes.
  // Empty profile path lets Playwright own and remove the isolated temporary profile.
  const context = await browserEngine.launchPersistentContext("", {
    executablePath,
    ignoreDefaultArgs: !local && resources.useSharedMemory ? ["--disable-dev-shm-usage"] : undefined,
    args: local ? ["--no-sandbox"] : documentBrowserArgs(chromium.args),
    headless: true,
  }).catch((error: unknown) => {
    // No customer content has entered the browser at launch time.
    const message = error instanceof Error ? error.message : "Unknown launch error";
    const nativeLines = message.split(/\r?\n/).filter(line =>
      /\[err\]|process did exit|signal=|error while loading shared libraries/i.test(line),
    );
    console.error("[HAS_PDF_LAUNCH_FAILED]", {
      reference: diagnostic.reference,
      signal: browserFailureSignal(error),
      details: nativeLines.join("\n").slice(-10000),
    });
    throw error;
  });
  let page: Page | undefined;
  try {
    diagnostic.browser = context.browser()?.version() ?? "unknown";
    diagnostic.stage = "create_page";
    page = context.pages()[0] ?? await context.newPage();
    diagnostic.stage = "load_scripts";
    await page.route("**/*", (route) =>
      /^(data:|blob:|about:)/.test(route.request().url())
        ? route.continue()
        : route.abort(),
    );
    await page.setContent(
      '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="watermark"></div><main id="document"></main></body></html>',
    );
    for (const content of scripts) await page.addScriptTag({ content });
    diagnostic.stage = "render_docx";
    await page.evaluate(async (data) => {
      const runtime = window as unknown as {
        docx: {
          renderAsync: (
            bytes: Uint8Array,
            container: HTMLElement,
            styles: HTMLElement,
            options: Record<string, unknown>,
          ) => Promise<unknown>;
        };
      };
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      await runtime.docx.renderAsync(
        bytes,
        document.getElementById("document")!,
        document.head,
        {
          inWrapper: false,
          ignoreHeight: true,
          breakPages: false,
          renderHeaders: false,
          renderFooters: false,
          renderAltChunks: false,
          useBase64URL: true,
        },
      );
    }, word.toString("base64"));
    const margin = kind === "contrato" ? 18 : 25;
    await page.addStyleTag({
      content:
        fonts
          .map(
            (f) =>
              `@font-face{font-family:"Times New Roman";src:url(data:font/ttf;base64,${f.data});font-weight:${f.style.includes("Bold") ? 700 : 400};font-style:${f.style.includes("Italic") ? "italic" : "normal"}}`,
          )
          .join("\n") +
        `
 @page{size:A4;margin:${margin}mm;}html,body{margin:0;padding:0;background:white!important;}section.docx{display:block!important;overflow:visible!important;padding:0!important;width:auto!important;min-height:0!important;box-shadow:none!important;background:transparent!important;}article{position:relative;z-index:1;}table{max-width:100%;border-collapse:collapse;}tr{break-inside:avoid;}p{orphans:2;widows:2;}img{max-width:100%;}#watermark{position:fixed;top:48mm;left:0;width:100%;height:160mm;background:url(data:image/png;base64,${watermark ?? ""}) center/contain no-repeat;opacity:.16;z-index:0;}a{color:inherit;text-decoration:none;}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
 `,
    });
    diagnostic.stage = "prepare_print";
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        Array.from(document.images).map((im) =>
          im.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                im.onload = () => resolve();
                im.onerror = () => resolve();
              }),
        ),
      );
    });
    // A table row taller than one page is allowed to flow instead of clipping.
    await page.evaluate(() => {
      document.querySelectorAll("p").forEach((p) => {
        if (
          /^(CLÁUSULA|Descrição do serviço|Etapas|Investimento)/i.test(
            p.textContent?.trim() ?? "",
          )
        )
          (p as HTMLElement).style.breakAfter = "avoid";
      });
      document.querySelectorAll("tr").forEach((row) => {
        if (row.getBoundingClientRect().height > 850)
          (row as HTMLElement).style.breakInside = "auto";
      });
    });
    diagnostic.stage = "print_pdf";
    diagnostic.temporaryFreeMbBeforePrint = await temporarySpaceMb();
    diagnostic.lightweightPrint ||= !local && diagnostic.temporaryFreeMbBeforePrint !== null && diagnostic.temporaryFreeMbBeforePrint < 64;
    if (diagnostic.lightweightPrint) console.info("[HAS_PDF_LOW_RESOURCE_PRINT]", { ...diagnostic, kind });
    return await printTemplatePdf(page, diagnostic.reference, !diagnostic.lightweightPrint);
  } finally {
    await page?.close().catch(() => undefined);
    await context.close().catch(() => {
      console.warn("[HAS_PDF_CLOSE_FAILED]", {
        reference: diagnostic.reference,
      });
    });
  }
}
