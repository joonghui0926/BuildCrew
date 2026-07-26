from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "apps" / "web" / "public" / "demo" / "inputs"
OUTPUT.mkdir(parents=True, exist_ok=True)

NAVY = colors.HexColor("#18342F")
GREEN = colors.HexColor("#31B884")
PALE_GREEN = colors.HexColor("#E9F7F1")
INK = colors.HexColor("#172321")
MUTED = colors.HexColor("#5F716D")
LINE = colors.HexColor("#D9E4E0")
PALE = colors.HexColor("#F4F7F6")
RED = colors.HexColor("#C84F45")

styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="DocumentTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=21,
        leading=25,
        textColor=NAVY,
        alignment=TA_LEFT,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="Section",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=NAVY,
        spaceBefore=12,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="BodySmall",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=INK,
    )
)
styles.add(
    ParagraphStyle(
        name="Label",
        parent=styles["BodyText"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=9,
        textColor=MUTED,
        uppercase=True,
    )
)
styles.add(
    ParagraphStyle(
        name="Value",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9,
        leading=11,
        textColor=INK,
    )
)
styles.add(
    ParagraphStyle(
        name="CenterSmall",
        parent=styles["BodySmall"],
        alignment=TA_CENTER,
    )
)
styles.add(
    ParagraphStyle(
        name="RightSmall",
        parent=styles["BodySmall"],
        alignment=TA_RIGHT,
    )
)


def footer(canvas, doc):
    canvas.saveState()
    width, _ = doc.pagesize
    canvas.setStrokeColor(LINE)
    canvas.line(doc.leftMargin, 0.45 * inch, width - doc.rightMargin, 0.45 * inch)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 0.28 * inch, "BuildCrew demo project - Mission Bay Data Center")
    canvas.drawRightString(
        width - doc.rightMargin,
        0.28 * inch,
        f"BC-2026-0142  |  Page {doc.page}",
    )
    canvas.restoreState()


def doc(path: Path, *, wide: bool = False) -> SimpleDocTemplate:
    return SimpleDocTemplate(
        str(path),
        pagesize=landscape(letter) if wide else letter,
        rightMargin=0.55 * inch,
        leftMargin=0.55 * inch,
        topMargin=0.5 * inch,
        bottomMargin=0.6 * inch,
        title=path.stem.replace("-", " ").title(),
        author="BuildCrew",
    )


def p(text: str, style: str = "BodySmall") -> Paragraph:
    return Paragraph(text, styles[style])


def meta_table(rows: list[tuple[str, str]]) -> Table:
    cells = []
    for label, value in rows:
        cells.append([p(label.upper(), "Label"), p(value, "Value")])
    table = Table(cells, colWidths=[1.45 * inch, 5.8 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), PALE),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def data_table(
    rows: list[list[str]],
    widths: list[float],
    *,
    header_color=NAVY,
    font_size: float = 7.5,
) -> Table:
    converted = [[p(cell, "CenterSmall" if index else "BodySmall") for index, cell in enumerate(row)] for row in rows]
    table = Table(converted, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), header_color),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), font_size),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
                ("GRID", (0, 0), (-1, -1), 0.45, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return table


def build_specification():
    path = OUTPUT / "project-specification-23-21-23.pdf"
    story = [
        p("SECTION 23 21 23", "Label"),
        p("Hydronic Pumps", "DocumentTitle"),
        p("Issued for Construction - Addendum 04", "BodySmall"),
        Spacer(1, 10),
        meta_table(
            [
                ("Project", "Mission Bay Data Center"),
                ("Equipment", "P-401 / P-402 chilled-water pumps"),
                ("Design authority", "Northline MEP Engineers"),
                ("Specification date", "2026-05-18"),
            ]
        ),
        p("1.01 Summary", "Section"),
        p(
            "Provide factory-assembled, base-mounted, end-suction centrifugal pumps with motors, bases, couplings, guards, seals, and accessories required for a complete chilled-water installation.",
        ),
        p("1.02 Submittals", "Section"),
        p(
            "Submit certified performance curves, dimensional drawings, motor data, connection sizes and locations, weights, installation instructions, minimum service clearances, and a point-by-point compliance statement. Product substitutions require written approval before purchase.",
        ),
        p("1.03 Quality Assurance", "Section"),
        p(
            "Pump and motor assembly shall be manufactured under an ISO 9001 quality system. Motors shall comply with NEMA MG 1 and meet NEMA Premium efficiency. Electrical components shall be suitable for 480 V, 3 phase, 60 Hz service.",
        ),
        p("2.01 Performance Requirements", "Section"),
        data_table(
            [
                ["Requirement", "P-401 value", "Tolerance / status", "Evidence class"],
                ["Design flow", "420 gpm", "No less than scheduled", "Hard"],
                ["Design head", "105 ft", "+/- 3 percent at duty point", "Hard"],
                ["Motor", "30 hp, 480 V, 3 ph, 60 Hz", "No overload at any curve point", "Hard"],
                ["Suction connection", "4 in, ASME B16.1 Class 125 flange", "Exact interface required", "Hard"],
                ["Discharge connection", "3 in, ASME B16.1 Class 125 flange", "Exact interface required", "Hard"],
                ["Working pressure", "175 psig minimum", "No reduction permitted", "Hard"],
                ["Efficiency", "Minimum 79 percent at duty point", "No lower than scheduled", "Hard"],
                ["Seal", "Mechanical, carbon/ceramic, EPDM", "Equivalent accepted", "Negotiable"],
                ["Finish", "Manufacturer standard", "Color may vary", "Negotiable"],
            ],
            [2.2 * inch, 2.3 * inch, 1.9 * inch, 0.85 * inch],
        ),
        PageBreak(),
        p("2.02 Construction", "Section"),
        data_table(
            [
                ["Component", "Requirement"],
                ["Casing", "Cast iron, back pull-out configuration, replaceable wear ring."],
                ["Impeller", "Bronze, dynamically balanced, trimmed for scheduled duty point."],
                ["Shaft", "Stainless steel or steel with replaceable sleeve."],
                ["Base", "Common structural steel base sized for pump and motor assembly."],
                ["Coupling guard", "OSHA-compliant, removable without disturbing alignment."],
                ["Bearings", "Grease-lubricated, minimum L10 life of 100,000 hours at duty point."],
            ],
            [1.5 * inch, 5.75 * inch],
        ),
        p("2.03 Dimensional and Coordination Requirements", "Section"),
        data_table(
            [
                ["Constraint", "Maximum / required value", "Source"],
                ["Housekeeping pad", "2050 x 950 mm", "M-601, Pump Room 4"],
                ["Overall equipment envelope", "1950 x 850 x 1150 mm", "M-601 / coordination model"],
                ["Motor-removal clearance", "915 mm minimum behind motor", "Manufacturer instruction"],
                ["Electrical working clearance", "914 mm clear in front of disconnect", "E-401"],
                ["Service aisle", "760 mm minimum", "M-601"],
                ["Connection relocation", "Maximum 50 mm with approved spool", "Project coordination rule"],
            ],
            [2.05 * inch, 2.45 * inch, 2.75 * inch],
        ),
        p("3.01 Substitution Review", "Section"),
        p(
            "A proposed substitute will be evaluated on technical compliance, verified availability, total installed cost, schedule impact, physical fit, connection alignment, maintenance access, and installation access. Purchase price alone is not a basis for selection.",
        ),
        p("3.02 Required Approval Package", "Section"),
        p(
            "Provide a compliance matrix, certified curve, manufacturer dimensional drawing, current supplier quotation, inventory timestamp, delivery commitment, coordinated BIM object, clash report, maintenance-clearance review, cost impact, schedule impact, and draft RFI. Critical dimensions without manufacturer evidence shall be marked unresolved and shall not be inferred.",
        ),
    ]
    document = doc(path)
    document.build(story, onFirstPage=footer, onLaterPages=footer)


def build_schedule():
    path = OUTPUT / "equipment-schedule-m601.pdf"
    story = [
        p("DRAWING M-601", "Label"),
        p("Mechanical Equipment Schedule", "DocumentTitle"),
        meta_table(
            [
                ("Project", "Mission Bay Data Center"),
                ("Area", "Level B1 - Pump Room 4"),
                ("Issue", "IFC Addendum 04"),
                ("Date", "2026-05-18"),
            ]
        ),
        Spacer(1, 12),
        data_table(
            [
                ["Tag", "Service", "Qty", "Flow", "Head", "Motor", "Power", "Connections", "Required on site"],
                ["P-401", "CHW primary pump", "1", "420 gpm", "105 ft", "30 hp", "480/3/60", '4 in S / 3 in D', "2026-08-28"],
                ["P-402", "CHW primary standby", "1", "420 gpm", "105 ft", "30 hp", "480/3/60", '4 in S / 3 in D', "2026-09-04"],
                ["P-411", "Condenser water", "1", "550 gpm", "88 ft", "40 hp", "480/3/60", '5 in S / 4 in D', "2026-09-12"],
                ["ET-401", "CHW expansion tank", "1", "120 gal", "-", "-", "-", '2 in', "2026-09-20"],
            ],
            [0.62 * inch, 1.45 * inch, 0.38 * inch, 0.65 * inch, 0.55 * inch, 0.58 * inch, 0.62 * inch, 1.0 * inch, 1.05 * inch],
        ),
        p("Schedule Notes", "Section"),
        p("1. Final pump selection shall not overload the scheduled motor at any point on the published curve."),
        p("2. Coordinate exact connection locations and housekeeping-pad dimensions with approved submittal."),
        p("3. Maintain manufacturer-required motor-removal clearance and project service aisle."),
        p("4. P-401 is on the commissioning critical path. Delivery after 2026-08-28 requires an approved recovery plan."),
        p("5. Provide a coordination-ready BIM object before substitution approval."),
    ]
    document = doc(path, wide=True)
    document.build(story, onFirstPage=footer, onLaterPages=footer)


def build_original_submittal():
    path = OUTPUT / "original-submittal-bell-gossett-e1510.pdf"
    story = [
        p("SUBMITTAL 23 21 23-07", "Label"),
        p("Original Approved Pump - P-401", "DocumentTitle"),
        meta_table(
            [
                ("Manufacturer", "Bell & Gossett"),
                ("Model", "e-1510 4BD"),
                ("Status", "Approved as noted - 2026-04-10"),
                ("Supplier", "Bay Mechanical Equipment"),
            ]
        ),
        p("Approved Duty and Interfaces", "Section"),
        data_table(
            [
                ["Property", "Approved value", "Evidence status"],
                ["Design duty", "420 gpm at 105 ft TDH", "Certified curve"],
                ["Motor", "30 hp, 480 V, 3 phase, 60 Hz, NEMA Premium", "Motor schedule"],
                ["Suction", "4 in Class 125 flange, horizontal", "Dimension sheet"],
                ["Discharge", "3 in Class 125 flange, vertical", "Dimension sheet"],
                ["Overall envelope", "1860 x 810 x 1080 mm", "Dimension sheet"],
                ["Base", "1920 x 840 mm", "Dimension sheet"],
                ["Motor removal", "915 mm minimum", "Installation manual"],
                ["Operating weight", "492 kg", "Manufacturer schedule"],
            ],
            [2.05 * inch, 3.55 * inch, 1.65 * inch],
        ),
        p("Approval Notes", "Section"),
        p(
            "Approval is limited to the scheduled duty and documented interfaces. Contractor remains responsible for coordination, access, field dimensions, electrical characteristics, and compliance with contract documents.",
        ),
        p("Delay Notice Reference", "Section"),
        p(
            "Supplier notice BN-4472 dated 2026-07-26 revised the ship date from 2026-08-12 to 2026-11-13 due to casting availability. The revised delivery is 77 days after the project required-on-site date.",
        ),
    ]
    document = doc(path)
    document.build(story, onFirstPage=footer, onLaterPages=footer)


def build_candidate_datasheet(
    filename: str,
    manufacturer: str,
    model: str,
    dimensions: str,
    base: str,
    suction: str,
    discharge: str,
    clearance: str,
    note: str,
):
    path = OUTPUT / filename
    story = [
        p("MANUFACTURER DATA - DEMO EXTRACT", "Label"),
        p(f"{manufacturer} {model}", "DocumentTitle"),
        meta_table(
            [
                ("Equipment type", "Base-mounted end-suction centrifugal pump"),
                ("Selected duty", "420 gpm at 105 ft TDH"),
                ("Motor", "30 hp, 480 V, 3 phase, 60 Hz"),
                ("Configuration", "Back pull-out, mechanical seal, common base"),
            ]
        ),
        p("Model-Specific Dimensional Schedule", "Section"),
        data_table(
            [
                ["Property", "Published value", "Coordination classification"],
                ["Overall L x W x H", dimensions, "Installation critical"],
                ["Base L x W", base, "Installation critical"],
                ["Suction connection", suction, "Installation critical"],
                ["Discharge connection", discharge, "Installation critical"],
                ["Motor-removal clearance", clearance, "Installation critical"],
                ["Casing pressure", "175 psig", "Hard requirement"],
                ["Duty-point efficiency", "80 percent", "Hard requirement"],
            ],
            [2.25 * inch, 2.55 * inch, 2.45 * inch],
        ),
        p("Coordination Note", "Section"),
        p(note),
        p("Evidence Statement", "Section"),
        p(
            "This BuildCrew hackathon document is a model-specific demo extract prepared to exercise document provenance, BIM generation, placement, and coordination workflows. Values are fixed and traceable within the demo case.",
        ),
    ]
    document = doc(path)
    document.build(story, onFirstPage=footer, onLaterPages=footer)


def build_quote(
    filename: str,
    supplier: str,
    reference: str,
    manufacturer: str,
    model: str,
    inventory: str,
    ship_from: str,
    delivery: str,
    unit_price: str,
    freight: str,
    total: str,
):
    path = OUTPUT / filename
    story = [
        p("SUPPLIER QUOTATION - DEMO", "Label"),
        p(f"Quotation {reference}", "DocumentTitle"),
        meta_table(
            [
                ("Supplier", supplier),
                ("Project", "Mission Bay Data Center"),
                ("Request", "P-401 chilled-water pump recovery"),
                ("Issued", "2026-07-26"),
                ("Valid through", "2026-08-02"),
            ]
        ),
        p("Quoted Equipment", "Section"),
        data_table(
            [
                ["Manufacturer", "Exact model", "Qty", "Inventory", "Ship from", "Guaranteed arrival"],
                [manufacturer, model, "1", inventory, ship_from, delivery],
            ],
            [1.3 * inch, 1.55 * inch, 0.45 * inch, 1.0 * inch, 1.2 * inch, 1.4 * inch],
        ),
        p("Commercial Summary", "Section"),
        data_table(
            [
                ["Line", "Description", "Amount"],
                ["1", "Pump, motor, common base, coupling and guard", unit_price],
                ["2", "Expedited freight to San Francisco, CA", freight],
                ["Total", "Delivered equipment total", total],
            ],
            [0.8 * inch, 4.75 * inch, 1.7 * inch],
            header_color=GREEN,
        ),
        p("Supplier Confirmation", "Section"),
        p(
            f"Inventory shown above was checked at 09:42 PDT on 2026-07-26. Delivery is conditional on receipt of an approved purchase release by 15:00 PDT on 2026-07-28. A 48-hour inventory hold may be requested by email and is not a purchase order.",
        ),
        p("Terms", "Section"),
        p(
            "Net 30 subject to credit approval. Taxes excluded. Freight included as shown. Field installation, alignment, controls integration, and project modifications are excluded.",
        ),
    ]
    document = doc(path)
    document.build(story, onFirstPage=footer, onLaterPages=footer)


def build_all():
    build_specification()
    build_schedule()
    build_original_submittal()
    build_candidate_datasheet(
        "manufacturer-ksb-etanorm.pdf",
        "KSB",
        "Etanorm 065-040-250",
        "1740 x 780 x 1010 mm",
        "1810 x 800 mm",
        "DN100 / 4 in horizontal flange",
        "DN80 / 3 in vertical flange, 180 mm offset",
        "860 mm",
        "The published discharge centerline is 180 mm from the existing P-401 connection centerline and requires coordination before approval.",
    )
    build_candidate_datasheet(
        "manufacturer-grundfos-nb.pdf",
        "Grundfos",
        "NB 65-125/142",
        "1690 x 745 x 950 mm",
        "1760 x 770 mm",
        "DN100 / 4 in horizontal flange",
        "DN80 / 3 in vertical flange, 40 mm offset",
        "1020 mm",
        "The pump fits the housekeeping pad, but the required 1020 mm motor-removal zone must be checked against the west concrete wall.",
    )
    build_candidate_datasheet(
        "manufacturer-armstrong-4030.pdf",
        "Armstrong",
        "4030 4x3x10",
        "1780 x 760 x 980 mm",
        "1840 x 780 mm",
        "100 mm / 4 in horizontal flange",
        "80 mm / 3 in vertical flange, 25 mm offset",
        "915 mm",
        "The model satisfies the equipment envelope and service-clearance requirements. A 25 mm discharge spool adjustment is required.",
    )
    build_quote(
        "quote-ksb-2418.pdf",
        "Western States Pumps",
        "KSB-2418",
        "KSB",
        "Etanorm 065-040-250",
        "4 units available",
        "Reno, NV",
        "2026-08-17",
        "$26,900.00",
        "$1,600.00",
        "$28,500.00",
    )
    build_quote(
        "quote-grundfos-9017.pdf",
        "Pacific Pump Supply",
        "GNF-9017",
        "Grundfos",
        "NB 65-125/142",
        "2 units available",
        "Sacramento, CA",
        "2026-08-18",
        "$28,420.00",
        "$1,700.00",
        "$30,120.00",
    )
    build_quote(
        "quote-armstrong-7614.pdf",
        "Pacific Pump Supply",
        "7614",
        "Armstrong",
        "4030 4x3x10",
        "2 units available",
        "Hayward, CA",
        "2026-08-19",
        "$29,880.00",
        "$1,800.00",
        "$31,680.00",
    )


if __name__ == "__main__":
    build_all()
