import type { Page } from "playwright-core";
import { PDFDocument, rgb } from "pdf-lib";

export function isChromiumPrintFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    /(?:Page\.printToPDF|page\.pdf).*Printing failed/i.test(error.message)
  );
}

// The normal path keeps the existing layout. Only a Chromium printing failure
// retries without its separate header/footer renderer; the same blue bars are
// then drawn in the PDF margins. Native document content and watermark stay intact.
export async function printTemplatePdf(
  page: Pick<Page, "pdf">,
  reference: string,
) {
  const options = {
    format: "A4" as const,
    printBackground: true,
    preferCSSPageSize: true,
  };
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
  // Exactly one retry; do not mask persistent failures or return a partial file.
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
