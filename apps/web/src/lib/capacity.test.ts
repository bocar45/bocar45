import { describe, expect, it } from "vitest";
import { capacityCheck } from "./capacity";

// 2026-11-23 is a Monday
const base = { capacityPerDay: 20, piecesInProgress: 0, quantity: 20, leadTimeDays: 5, closures: [], today: "2026-11-23" };

describe("workshop capacity (E21)", () => {
  it("counts working days Monday to Saturday from tomorrow", () => {
    const r = capacityCheck({ ...base, quantity: 60 }); // 3 days of work
    expect(r).toMatchObject({ workDaysNeeded: 3, readyBy: "2026-11-26", dueBy: "2026-11-28", late: false, closedToday: false });
    expect(capacityCheck({ ...base, today: "2026-11-27" }).dueBy).toBe("2026-12-03"); // Sat 28, (Sun skipped), Mon 30, Tue 1, Wed 2, Thu 3
  });
  it("adds the work already in progress and flags a workshop that cannot finish in time", () => {
    const r = capacityCheck({ ...base, piecesInProgress: 100, quantity: 40 }); // 7 days > 5
    expect(r).toMatchObject({ workDaysNeeded: 7, late: true });
  });
  it("skips closures for the work but not for the customer's promise", () => {
    const r = capacityCheck({ ...base, quantity: 60, closures: [{ starts_on: "2026-11-24", ends_on: "2026-11-26", reason: "Tabaski" }] });
    expect(r).toMatchObject({ readyBy: "2026-11-30", dueBy: "2026-11-28", late: true });
    expect(r.closuresAhead).toHaveLength(1);
  });
  it("says until when a workshop is closed, across back-to-back closures", () => {
    const r = capacityCheck({ ...base, closures: [{ starts_on: "2026-11-20", ends_on: "2026-11-24" }, { starts_on: "2026-11-25", ends_on: "2026-11-27" }] });
    expect(r).toMatchObject({ closedToday: true, closedUntil: "2026-11-27" });
  });
  it("uses the lead time when no capacity is declared", () => {
    expect(capacityCheck({ ...base, capacityPerDay: null, quantity: 500 })).toMatchObject({ workDaysNeeded: 5, late: false });
  });
});
