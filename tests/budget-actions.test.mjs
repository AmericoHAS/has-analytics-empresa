import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
const realRequire = createRequire(import.meta.url);
function load(file, overrides) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function("exports", "require", code)(
    exports,
    (name) => overrides[name] ?? realRequire(name),
  );
  return exports;
}
const actionError = load("lib/workspace/action-errors.ts", {});
function fixture(error = null, role = "admin", rpcData = true) {
  const calls = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "admin" } } }) },
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      single: async () => ({ data: { role } }),
    }),
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: rpcData, error };
    },
  };
  const overrides = {
    "@/lib/supabase/server": { createClient: async () => db },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/workspace/action-errors": actionError,
    "@/lib/commercial/budget-input": load("lib/commercial/budget-input.ts", {}),
  };
  return {
    calls,
    ...load("app/admin/budget-actions.ts", overrides),
    ...load("app/admin/delete-client-project-action.ts", overrides),
  };
}
const id = "00000000-0000-4000-8000-000000000001";
function form() {
  const f = new FormData();
  Object.entries({
    clientId: id,
    projectId: "",
    budgetId: id,
    title: "Análise",
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
test("budget save and archive return explicit success and preserve user-entered partnership discount", async () => {
  const f = fixture();
  assert.equal((await f.createBudgetAction({}, form())).success, true);
  assert.equal(f.calls[0].args.payload.discountPercent, 30);
  assert.equal((await f.deleteBudgetAction(form())).success, true);
});
test("database failures are serializable action results instead of production render exceptions", async () => {
  for (const code of ["P0001", "PGRST202", "23503"]) {
    const f = fixture({
      code,
      message: "Resolva o pagamento antes de arquivar",
    });
    for (const result of [
      await f.createBudgetAction({}, form()),
      await f.deleteBudgetAction(form()),
      await f.deleteClientProjectAction(id, id),
    ]) {
      assert.equal(result.success, false);
      assert.ok(result.message);
      assert.doesNotThrow(() => JSON.stringify(result));
    }
  }
});
test("clients cannot create, archive or delete and missing project is not reported deleted", async () => {
  const f = fixture(null, "client");
  assert.equal((await f.createBudgetAction({}, form())).success, false);
  assert.equal((await f.deleteBudgetAction(form())).success, false);
  assert.equal((await f.deleteClientProjectAction(id, id)).success, false);
  assert.equal(f.calls.length, 0);
  assert.equal(
    (await fixture(null, "admin", false).deleteClientProjectAction(id, id))
      .success,
    false,
  );
});
