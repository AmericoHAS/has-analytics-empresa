import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
const lib = {};
new Function(
  "exports",
  ts.transpileModule(readFileSync("lib/workspace/lifecycle.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(lib);
const base = {
  proposalSent: false,
  proposalApproved: false,
  proposalSigned: false,
  contractSent: false,
  contractSigned: false,
  paymentSent: false,
  paymentConfirmed: false,
  dataReceived: false,
  results: false,
  meeting: false,
  meetingDone: false,
  analysis: false,
  manualProgress: 0,
};
test("only actionable stages alert clients; contract, proof and data precede analysis", () => {
  assert.equal(lib.lifecycle(base).pending, false);
  assert.equal(
    lib.lifecycle({ ...base, proposalSent: true }).tab,
    "orcamentos",
  );
  assert.equal(lib.lifecycle({ ...base, proposalSigned: true }).pending, false);
  assert.equal(lib.lifecycle({ ...base, contractSent: true }).pending, true);
  assert.equal(
    lib.lifecycle({ ...base, contractSigned: true, paymentSent: true }).tab,
    "documentos",
  );
  assert.equal(
    lib.lifecycle({
      ...base,
      contractSigned: true,
      paymentSent: true,
      dataReceived: true,
    }).pending,
    false,
  );
});
test("manual analysis occupies middle segment; results and meeting drive final segment", () => {
  assert.equal(
    lib.lifecycle({ ...base, analysis: true, manualProgress: 50 }).progress,
    68,
  );
  assert.equal(
    lib.lifecycle({ ...base, analysis: true, manualProgress: 500 }).progress,
    85,
  );
  assert.equal(
    lib.lifecycle({ ...base, analysis: true, results: true }).progress,
    50,
  );
  assert.equal(
    lib.lifecycle({ ...base, results: true, meeting: true }).pending,
    false,
  );
  assert.equal(lib.lifecycle({ ...base, meetingDone: true }).progress, 98);
});

test("explicit completion releases consultation and only project closure reaches 100", () => {
  assert.equal(
    lib.lifecycle({ ...base, analysisCompleted: true }).progress,
    90,
  );
  assert.equal(
    lib.lifecycle({ ...base, analysisCompleted: true }).pending,
    true,
  );
  assert.equal(
    lib.lifecycle({
      ...base,
      paymentConfirmed: true,
      dataReceived: true,
      manualProgress: 40,
    }).progress,
    50,
  );
  assert.equal(lib.lifecycle({ ...base, completed: true }).progress, 100);
  assert.equal(
    lib.lifecycle({ ...base, revision: true, analysis: true }).pending,
    false,
  );
});
