import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as pdfLib from "pdf-lib";
const exports = {};
new Function(
  "exports",
  "require",
  ts.transpileModule(readFileSync("lib/commercial/pdf-print.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(exports, () => pdfLib);
const { printTemplatePdf } = exports;
async function documentBytes() {
  const doc = await pdfLib.PDFDocument.create();
  doc.addPage([595.28, 841.89]);
  doc.addPage([595.28, 841.89]);
  return Buffer.from(await doc.save());
}
test("normal PDF path retains existing header/footer and does not retry", async () => {
  const bytes = await documentBytes();
  let calls = 0;
  const result = await printTemplatePdf(
    {
      pdf: async (options) => {
        calls++;
        assert.equal(options.displayHeaderFooter, true);
        assert.match(options.headerTemplate, /#073665/);
        return bytes;
      },
    },
    "test-normal",
  );
  assert.equal(calls, 1);
  assert.deepEqual(result, bytes);
});
test("printing failure retries once without auxiliary header/footer and preserves every page", async () => {
  const bytes = await documentBytes();
  let calls = 0;
  const result = await printTemplatePdf(
    {
      pdf: async (options) => {
        calls++;
        if (calls === 1)
          throw Error(
            "page.pdf: Protocol error (Page.printToPDF): Printing failed",
          );
        assert.equal(options.displayHeaderFooter, false);
        assert.equal(options.headerTemplate, undefined);
        assert.equal(options.preferCSSPageSize, true);
        return bytes;
      },
    },
    "test-recovery",
  );
  assert.equal(calls, 2);
  const doc = await pdfLib.PDFDocument.load(result);
  assert.equal(doc.getPageCount(), 2);
  for (const page of doc.getPages()) assert.equal(page.getWidth(), 595.28);
});
test("persistent failure stops after two attempts; unrelated errors are not silently retried", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      printTemplatePdf(
        {
          pdf: async () => {
            calls++;
            throw Error("Page.printToPDF: Printing failed");
          },
        },
        "test-failed",
      ),
    /Printing failed/,
  );
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(
    () =>
      printTemplatePdf(
        {
          pdf: async () => {
            calls++;
            throw Error("Target closed");
          },
        },
        "test-closed",
      ),
    /Target closed/,
  );
  assert.equal(calls, 1);
});
test('low-space mode avoids the auxiliary renderer and retains every page', async () => {
  const bytes = await documentBytes(); let calls = 0;
  const result = await printTemplatePdf({pdf: async options => {
    calls++; assert.equal(options.displayHeaderFooter, false);
    assert.equal(options.headerTemplate, undefined); return bytes;
  }}, 'test-low-space', false);
  assert.equal(calls, 1);
  const doc = await pdfLib.PDFDocument.load(result);
  assert.equal(doc.getPageCount(), 2);
  for (const page of doc.getPages()) assert.equal(page.getWidth(), 595.28);
});
