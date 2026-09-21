import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
function load(file, dependencies = {}) {
  const exports = {};
  new Function(
    "exports",
    "require",
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
  )(exports, (name) => dependencies[name]);
  return exports;
}
const errors = load("lib/workspace/action-errors.ts");
const { deleteProject } = load("lib/workspace/delete-project.ts", {
  "./action-errors": errors,
});
test("deletion uses the protected RPC with both identifiers and only confirms true", async () => {
  let calls = 0;
  const db = {
    rpc: async (name, args) => {
      calls++;
      assert.equal(name, "delete_client_project");
      assert.deepEqual(args, {
        p_project_id: "project",
        p_client_id: "client",
      });
      return { data: true, error: null };
    },
  };
  assert.equal((await deleteProject(db, "project", "client")).success, true);
  assert.equal(calls, 1);
  assert.equal(
    (
      await deleteProject(
        { rpc: async () => ({ data: false, error: null }) },
        "p",
        "c",
      )
    ).success,
    false,
  );
});
test("authorization, migration and active-booking errors reach the UI without deleting directly", async () => {
  for (const code of ["42501", "PGRST202", "23503", "P0001"]) {
    const result = await deleteProject(
      {
        rpc: async () => ({
          error: {
            code,
            message:
              "Cancele ou conclua a consultoria agendada antes de excluir o projeto",
          },
          data: null,
        }),
      },
      "p",
      "c",
    );
    assert.equal(result.success, false);
    assert.ok(result.message);
    if (code === "P0001") assert.match(result.message, /consultoria/);
  }
});
test("uncertain network results are never reported as deleted or retried", async () => {
  let calls = 0;
  const result = await deleteProject(
    {
      rpc: async () => {
        calls++;
        throw Error("offline");
      },
    },
    "p",
    "c",
  );
  assert.equal(result.success, false);
  assert.match(result.message, /Atualize a lista/);
  assert.equal(calls, 1);
});
