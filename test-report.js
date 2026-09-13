/**
 * Self-check: node test-report.js
 * Covers date parsing, range clipping of worktime, and the /etwt totals.
 */
const assert = require('assert');

process.env.PM_API_URL = process.env.PM_API_URL || 'http://localhost';
process.env.TIMEZONE = process.env.TIMEZONE || 'Asia/Dhaka';

const report = require('./lib/report');
const { parseInputDate, toDisplayDate } = report;

// --- date parsing ---
assert.strictEqual(parseInputDate('13-09-2026'), '2026-09-13');
assert.strictEqual(parseInputDate(' 01-01-2026 '), '2026-01-01');
assert.strictEqual(toDisplayDate('2026-09-13'), '13-09-2026');
assert.throws(() => parseInputDate('2026-09-13'), /Use dd-mm-yyyy/);
assert.throws(() => parseInputDate('13-13-2026'), /Use dd-mm-yyyy/);
assert.throws(() => parseInputDate('1-9-2026'), /Use dd-mm-yyyy/);

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
    assert.ok(out.includes('13-09-2026 to 13-09-2026'), `header wrong:\n${out}`);

    // Empty range
    axios.get = async () => ({ data: { data: [] } });
    const empty = await report.runEstimationWorkReport(
      { token: 't', assigneeId: 'u1', name: 'Saleh Shakib' },
      '2026-09-10',
      '2026-09-13'
    );
    assert.ok(empty.includes('No tasks due in this range.'));

    console.log('ok');
  } finally {
    axios.get = originalGet;
  }
})();
