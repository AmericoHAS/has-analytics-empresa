import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const native = createRequire(import.meta.url);
function load(file, deps = {}) {
  const out = {};
  new Function(
    "exports",
    "require",
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
  )(out, (k) => deps[k] ?? native(k));
  return out;
}
const ops = load("lib/workspace/budget-operations.ts", {
  "../commercial/budget-input": load("lib/commercial/budget-input.ts"),
  "./action-errors": load("lib/workspace/action-errors.ts"),
});
const id = "00000000-0000-4000-8000-000000000001";
function form() {
  const f = new FormData();
  Object.entries({
    clientId: id,
    projectId: "",
    title: "Projeto de pesquisa",
    description: "",
    notes: "",
    validUntil: "",
    discountPercent: "30",
    items: JSON.stringify([
      { description: "Análise", quantity: 1, unitPrice: 100 },
    ]),
  }).forEach(([k, v]) => f.set(k, v));
  return f;
}
test("browser saves through protected RPC and returns confirmed budget ID without internal planning", async () => {
  let calls = 0;
  const r = await ops.saveBudget(
    {
      rpc: async (name, args) => {
        calls++;
        assert.equal(name, "save_client_budget_v3");
        assert.equal(args.payload.discountPercent, 30);
        assert.equal(args.payload.internalNotes, "");
        return { data: id, error: null };
      },
    },
    form(),
  );
  assert.equal(calls, 1);
  assert.equal(r.success, true);
  assert.equal(r.id, id);
});
test("invalid items do not reach database and archive propagates protected business errors", async () => {
  const f = form();
  f.set("items", "[]");
  assert.equal(
    (
      await ops.saveBudget(
        {
          rpc: () => {
            throw Error("must not call");
          },
        },
        f,
      )
    ).success,
    false,
  );
  const r = await ops.archiveBudget(
    {
      rpc: async () => ({
        error: {
          code: "P0001",
          message: "Resolva o pagamento antes de arquivar",
        },
      }),
    },
    id,
  );
  assert.equal(r.success, false);
  assert.match(r.message, /pagamento/);
});
test("uncertain save/archival never auto-retries or reports success", async () => {
  let calls = 0;
  const db = {
    rpc: async () => {
      calls++;
      throw Error("network");
    },
  };
  assert.equal((await ops.saveBudget(db, form())).success, false);
  assert.equal((await ops.archiveBudget(db, id)).success, false);
  assert.equal(calls, 2);
});
