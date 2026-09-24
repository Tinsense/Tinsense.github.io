#!/usr/bin/env python3
import json
import math
import re
import time
from datetime import datetime, timezone

import requests

API = "https://oqmd.org/oqmdapi/formationenergy"
OUT = "metal-formation-energy/data.js"

METALS = [
    "Li","Be","Na","Mg","Al","K","Ca","Sc","Ti","V","Cr","Mn","Fe","Co","Ni","Cu","Zn","Ga",
    "Rb","Sr","Y","Zr","Nb","Mo","Tc","Ru","Rh","Pd","Ag","Cd","In","Sn","Sb","Cs","Ba",
    "La","Ce","Pr","Nd","Pm","Sm","Eu","Gd","Tb","Dy","Ho","Er","Tm","Yb","Lu",
    "Hf","Ta","W","Re","Os","Ir","Pt","Au","Hg","Tl","Pb","Bi","Po",
    "Fr","Ra","Ac","Th","Pa","U","Np","Pu","Am","Cm","Bk","Cf"
]
METAL_SET = set(METALS)

session = requests.Session()
session.headers.update({
    "User-Agent": "Tinsense-material-energy-map/1.0 (public scientific data visualization)"
})

def fetch_binary_family(anion):
    rows = []
    offset = 0
    limit = 500
    while True:
        params = {
            "fields": "name,entry_id,icsd_id,delta_e,stability,ntypes",
            "limit": limit,
            "offset": offset,
            "noduplicate": "True",
            "format": "json",
            "filter": f"element={anion} AND ntypes=2 AND stability=0",
        }
        last_exc = None
        payload = None
        for attempt in range(3):
            try:
                r = session.get(API, params=params, timeout=30)
                r.raise_for_status()
                payload = r.json()
                break
            except Exception as exc:
                last_exc = exc
                time.sleep(1.2 * (attempt + 1))
        if payload is None:
            raise RuntimeError(f"{anion} family query failed: {last_exc}")

        batch = payload.get("data", [])
        rows.extend(batch)
        meta = payload.get("meta", {})
        available = int(meta.get("data_available", len(rows)) or len(rows))
        if not batch or len(rows) >= available:
            break
        offset += len(batch)

    return rows

def parse_metal(formula, anion):
    elems = set(re.findall(r"[A-Z][a-z]?", formula or ""))
    candidates = (elems - {anion}) & METAL_SET
    if len(candidates) == 1 and len(elems) == 2:
        return next(iter(candidates))
    return None

def best_by_metal(rows, anion):
    grouped = {}
    for row in rows:
        metal = parse_metal(row.get("name"), anion)
        if not metal:
            continue
        try:
            e = float(row["delta_e"])
            st = float(row.get("stability", 0))
        except (TypeError, ValueError, KeyError):
            continue
        if not (math.isfinite(e) and math.isfinite(st)):
            continue
        item = {
            "formula": row.get("name"),
            "entry_id": row.get("entry_id"),
            "icsd_id": row.get("icsd_id"),
            "e_form": e,
            "stability": st,
        }
        grouped.setdefault(metal, []).append(item)

    for metal in grouped:
        grouped[metal].sort(key=lambda x: (x["e_form"], x["stability"]))
    return grouped

def main():
    sulfide_rows = fetch_binary_family("S")
    chloride_rows = fetch_binary_family("Cl")
    sulfides = best_by_metal(sulfide_rows, "S")
    chlorides = best_by_metal(chloride_rows, "Cl")

    records = []
    for metal in METALS:
        if metal not in sulfides or metal not in chlorides:
            continue
        s = sulfides[metal][0]
        cl = chlorides[metal][0]
        records.append({
            "m": metal,
            "sulfide_formula": s["formula"],
            "sulfide_e": round(s["e_form"], 6),
            "sulfide_entry_id": s["entry_id"],
            "sulfide_icsd_id": s["icsd_id"],
            "sulfide_stable_count": len(sulfides[metal]),
            "chloride_formula": cl["formula"],
            "chloride_e": round(cl["e_form"], 6),
            "chloride_entry_id": cl["entry_id"],
            "chloride_icsd_id": cl["icsd_id"],
            "chloride_stable_count": len(chlorides[metal]),
            "delta_s_minus_cl": round(s["e_form"] - cl["e_form"], 6),
        })

    if len(records) < 10:
        raise RuntimeError(f"Only {len(records)} paired records obtained; refusing to overwrite dataset.")

    meta = {
        "source": "OQMD",
        "source_url": "https://oqmd.org/",
        "api_url": API,
        "license": "CC BY 4.0",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "selection": "Stable binary M-S and M-Cl entries (stability=0, ntypes=2); representative is the stable phase with the most negative formation energy per atom.",
        "energy_unit": "eV/atom",
        "paired_metals": len(records),
        "raw_stable_sulfide_entries": len(sulfide_rows),
        "raw_stable_chloride_entries": len(chloride_rows),
    }

    with open(OUT, "w", encoding="utf-8") as out:
        out.write("// Auto-generated from the public OQMD REST API. Do not hand-edit.\n")
        out.write("window.FORMATION_META = ")
        json.dump(meta, out, ensure_ascii=False, indent=2)
        out.write(";\nwindow.FORMATION_DATA = ")
        json.dump(records, out, ensure_ascii=False, indent=2)
        out.write(";\n")

    print(f"Stable binary rows: S={len(sulfide_rows)}, Cl={len(chloride_rows)}")
    print(f"Wrote {len(records)} paired metals to {OUT}")

if __name__ == "__main__":
    main()
