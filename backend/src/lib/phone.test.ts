import { test } from "node:test";
import assert from "node:assert/strict";
import { formatNgPhone, normaliseNgPhone } from "./phone";

test("Nigerian numbers in any common format become +234…", () => {
  for (const v of ["08030999969", "8030999969", "2348030999969", "+234 803 099 9969", "+234-803-099-9969", "0803 099 9969"]) {
    assert.equal(normaliseNgPhone(v), "+2348030999969", v);
  }
  assert.equal(normaliseNgPhone("07012345678"), "+2347012345678");
  assert.equal(normaliseNgPhone("09123456789"), "+2349123456789");
});

test("not a Nigerian mobile number", () => {
  for (const v of ["", "123", "0803099996", "080309999690", "06030999969", "08230999969", "+447700900123"]) {
    assert.equal(normaliseNgPhone(v), null, v);
  }
});

test("display format", () => assert.equal(formatNgPhone("+2348030999969"), "+234 803 099 9969"));
