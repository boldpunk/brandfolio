#!/usr/bin/env python3
"""Builds the static font files shipped in public/fonts.

Source files are the variable fonts from github.com/google/fonts (SIL OFL 1.1).
@react-pdf/renderer embeds static TTF faces, so each weight we offer is
instanced from the variable font and subset to Latin, Latin Extended, Cyrillic
and general punctuation. That covers Russian, English and Uzbek Latin
(including U+2018 ‘ used in o‘ and g‘).

Usage:
  python3 -m pip install fonttools
  python3 scripts/build-fonts.py   # downloads sources into fonts-src/ when missing
"""

import hashlib
import json
import pathlib
import shutil
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "fonts-src"
OUT = ROOT / "public" / "fonts"
BASE_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/"

FAMILIES = {
    "Manrope": {
        "source": "manrope/Manrope%5Bwght%5D.ttf",
        "license": "manrope/OFL.txt",
        "axes": {},
        "weights": [400, 600, 700],
    },
    "NotoSans": {
        "source": "notosans/NotoSans%5Bwdth,wght%5D.ttf",
        "license": "notosans/OFL.txt",
        "axes": {"wdth": 100},
        "weights": [400, 600, 700],
    },
    "NotoSerif": {
        "source": "notoserif/NotoSerif%5Bwdth,wght%5D.ttf",
        "license": "notoserif/OFL.txt",
        "axes": {"wdth": 100},
        "weights": [400, 700],
    },
    "JetBrainsMono": {
        "source": "jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf",
        "license": "jetbrainsmono/OFL.txt",
        "axes": {},
        "weights": [400],
    },
}

UNICODES = [
    *range(0x0020, 0x007F),  # Basic Latin
    *range(0x00A0, 0x0180),  # Latin-1 Supplement, Latin Extended-A
    *range(0x0180, 0x0250),  # Latin Extended-B
    *range(0x02B0, 0x0300),  # Spacing modifiers (ʻ U+02BB used in some Uzbek texts)
    *range(0x0300, 0x0370),  # Combining marks
    *range(0x0400, 0x0530),  # Cyrillic + Supplement
    *range(0x2000, 0x2070),  # General punctuation
    *range(0x20A0, 0x20C1),  # Currency
    0x2116,  # №
    0x2122,  # ™
    0x2190, 0x2192,  # arrows
    0x2212,  # minus
]


def fetch(rel: str, name: str) -> pathlib.Path:
    SRC.mkdir(exist_ok=True)
    target = SRC / name
    if not target.exists():
        with urllib.request.urlopen(BASE_URL + rel) as resp, open(target, "wb") as fh:
            shutil.copyfileobj(resp, fh)
    return target


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for family, spec in FAMILIES.items():
        vf_path = fetch(spec["source"], f"{family}-VF.ttf")
        license_path = fetch(spec["license"], f"{family}-OFL.txt")
        shutil.copy(license_path, OUT / f"{family}-OFL.txt")
        for weight in spec["weights"]:
            font = TTFont(vf_path)
            static = instancer.instantiateVariableFont(
                font, {**spec["axes"], "wght": weight}, updateFontNames=True
            )
            options = subset.Options()
            options.layout_features = ["*"]
            options.name_IDs = ["*"]
            options.notdef_outline = True
            options.glyph_names = False
            subsetter = subset.Subsetter(options)
            subsetter.populate(unicodes=UNICODES)
            subsetter.subset(static)
            out_name = f"{family}-{weight}.ttf"
            static.save(OUT / out_name)
            data = (OUT / out_name).read_bytes()
            manifest.append(
                {
                    "family": family,
                    "weight": weight,
                    "file": out_name,
                    "bytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "source": BASE_URL + spec["source"],
                    "sourceSha256": hashlib.sha256(vf_path.read_bytes()).hexdigest(),
                    "license": "SIL Open Font License 1.1",
                }
            )
            print(f"{out_name}: {len(data)} bytes")
    (OUT / "fonts.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
