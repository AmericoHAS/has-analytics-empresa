import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
// Test the production TypeScript functions without adding a test framework dependency.
function moduleFrom(file) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require: (name) =>
      JSON.parse(fs.readFileSync(path.join(path.dirname(file), name), "utf8")),
    Intl,
    Date,
    Math,
  });
  return exports;
}
const { defaultModel, totals, estimate } = moduleFrom(
  "lib/commercial/model.ts",
);
const { deadline, todayInBrazil } = moduleFrom("lib/workspace/deadlines.ts");
test("reference ORC-005: base, hours and coefficients reconcile to R$ 1,005", () =>
  assert.equal(estimate(defaultModel, 9, [0.05, 0, 0, 0.35, 0.1]), 1005));
test("reference ORC-004: moderate complexity and 12 hours reconcile", () =>
  assert.equal(estimate(defaultModel, 12, [0.1, 0, 0, 0.35, 0.1]), 1227.5));
test("reference ORC-002: percentage discount reconciles to R$ 804.10", () =>
  assert.equal(
    totals(
      [
        {
          quantity: 1,
          unitPrice: estimate(defaultModel, 8, [0.05, 0, 0, 0.35, 0.1]),
        },
      ],
      14,
    ).total,
    804.1,
  ));
test("discount applied once after rounded line totals", () => {
  const v = totals(
    [
      { quantity: 3, unitPrice: 0.1 },
      { quantity: 1, unitPrice: 0.2 },
    ],
    10,
  );
  assert.equal(v.subtotal, 0.5);
  assert.equal(v.total, 0.45);
});
test("full discount yields zero", () =>
  assert.equal(totals([{ quantity: 1, unitPrice: 250 }], 100).total, 0));
test("exactly three initial editable services", () =>
  assert.equal(defaultModel.services.filter((s) => s.initial).length, 3));
test("midnight UTC still belongs to previous date in Brazil", () =>
  assert.equal(todayInBrazil(new Date("2026-09-12T01:00:00Z")), "2026-09-11"));
test("due today is not overdue", () => {
  const d = deadline("2026-09-11", "2026-09-01", "em_andamento", "2026-09-11");
  assert.equal(d.tone, "warning");
  assert.equal(d.days, 0);
  assert.equal(d.percent, 100);
});
test("three-day warning boundary", () =>
  assert.equal(
    deadline("2026-09-14", null, "solicitado", "2026-09-11").tone,
    "warning",
  ));
test("overdue clamps elapsed bar", () => {
  const d = deadline("2026-09-10", "2026-09-01", "em_andamento", "2026-09-11");
  assert.equal(d.tone, "danger");
  assert.equal(d.percent, 100);
});
test("closed projects suppress deadline warnings", () =>
  assert.equal(
    deadline("2026-09-01", null, "concluido", "2026-09-11").tone,
    "done",
  ));
test("future start and missing date remain bounded", () => {
  assert.equal(
    deadline("2026-10-01", "2026-09-20", "solicitado", "2026-09-11").percent,
    0,
  );
  assert.equal(deadline(null, null, "solicitado").days, null);
});
