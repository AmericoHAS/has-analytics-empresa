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

test("meeting end updates with duration and consecutive slots across day and year boundaries", () => {
  assert.equal(lib.meetingEnd("2026-09-25T09:00", 45), "2026-09-25T09:45");
  assert.equal(lib.meetingEnd("2026-09-25T09:00", 90, 3), "2026-09-25T13:30");
  assert.equal(lib.meetingEnd("2026-12-31T23:30", 60), "2027-01-01T00:30");
  assert.equal(lib.meetingEnd("", 60), "");
  assert.equal(lib.meetingEnd("2026-09-25T09:00", 120, 13), "");
  assert.equal(lib.nextMeetingStart(Date.parse("2026-09-25T12:08:00Z")), "2026-09-25T09:30");
});
test('past slots compare Brasilia date and time, including the exact boundary', () => {
  const now = Date.parse('2026-09-25T14:00:00-03:00');
  for (const start of ['2026-09-24T15:00', '2026-09-25T10:00', '2026-09-25T13:30', '2026-09-25T14:00', 'invalid']) assert.equal(lib.isPastStart(start, now), true);
  for (const start of ['2026-09-25T15:00', '2026-09-26T10:00', '2026-09-25T18:00:00Z']) assert.equal(lib.isPastStart(start, now), false);
  assert.equal(lib.isPastStart('2026-09-25T16:30:00Z', now), true);
});
