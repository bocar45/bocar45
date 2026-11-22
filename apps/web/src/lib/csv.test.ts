import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("CSV export (E20)", () => {
  it("uses semicolons, a BOM and quotes cells that need it", () => {
    expect(toCsv(["a", "b"], [["Kër; Gi", 12000], ['dit "oui"', null]])).toBe('﻿a;b\r\n"Kër; Gi";12000\r\n"dit ""oui""";\r\n');
  });
  it("neutralises spreadsheet formulas but keeps negative amounts", () => {
    expect(toCsv(["x"], [["=HYPERLINK(1)"], [-5000], ["@cmd"]])).toBe("﻿x\r\n'=HYPERLINK(1)\r\n-5000\r\n'@cmd\r\n");
  });
});
