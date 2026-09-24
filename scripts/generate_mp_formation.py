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

def parse_formula(formula):
    counts = {}
    for el, num in re.findall(r"([A-Z][a-z]?)([0-9]*\.?[0-9]*)", (formula or "").replace(" ", "")):
        counts[el] = counts.get(el, 0.0) + (float(num) if num else 1.0)
    return counts

def metal_for_binary(formula, anion):
    counts = parse_formula(formula)
    elems = set(counts)
    if len(elems) != 2 or anion not in elems:
        return None
    candidates = (elems - {anion}) & METAL_SET
    return next(iter(candidates)) if len(candidates) == 1 else None

def reduced_formula(formula):
    # MP snapshot formulas used here are simple binary formulas; preserve them as displayed.
    return (formula or "").replace(" ", "")

def oxidation_candidates(formula, metal):
    counts = parse_formula(formula)
    if metal not in counts:
        return []
    n_m = counts[metal]
    if "Cl" in counts:
        # Chloride: Cl is treated as -1.
        return [round(counts["Cl"] / n_m, 3)]
    if "S" in counts:
        # Sulfide: retain both S2- and disulfide/polysulfide-like S- candidates.
        ratio = counts["S"] / n_m
        vals = [round(ratio, 3), round(2 * ratio, 3)]
        return sorted(set(v for v in vals if v > 0))
    return []

def dedupe_phases(items):
    best = {}
    for item in items:
        key = item["formula"]
        if key not in best or (item["e_form"], item["e_hull"]) < (best[key]["e_form"], best[key]["e_hull"]):
            best[key] = item
    return sorted(best.values(), key=lambda x: (
        999 if not x["metal_oxi_candidates"] else x["metal_oxi_candidates"][0],
        x["e_form"],
        x["formula"]
    ))

def same_valence(a, b, tol=0.06):
    return a is not None and b is not None and abs(a - b) <= tol

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
        formula_raw = row[idx["formula"]]
        try:
            formula = reduced_formula(formula_raw)
            e_form = float(row[idx["e_form"]])
            e_hull = float(row[idx["e_hull"]])
        except Exception:
            continue
        if not (math.isfinite(e_form) and math.isfinite(e_hull)):
            continue
        if e_hull > 1e-6:
            continue

        for anion in ("S", "Cl"):
            metal = metal_for_binary(formula, anion)
            if not metal:
                continue
            raw_counts[anion] += 1
            oxi_candidates = oxidation_candidates(formula, metal)
            item = {
                "formula": formula,
                "mpid": row[idx["mpid"]],
                "e_form": round(e_form, 6),
                "e_hull": round(e_hull, 8),
                "metal_oxi_candidates": oxi_candidates,
            }
            grouped[anion].setdefault(metal, []).append(item)

    phase_map = {}
    pairs = []
    paired_metals = set()

    for metal in METALS:
        sulfides = dedupe_phases(grouped["S"].get(metal, []))
        chlorides = dedupe_phases(grouped["Cl"].get(metal, []))
        if not sulfides and not chlorides:
            continue

        phase_map[metal] = {
            "sulfides": sulfides,
            "chlorides": chlorides,
        }

        matched_vals = []
        for s in sulfides:
            for cl in chlorides:
                for sv in s["metal_oxi_candidates"]:
                    for cv in cl["metal_oxi_candidates"]:
                        if same_valence(sv, cv):
                            v = round((sv + cv) / 2, 2)
                            if not any(abs(v - x) <= 0.05 for x in matched_vals):
                                matched_vals.append(v)

        for valence in sorted(matched_vals):
            s_candidates = [x for x in sulfides if any(abs(v - valence) <= 0.06 for v in x["metal_oxi_candidates"])]
            cl_candidates = [x for x in chlorides if any(abs(v - valence) <= 0.06 for v in x["metal_oxi_candidates"])]
            if not s_candidates or not cl_candidates:
                continue
            s = min(s_candidates, key=lambda x: (x["e_form"], x["e_hull"]))
            cl = min(cl_candidates, key=lambda x: (x["e_form"], x["e_hull"]))
            pairs.append({
                "m": metal,
                "valence": valence,
                "sulfide_formula": s["formula"],
                "sulfide_e": s["e_form"],
                "sulfide_entry_id": s["mpid"],
                "sulfide_e_hull": s["e_hull"],
                "chloride_formula": cl["formula"],
                "chloride_e": cl["e_form"],
                "chloride_entry_id": cl["mpid"],
                "chloride_e_hull": cl["e_hull"],
                "delta_s_minus_cl": round(s["e_form"] - cl["e_form"], 6),
            })
            paired_metals.add(metal)

    if len(pairs) < 10:
        raise RuntimeError(f"Only {len(pairs)} matched oxidation-state pairs obtained; refusing to overwrite dataset.")

    meta = {
        "source": "Materials Project",
        "distribution": "matminer mp_nostruct_20181018 public snapshot",
        "snapshot_date": SNAPSHOT,
        "dataset_url": DATA_URL,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "selection": "Stable binary M-S and M-Cl entries with e_hull <= 1e-6 eV/atom. Chlorides use Cl=-1. Sulfides retain two stoichiometric metal-valence candidates corresponding to S=-2 and S=-1 (disulfide/polysulfide-like). A 2D point is drawn when sulfide and chloride share a candidate within ±0.06. A 2D point is drawn when sulfide and chloride share a metal oxidation-state candidate within ±0.06.",
        "energy_unit": "eV/atom",
        "paired_points": len(pairs),
        "paired_metals": len(paired_metals),
        "snapshot_entries": len(rows),
        "stable_binary_sulfide_entries": raw_counts["S"],
        "stable_binary_chloride_entries": raw_counts["Cl"],
    }

    with open(OUT, "w", encoding="utf-8") as out:
        out.write("// Auto-generated from the public Materials Project 2018-10-18 snapshot distributed by matminer.\n")
        out.write("window.FORMATION_META = ")
        json.dump(meta, out, ensure_ascii=False, indent=2)
        out.write(";\nwindow.FORMATION_DATA = ")
        json.dump(pairs, out, ensure_ascii=False, indent=2)
        out.write(";\nwindow.FORMATION_PHASES = ")
        json.dump(phase_map, out, ensure_ascii=False, indent=2)
        out.write(";\n")

    print(f"Snapshot rows: {len(rows)}")
    print(f"Stable binary entries before formula de-duplication: S={raw_counts['S']}, Cl={raw_counts['Cl']}")
    print(f"Wrote {len(pairs)} matched oxidation-state points across {len(paired_metals)} metals")
    for key in ("Li","Na","Al","Fe","Ti","Zr","Nb","Ta","Hf","Sn"):
        key_pairs = [p for p in pairs if p["m"] == key]
        if key_pairs:
            print(key, [(p["valence"], p["sulfide_formula"], p["chloride_formula"]) for p in key_pairs])

if __name__ == "__main__":
    main()
