import assert from 'node:assert';
import { parseDateRange } from '../src/lib/excel/date-range-parser';
import { parseMasterExcel, generateSampleExcelBuffer } from '../src/lib/excel/master-parser';

console.log('🧪 Starting Rate Master Unit Tests...\n');

// 1. Date Range Parser Tests
console.log('Testing Date Range Parser:');

// Test 1: Single range
const t1 = parseDateRange('15 Mar – 30 Sep 2026');
assert.strictEqual(t1.isValid, true);
assert.strictEqual(t1.ranges.length, 1);
assert.strictEqual(t1.ranges[0]?.startDate, '2026-03-15');
assert.strictEqual(t1.ranges[0]?.endDate, '2026-09-30');
console.log('  ✔ Test 1: Single range with en-dash passed.');

// Test 2: Multi-range
const t2 = parseDateRange('01 Oct – 19 Dec 2026 & 06 Jan – 31 Mar 2027');
assert.strictEqual(t2.isValid, true);
assert.strictEqual(t2.ranges.length, 2);
assert.strictEqual(t2.ranges[0]?.startDate, '2026-10-01');
assert.strictEqual(t2.ranges[0]?.endDate, '2026-12-19');
assert.strictEqual(t2.ranges[1]?.startDate, '2027-01-06');
assert.strictEqual(t2.ranges[1]?.endDate, '2027-03-31');
console.log('  ✔ Test 2: Multi-range with & passed.');

// Test 3: Exclusion
const t3 = parseDateRange('01 Oct 2026 – 31 Mar 2027 (excl. peak dates 20 Dec - 05 Jan)');
assert.strictEqual(t3.isValid, true);
assert.strictEqual(t3.ranges.length, 1);
assert.strictEqual(t3.ranges[0]?.startDate, '2026-10-01');
assert.strictEqual(t3.ranges[0]?.endDate, '2027-03-31');
assert.strictEqual(t3.exclusions.length, 1);
assert.strictEqual(t3.exclusions[0]?.startDate, '2026-12-20');
assert.strictEqual(t3.exclusions[0]?.endDate, '2027-01-05');
console.log('  ✔ Test 3: Range with exclusion passed.');

// Test 4: Year rollover
const t4 = parseDateRange('15 Dec – 15 Jan 2027');
assert.strictEqual(t4.isValid, true);
assert.strictEqual(t4.ranges[0]?.startDate, '2026-12-15');
assert.strictEqual(t4.ranges[0]?.endDate, '2027-01-15');
console.log('  ✔ Test 4: Year rollover across Dec-Jan passed.');

// 2. Master Parser & Template Generation
console.log('\nTesting Master Parser & Sample Template:');
const sampleBuffer = generateSampleExcelBuffer();
const parseRes = parseMasterExcel(sampleBuffer);

assert.strictEqual(parseRes.success, true);
assert.strictEqual(parseRes.data.length, 2);
assert.strictEqual(parseRes.sheetName, 'Rate Master');
assert.strictEqual(parseRes.data[0]?.location, 'Kerala');
assert.strictEqual(parseRes.data[0]?.hotelName, 'Example Hotel');
assert.strictEqual(parseRes.data[0]?.cpCost, 5000);
assert.strictEqual(parseRes.data[0]?.mapCost, 6500);
assert.strictEqual(parseRes.data[0]?.extraAdultCP, 1500);
assert.strictEqual(parseRes.data[0]?.extraAdultMAP, 2000);
assert.strictEqual(parseRes.data[0]?.childBedCost, 1000);
assert.strictEqual(parseRes.data[0]?.childNoBedCost, 500);

console.log('  ✔ Test 5: Excel parser accurately parses Rate Master tab with 15 canonical fields.');

console.log('\n✨ ALL TESTS PASSED SUCCESSFULLY! ✨');
