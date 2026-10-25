"""Rasterize Python's computed summary. No financial math or generated copy from an LLM."""
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import engine as E

PALETTES = {
    "light": {"bg": "#FFFFFF", "ink": "#10211F", "muted": "#3F5552", "teal": "#0E7C74", "soft": "#E3F1EF", "line": "#DCE6E4"},
    "dark": {"bg": "#04120F", "ink": "#E8F1EF", "muted": "#9DB4B0", "teal": "#35BDB3", "soft": "#15302D", "line": "#1E3835"},
}
FONT_DIR = Path(__file__).parent / "assets"


def render_summary(s, theme, business, stamp):
    p = PALETTES[theme]
    image = Image.new("RGB", (1080, 1350), p["bg"])
    draw = ImageDraw.Draw(image)

    def font(size, bold=False):
        local = FONT_DIR / ("Figtree-Bold.ttf" if bold else "Figtree-Regular.ttf")
        fallback = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        face = ImageFont.truetype(str(local) if local.exists() else fallback, size)
        if local.exists():
            face.set_variation_by_axes([700 if bold else 400])
        return face

    def text(x, y, value, size=30, color="ink", bold=False):
        draw.text((x, y), value, font=font(size, bold), fill=p.get(color, color))

    for i, h in enumerate((34, 48, 60)):
        draw.rounded_rectangle((72+i*20, 114-h, 85+i*20, 114), radius=5, fill=p["teal"])
    text(150, 57, "Gapless", 46, bold=True)
    text(72, 160, business, 32, "muted")
    draw.rounded_rectangle((72, 254, 1008, 572), radius=36, fill=p["soft"])
    text(112, 290, "FRIDAY, TAKEN CARE OF", 24, "teal", True)
    text(112, 350, "Payroll covered", 68, bold=True)
    text(112, 457, s["friday_label"], 36, "muted")
    rows = [("Payroll forecast covered", E.fmt_money(s["payroll"])),
            ("Projected cash to spare", E.fmt_money(s["spare"])),
            ("Cost to close the gap", E.fmt_money(s["total_cost"]))]
    for i, (label, value) in enumerate(rows):
        y = 625+i*145
        text(72, y, label, 27, "muted")
        text(72, y+42, value, 52, "teal" if i == 1 else "ink", True)
        draw.line((72, y+119, 1008, y+119), fill=p["line"], width=2)
    text(72, 1090, "One less thing to worry about.", 33, bold=True)
    text(72, 1170, "DEMO · Synthetic data · Not a payroll payment receipt", 25, "muted")
    text(72, 1220, f"Prepared {stamp} · Forecast, not a guarantee", 25, "muted")
    output = BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()
