import { describe, expect, it } from "vitest";
import { add, applyBps, divRound, format, money, MoneyError, roundToStep, splitGross } from "./money.ts";

describe("Money", () => {
  it("refuses non-integer amounts", () => {
    expect(() => money(10.5, "XOF")).toThrow(MoneyError);
  });

  it("refuses mixing currencies", () => {
    expect(() => add(money(100, "XOF"), money(100, "EUR"))).toThrow(/currency mismatch/);
  });

  it("rounds integer division explicitly", () => {
    expect(divRound(7, 2, "half-up")).toBe(4);
    expect(divRound(7, 2, "down")).toBe(3);
    expect(divRound(7, 3, "up")).toBe(3);
    expect(divRound(-7, 2, "half-up")).toBe(-4);
  });

  it("applies basis points", () => {
    expect(applyBps(money(10_000, "XOF"), 1800).amount).toBe(1800);
    expect(applyBps(money(333, "XOF"), 3500).amount).toBe(117); // 116.55 → 117
  });

  it("rounds prices up to a step", () => {
    expect(roundToStep(money(7_430, "XOF"), 50).amount).toBe(7_450);
    expect(roundToStep(money(7_450, "XOF"), 50).amount).toBe(7_450);
  });

  it("splits a TTC amount so net + tax = gross", () => {
    for (let g = 0; g < 50_000; g += 137) {
      const { net, tax } = splitGross(money(g, "XOF"), 1800);
      expect(net.amount + tax.amount).toBe(g);
    }
    expect(splitGross(money(11_800, "XOF"), 1800).net.amount).toBe(10_000);
  });

  it("formats XOF without decimals and EUR with two", () => {
    expect(format(money(7500, "XOF")).replace(/\s/g, " ")).toBe("7 500 FCFA");
    expect(format(money(1990, "EUR")).replace(/\s/g, " ")).toBe("19,90 €");
  });
});
