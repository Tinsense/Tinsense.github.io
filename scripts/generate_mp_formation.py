#!/usr/bin/env python3
import gzip
import json
import math
import re
from datetime import datetime, timezone

import requests

DATA_URL = "https://ndownloader.figshare.com/files/13309253"
OUT = "metal-formation-energy/data.js"
SNAPSHOT = "2018-10-18"

METALS = [
    "Li","Be","Na","Mg","Al","K","Ca","Sc","Ti","V","Cr","Mn","Fe","Co","Ni","Cu","Zn","Ga",
    "Rb","Sr","Y","Zr","Nb","Mo","Tc","Ru","Rh","Pd","Ag","Cd","In","Sn","Sb","Cs","Ba",
    "La","Ce","Pr","Nd","Pm","Sm","Eu","Gd","Tb","Dy","Ho","Er","Tm","Yb","Lu",
    "Hf","Ta","W","Re","Os","Ir","Pt","Au","Hg","Tl","Pb","Bi","Po",
    "Fr","Ra","Ac","Th","Pa","U","Np","Pu","Am","Cm","Bk","Cf"
]
METAL_SET = set(METALS)

def elements(formula):
    return set(re.findall(r"[A-Z][a-z]?", formula or ""))

def metal_for_binary(formula, anion):
    elems = elements(formula)
    if len(elems) != 2 or anion not in elems:
        return None
    candidates = (elems - {anion}) & METAL_SET
    return next(iter(candidates)) if len(candidates) == 1 else None

def main():
    print(f"Downloading public Materials Project snapshot from {DATA_URL}")
    r = requests.get(DATA_URL, timeout=180)
    r.raise_for_status()
    payload = json.loads(gzip.decompress(r.content).decode("utf-8"))

    columns = payload["columns"]
    rows = payload["data"]
    idx = {name: columns.index(name) for name in ["formula", "mpid", "e_form", "e_hull"]}

    grouped = {"S": {}, "Cl": {}}
    raw_counts = {"S": 0, "Cl": 0}

    for row in rows:
        formula = row[idx["formula"]]
        try:
            e_form = float(row[idx["e_form"]])
            e_hull = float(row[idx["e_hull"]])
        except (TypeError, ValueError):
            continue
        if not (math.isfinite(e_form) and math.isfinite(e_hull)):
            continue

        # Treat tiny floating-point hull values as stable.
        if e_hull > 1e-6:
            continue

        for anion in ("S", "Cl"):
            metal = metal_for_binary(formula, anion)
            if not metal:
                continue
            raw_counts[anion] += 1
            item = {
                "formula": formula,
                "mpid": row[idx["mpid"]],
                "e_form": e_form,
                "e_hull": e_hull,
            }
            grouped[anion].setdefault(metal, []).append(item)

    for anion in grouped:
        for metal in grouped[anion]:
            grouped[anion][metal].sort(key=lambda x: (x["e_form"], x["e_hull"], x["formula"]))

    records = []
    for metal in METALS:
        sulfides = grouped["S"].get(metal, [])
        chlorides = grouped["Cl"].get(metal, [])
        if not sulfides or not chlorides:
            continue
        s = sulfides[0]
        cl = chlorides[0]
        records.append({
            "m": metal,
            "sulfide_formula": s["formula"],
            "sulfide_e": round(s["e_form"], 6),
            "sulfide_entry_id": s["mpid"],
            "sulfide_e_hull": round(s["e_hull"], 8),
            "sulfide_stable_count": len(sulfides),
            "chloride_formula": cl["formula"],
            "chloride_e": round(cl["e_form"], 6),
            "chloride_entry_id": cl["mpid"],
            "chloride_e_hull": round(cl["e_hull"], 8),
            "chloride_stable_count": len(chlorides),
            "delta_s_minus_cl": round(s["e_form"] - cl["e_form"], 6),
        })

    if len(records) < 10:
        raise RuntimeError(f"Only {len(records)} paired records obtained; refusing to overwrite dataset.")

    meta = {
        "source": "Materials Project",
        "distribution": "matminer mp_nostruct_20181018 public snapshot",
        "snapshot_date": SNAPSHOT,
        "dataset_url": DATA_URL,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "selection": "Binary M-S and M-Cl entries with e_hull <= 1e-6 eV/atom; representative is the stable phase with the most negative formation energy per atom.",
        "energy_unit": "eV/atom",
        "paired_metals": len(records),
        "snapshot_entries": len(rows),
        "stable_binary_sulfide_entries": raw_counts["S"],
        "stable_binary_chloride_entries": raw_counts["Cl"],
    }

    with open(OUT, "w", encoding="utf-8") as out:
        out.write("// Auto-generated from the public Materials Project 2018-10-18 snapshot distributed by matminer.\n")
        out.write("window.FORMATION_META = ")
        json.dump(meta, out, ensure_ascii=False, indent=2)
        out.write(";\nwindow.FORMATION_DATA = ")
        json.dump(records, out, ensure_ascii=False, indent=2)
        out.write(";\n")

    print(f"Snapshot rows: {len(rows)}")
    print(f"Stable binaries: S={raw_counts['S']}, Cl={raw_counts['Cl']}")
    print(f"Wrote {len(records)} paired metals to {OUT}")

if __name__ == "__main__":
    main()
