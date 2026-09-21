import test from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";
import { readFileSync } from "node:fs";
const lib = {};
new Function(
  "exports",
  ts.transpileModule(readFileSync("lib/workspace/calendar.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
)(lib);
test("calendar dates use Brasilia across UTC midnight and year boundaries", () => {
  assert.equal(lib.brazilDay(new Date("2026-09-21T01:00:00Z")), "2026-09-20");
  assert.equal(lib.weekStart("2026-09-20"), "2026-09-14");
  assert.equal(lib.addDays("2026-12-31", 1), "2027-01-01");
});
test("availability accepts a long window split into complete meetings, rejects invalid and past times", () => {
  const now = Date.parse("2026-09-20T00:00:00Z");
  assert.equal(
    lib.availabilityError("2026-09-21T08:00", "2026-09-21T20:00", 60, now),
    "",
  );
  for (const [start, end, mins] of [
    ["", "", 60],
    ["2026-09-19T09:00", "2026-09-19T10:00", 60],
    ["2026-09-21T09:00", "2026-09-21T08:00", 60],
    ["2026-09-21T09:00", "2026-09-21T10:00", 45],
    ["2026-09-21T09:00", "2026-09-23T10:00", 60],
    ["2026-09-21T09:00", "2026-09-21T10:00", 0],
  ])
    assert.ok(lib.availabilityError(start, end, mins, now));
});
