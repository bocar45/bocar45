import { describe, expect, it } from "vitest";
import { normalizeSenegalPhone } from "./phone";

describe("normalizeSenegalPhone", () => {
  it("accepts the usual ways of typing a Senegalese mobile", () => {
    for (const v of ["77 123 45 67", "771234567", "+221 77 123 45 67", "00221771234567", "221-77-123-45-67"]) {
      expect(normalizeSenegalPhone(v)).toBe("+221771234567");
    }
    expect(normalizeSenegalPhone("70 000 00 00")).toBe("+221700000000");
  });
  it("rejects landlines, short numbers and other countries", () => {
    for (const v of ["33 800 00 00", "77 123 45", "+33 6 12 34 56 78", "", "79 123 45 67"]) {
      expect(normalizeSenegalPhone(v)).toBeNull();
    }
  });
});
