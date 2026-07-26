import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const outputDir = path.join(
  repositoryRoot,
  "outputs",
  "demo",
  "BuildCrew_BC-2026-0142",
  "approval",
);
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const summary = workbook.worksheets.add("Decision Summary");
const quotes = workbook.worksheets.add("Quote Leveling");
const evidence = workbook.worksheets.add("Evidence Ledger");

const dark = "#17211C";
const green = "#248D50";
const paleGreen = "#EAF8EF";
const muted = "#66736D";
const line = "#DADCE0";
const redPale = "#FCEDEB";
const amberPale = "#FFF4DD";

summary.showGridLines = false;
summary.getRange("A1:H2").merge();
summary.getRange("A1").values = [["BuildCrew · replacement decision"]];
summary.getRange("A1:H2").format = {
  fill: dark,
  font: { bold: true, color: "#FFFFFF", size: 20 },
  verticalAlignment: "center",
};
summary.getRange("A4:H4").merge();
summary.getRange("A4").values = [["BC-2026-0142 · Mission Bay Data Center · P-401 Chilled Water Pump"]];
summary.getRange("A4:H4").format = {
  font: { color: muted, size: 10 },
};

summary.getRange("A6:B6").merge();
summary.getRange("C6:D6").merge();
summary.getRange("E6:F6").merge();
summary.getRange("G6:H6").merge();
summary.getRange("A6:H6").values = [[
  "TECHNICAL COMPLIANCE",
  null,
  "CRITICAL CLASHES",
  null,
  "ARRIVAL",
  null,
  "TOTAL INSTALLED",
  null,
]];
summary.getRange("A6:H6").format = {
  font: { bold: true, color: muted, size: 9 },
  borders: { bottom: { style: "thin", color: line } },
};
summary.getRange("A7:B8").merge();
summary.getRange("C7:D8").merge();
summary.getRange("E7:F8").merge();
summary.getRange("G7:H8").merge();
summary.getRange("A7").values = [["31 / 31"]];
summary.getRange("C7").values = [["0"]];
summary.getRange("E7").values = [["Aug 19"]];
summary.getRange("G7").values = [["$31,680"]];
summary.getRange("A7:H8").format = {
  font: { bold: true, color: dark, size: 18 },
  verticalAlignment: "center",
};

summary.getRange("A10:H10").merge();
summary.getRange("A10").values = [["Recommended replacement"]];
summary.getRange("A10:H10").format = {
  font: { bold: true, color: green, size: 10 },
  borders: { bottom: { style: "thin", color: line } },
};
summary.getRange("A11:H12").merge();
summary.getRange("A11").values = [["Armstrong · 4030 4×3×10"]];
summary.getRange("A11:H12").format = {
  fill: paleGreen,
  font: { bold: true, color: dark, size: 18 },
  verticalAlignment: "center",
};
summary.getRange("A14:H16").merge();
summary.getRange("A14").values = [[
  "Selected because it is the only candidate that satisfies all hard requirements, arrives before the required-on-site date, preserves motor removal clearance, and produces no critical BIM clash. A 25 mm suction spool adjustment is required.",
]];
summary.getRange("A14:H16").format = {
  font: { color: muted, size: 10 },
  wrapText: true,
  verticalAlignment: "center",
};

summary.getRange("A18:H18").values = [[
  "Candidate",
  "Purchase",
  "Freight",
  "Accessories",
  "Modification",
  "Delay exposure",
  "Installed total",
  "Decision",
]];
summary.getRange("A19:H21").formulas = [
  ["='Quote Leveling'!A2", "='Quote Leveling'!D2", "='Quote Leveling'!E2", "='Quote Leveling'!F2", "='Quote Leveling'!G2", "='Quote Leveling'!H2", "='Quote Leveling'!I2", "='Quote Leveling'!N2"],
  ["='Quote Leveling'!A3", "='Quote Leveling'!D3", "='Quote Leveling'!E3", "='Quote Leveling'!F3", "='Quote Leveling'!G3", "='Quote Leveling'!H3", "='Quote Leveling'!I3", "='Quote Leveling'!N3"],
  ["='Quote Leveling'!A4", "='Quote Leveling'!D4", "='Quote Leveling'!E4", "='Quote Leveling'!F4", "='Quote Leveling'!G4", "='Quote Leveling'!H4", "='Quote Leveling'!I4", "='Quote Leveling'!N4"],
];
summary.getRange("A18:H21").format.borders = { preset: "all", style: "thin", color: line };
summary.getRange("A18:H18").format = {
  fill: paleGreen,
  font: { bold: true, color: dark, size: 9 },
  borders: { preset: "all", style: "thin", color: line },
};
summary.getRange("B19:G21").format.numberFormat = "$#,##0";
summary.getRange("A1:H24").format.columnWidth = 14;
summary.getRange("A1:A24").format.columnWidth = 21;
summary.getRange("H1:H24").format.columnWidth = 18;
summary.getRange("A1:H24").format.rowHeight = 21;

const costChart = summary.charts.add("bar", summary.getRange("A18:G21"));
costChart.title = "Total recovery cost by candidate";
costChart.hasLegend = true;
costChart.yAxis = { numberFormatCode: "$#,##0" };
costChart.setPosition("J4", "Q21");

quotes.showGridLines = false;
quotes.getRange("A1:N1").values = [[
  "Candidate",
  "Supplier",
  "Model",
  "Product",
  "Freight",
  "Accessories",
  "Modification",
  "Delay exposure",
  "Installed total",
  "Arrival",
  "Hard req.",
  "Critical clashes",
  "Evidence",
  "Decision",
]];
quotes.getRange("A2:N4").values = [
  ["Candidate A", "Pacific Pump Supply", "KSB Etanorm 065-040-250", 26400, 2100, 0, 0, 0, null, "Aug 17", "31/31", 1, "94%", "REJECT"],
  ["Candidate B", "Bay Mechanical Supply", "Grundfos NB 65-125/142", 27600, 1900, 620, 0, 0, null, "Aug 18", "31/31", 1, "100%", "REJECT"],
  ["Candidate C", "Pacific Pump Supply", "Armstrong 4030 4×3×10", 29600, 1240, 0, 840, 0, null, "Aug 19", "31/31", 0, "100%", "RECOMMEND"],
];
quotes.getRange("I2").formulas = [["=SUM(D2:H2)"]];
quotes.getRange("I2:I4").fillDown();
quotes.getRange("A1:N4").format.borders = { preset: "all", style: "thin", color: line };
quotes.getRange("A1:N1").format = {
  fill: dark,
  font: { bold: true, color: "#FFFFFF", size: 9 },
  wrapText: true,
  borders: { preset: "all", style: "thin", color: dark },
};
quotes.getRange("D2:I4").format.numberFormat = "$#,##0";
quotes.getRange("A4:N4").format.fill = paleGreen;
quotes.getRange("A2:N2").format.fill = redPale;
quotes.getRange("A3:N3").format.fill = amberPale;
quotes.getRange("A1:N20").format.rowHeight = 23;
quotes.getRange("A1:N4").format.wrapText = true;
const quoteWidths = [16, 23, 29, 13, 11, 13, 14, 15, 15, 12, 12, 13, 11, 15];
for (let column = 0; column < quoteWidths.length; column += 1) {
  quotes.getRangeByIndexes(0, column, 20, 1).format.columnWidth = quoteWidths[column];
}
quotes.freezePanes.freezeRows(1);

evidence.showGridLines = false;
evidence.getRange("A1:H1").values = [[
  "Claim ID",
  "Claim",
  "Verified value",
  "Source document",
  "Page / sheet",
  "Grade",
  "Confidence",
  "Review state",
]];
evidence.getRange("A2:H7").values = [
  ["EV-001", "Design flow", "420 gpm", "M-601 Equipment Schedule", "P-401", "A", 1, "VERIFIED"],
  ["EV-002", "Overall width", "1,780 mm", "Armstrong 4030 Submittal", "6", "A", 0.99, "VERIFIED"],
  ["EV-003", "Inlet connection", "4 in FLG", "Armstrong 4030 Submittal", "6", "A", 0.99, "VERIFIED"],
  ["EV-004", "Motor clearance", "915 mm", "Armstrong Installation Manual", "18", "A", 0.98, "VERIFIED"],
  ["EV-005", "Available inventory", "2 units", "Supplier Quote 7614", "1", "B", 1, "VERIFIED"],
  ["EV-006", "Delivery", "Aug 19", "Supplier Quote 7614", "1", "B", 1, "VERIFIED"],
];
evidence.getRange("A1:H7").format.borders = { preset: "all", style: "thin", color: line };
evidence.getRange("A1:H1").format = {
  fill: dark,
  font: { bold: true, color: "#FFFFFF", size: 9 },
  borders: { preset: "all", style: "thin", color: dark },
};
evidence.getRange("G2:G7").format.numberFormat = "0%";
evidence.getRange("A1:H20").format.rowHeight = 22;
evidence.getRange("A1:H20").format.wrapText = true;
const evidenceWidths = [12, 24, 20, 34, 14, 10, 13, 17];
for (let column = 0; column < evidenceWidths.length; column += 1) {
  evidence.getRangeByIndexes(0, column, 20, 1).format.columnWidth = evidenceWidths[column];
}
evidence.freezePanes.freezeRows(1);

const inspection = await workbook.inspect({
  kind: "sheet,formula,table",
  maxChars: 5000,
  tableMaxRows: 8,
  tableMaxCols: 14,
});
await fs.writeFile(
  path.join(outputDir, "BuildCrew_Quote_Leveling.inspect.json"),
  JSON.stringify(inspection, null, 2),
);

const inspectionText = JSON.stringify(inspection);
if (/#(?:REF|DIV\/0|VALUE|NAME|N\/A)[!?]?/i.test(inspectionText)) {
  throw new Error("Workbook inspection detected a formula error.");
}

const summaryPreview = await workbook.render({
  sheetName: "Decision Summary",
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(
  path.join(outputDir, "BuildCrew_Quote_Leveling.preview.png"),
  new Uint8Array(await summaryPreview.arrayBuffer()),
);

const output = await SpreadsheetFile.exportXlsx(workbook);
const workbookPath = path.join(outputDir, "BuildCrew_Quote_Leveling.xlsx");
await fs.rm(workbookPath, { force: true });
await output.save(workbookPath);
process.exitCode = 0;
console.log(workbookPath);
process.exit(0);
