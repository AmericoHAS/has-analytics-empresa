import type { Page } from "playwright-core";
import { PDFDocument, rgb } from "pdf-lib";

export function isChromiumPrintFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    /(?:Page\.printToPDF|page\.pdf).*Printing failed/i.test(error.message)
  );
}

// Under resource pressure (or after a printing failure), skip the separate
// header/footer renderer and draw the same blue bars in the PDF margins.
// Native document content and watermark stay intact.
export async function printTemplatePdf(
  page: Pick<Page, "pdf">,
  reference: string,
  useNativeHeaderFooter = true,
) {
  const options = {
    format: "A4" as const,
    printBackground: true,
    preferCSSPageSize: true,
  };
  if (useNativeHeaderFooter) {
  try {
    return Buffer.from(
      await page.pdf({
        ...options,
        displayHeaderFooter: true,
        headerTemplate:
          '<div style="width:100%;height:10mm;background:#073665;margin:0 2mm;-webkit-print-color-adjust:exact"></div>',
        footerTemplate:
          '<div style="width:100%;height:6mm;background:#073665;margin:0 2mm;-webkit-print-color-adjust:exact"></div>',
      }),
    );
  } catch (error) {
    if (!isChromiumPrintFailure(error)) throw error;
    console.warn("[HAS_PDF_RETRY]", {
      reference,
      reason: "chromium_print_failed",
      mode: "without_header_footer",
    });
  }
  }
  // Low-space mode skips the auxiliary renderer from the outset. The regular
  // path still retries exactly once; neither path can return a partial file.
  const bytes = await page.pdf({ ...options, displayHeaderFooter: false });
  const pdf = await PDFDocument.load(bytes);
  if (!pdf.getPageCount()) throw Error("PDF vazio.");
  const mm = 72 / 25.4;
  for (const sheet of pdf.getPages()) {
    const { width, height } = sheet.getSize();
    const color = rgb(7 / 255, 54 / 255, 101 / 255);
    sheet.drawRectangle({
      x: 2 * mm,
      y: height - 15 - 10 * mm,
      width: width - 4 * mm,
      height: 10 * mm,
      color,
    });
    sheet.drawRectangle({
      x: 2 * mm,
      y: 15,
      width: width - 4 * mm,
      height: 6 * mm,
      color,
    });
  }
  console.info("[HAS_PDF_RECOVERED]", { reference, pages: pdf.getPageCount() });
  return Buffer.from(await pdf.save());
}
