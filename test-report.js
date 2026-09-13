/**
 * Self-check: node test-report.js
 * Covers date parsing, range clipping of worktime, and the /etwt totals.
 */
const assert = require('assert');

process.env.PM_API_URL = process.env.PM_API_URL || 'http://localhost';
process.env.TIMEZONE = process.env.TIMEZONE || 'Asia/Dhaka';

const report = require('./lib/report');
const { parseInputDate } = report;

// --- date parsing ---
assert.strictEqual(parseInputDate('2026-09-13'), '2026-09-13');
assert.strictEqual(parseInputDate(' 2026-01-01 '), '2026-01-01');
// dd-mm-yyyy still accepted on input
assert.strictEqual(parseInputDate('13-09-2026'), '2026-09-13');
assert.throws(() => parseInputDate('2026-13-01'), /Use yyyy-mm-dd/);
assert.throws(() => parseInputDate('2026-9-1'), /Use yyyy-mm-dd/);
assert.throws(() => parseInputDate('not-a-date'), /Use yyyy-mm-dd/);

// --- range worktime + estimate ---
// Dhaka is UTC+6, so 2026-09-13 local = 2026-09-12T18:00Z .. 2026-09-13T18:00Z
const task = {
  _id: 'a',
  taskNumber: 'TASK-3466',
  title: 'Migrate',
  estimatedTime: 120, // minutes
  worktime: [
    // 4m 33s, inside 13-09
    { startTime: '2026-09-13T08:05:51.190Z', endTime: '2026-09-13T08:10:24.642Z' },
    // 1h, inside 13-09
    { startTime: '2026-09-13T09:00:00.000Z', endTime: '2026-09-13T10:00:00.000Z' },
    // 2h on 14-09 local (2026-09-13T19:00Z is 14-09 01:00 Dhaka) — must be excluded
    { startTime: '2026-09-13T19:00:00.000Z', endTime: '2026-09-13T21:00:00.000Z' },
  ],
};

// Reach the internals through the exported report builder by stubbing the fetch.
const axios = require('axios');
const originalGet = axios.get;
axios.get = async () => ({ data: { data: [task] } });

(async () => {
  try {
    const out = await report.runEstimationWorkReport(
      { token: 't', assigneeId: 'u1', name: 'Saleh Shakib' },
      '2026-09-13',
      '2026-09-13'
    );

    assert.ok(out.includes('ET: 2h'), `estimate wrong:\n${out}`);
    assert.ok(out.includes('WT: 1h 4m'), `worked wrong:\n${out}`);
    assert.ok(out.includes('TOTAL ET: 2h'), `total estimate wrong:\n${out}`);
    assert.ok(out.includes('TOTAL WT: 1h 4m'), `total worked wrong:\n${out}`);
    assert.ok(out.includes('DIFF: -55m'), `diff wrong:\n${out}`);
    assert.ok(out.includes('2026-09-13 to 2026-09-13'), `header wrong:\n${out}`);

    // Empty range
    axios.get = async () => ({ data: { data: [] } });
    const empty = await report.runEstimationWorkReport(
      { token: 't', assigneeId: 'u1', name: 'Saleh Shakib' },
      '2026-09-10',
      '2026-09-13'
    );
    assert.ok(empty.includes('No tasks due in this range.'));

    // --- default week ranges: last / this / next, Sun-Thu ---
    const weeks = report.getRecentWeekRanges('2026-09-16'); // a Wednesday
    assert.deepStrictEqual(weeks, [
      { from: '2026-09-06', to: '2026-09-10' },
      { from: '2026-09-13', to: '2026-09-17' },
      { from: '2026-09-20', to: '2026-09-24' },
    ]);

    // --- /etwt_all: per-user totals for each week, no task lines ---
    axios.get = async () => ({
      data: { data: [{ ...task, assignee: { _id: 'u1', name: 'Saleh Shakib' } }] },
    });
    const all = await report.runEstimationWorkAllReport({ token: 't' }, [
      { from: '2026-09-06', to: '2026-09-10' },
      { from: '2026-09-13', to: '2026-09-17' },
    ]);
    assert.ok(all.includes('Saleh Shakib'), `name missing:\n${all}`);
    assert.ok(all.includes('2026-09-06 to 2026-09-10'), `range 1 missing:\n${all}`);
    assert.ok(all.includes('2026-09-13 to 2026-09-17'), `range 2 missing:\n${all}`);
    // one table per user: name first, then the rows
    assert.ok(
      all.indexOf('Saleh Shakib') < all.indexOf('2026-09-06'),
      `not grouped by user:\n${all}`
    );
    assert.ok(all.includes('Date '), `table header missing:\n${all}`);
    // columns padded to the widest cell, worktime falls in the second week only
    assert.ok(
      all.includes('2026-09-06 to 2026-09-10 | 2h | N/A'),
      `empty week row wrong:\n${all}`
    );
    assert.ok(
      all.includes('2026-09-13 to 2026-09-17 | 2h | 3h 4m'),
      `worked week row wrong:\n${all}`
    );
    assert.ok(!all.includes('TASK-3466'), `should not list tasks:\n${all}`);

    console.log('ok');
  } finally {
    axios.get = originalGet;
  }
})();
