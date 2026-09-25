"""Checks exported PDFs for text that leaves the page or overlaps other text.

Usage: python3 scripts/check-pdf.py file.pdf [...]   (needs PyMuPDF)
Exit code 1 when a problem is found.
"""
import sys

import pymupdf

EDGE = 8  # pt: text closer to the paper edge than this counts as clipped


def check(path: str) -> int:
    doc = pymupdf.open(path)
    problems = 0
    for number, page in enumerate(doc, start=1):
        rect = page.rect
        lines = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(s["text"] for s in line["spans"]).strip()
                if not text:
                    continue
                box = pymupdf.Rect(line["bbox"])
                # Font boxes include ascent and descent, so tight leading makes them
                # touch; compare the middle half of each line (the x-height band).
                quarter = box.height / 4
                lines.append((pymupdf.Rect(box.x0, box.y0 + quarter, box.x1, box.y1 - quarter), text))
                if box.x0 < EDGE or box.y0 < EDGE or box.x1 > rect.width - EDGE or box.y1 > rect.height - EDGE:
                    print(f"{path} p{number}: outside page: {text[:50]!r} {tuple(round(v) for v in box)}")
                    problems += 1
        for i, (a, ta) in enumerate(lines):
            for b, tb in lines[i + 1 :]:
                overlap = a & b
                if not overlap.is_empty and overlap.get_area() > 0.2 * min(a.get_area(), b.get_area()):
                    print(f"{path} p{number}: overlapping text: {ta[:30]!r} / {tb[:30]!r}")
                    problems += 1
    print(f"{path}: {doc.page_count} pages, {problems} problems")
    return problems


if __name__ == "__main__":
    sys.exit(1 if sum(check(p) for p in sys.argv[1:]) else 0)
