#!/usr/bin/env python3
import gzip
import json
import math
from datetime import datetime, timezone

import requests
from pymatgen.core import Composition

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

def metal_for_binary(formula, anion):
    comp = Composition(formula)
    elems = {str(el) for el in comp.elements}
    if len(elems) != 2 or anion not in elems:
        return None
    candidates = (elems - {anion}) & METAL_SET
    return next(iter(candidates)) if len(candidates) == 1 else None

def oxidation_guess(formula, metal):
    try:
        guesses = Composition(formula).oxi_state_guesses()
    except Exception:
        return None, None
    if not guesses:
        return None, None
    guess = guesses[0]
    if metal not in guess:
        return None, guess
    try:
        val = float(guess[metal])
    except (TypeError, ValueError):
        return None, guess
    return round(val, 3), {k: round(float(v), 3) for k, v in guess.items()}

def dedupe_phases(items):
    best = {}
    for item in items:
        key = item["formula"]
        if key not in best or (item["e_form"], item["e_hull"]) < (best[key]["e_form"], best[key]["e_hull"]):
            best[key] = item
    return sorted(best.values(), key=lambda x: (
        999 if x["metal_oxi"] is None else x["metal_oxi"],
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
            comp = Composition(formula_raw)
            formula = comp.reduced_formula
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
            metal_oxi, full_guess = oxidation_guess(formula, metal)
            item = {
                "formula": formula,
                "mpid": row[idx["mpid"]],
                "e_form": round(e_form, 6),
                "e_hull": round(e_hull, 8),
                "metal_oxi": metal_oxi,
                "oxi_guess": full_guess,
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
                if same_valence(s["metal_oxi"], cl["metal_oxi"]):
                    v = round((s["metal_oxi"] + cl["metal_oxi"]) / 2, 2)
                    if not any(abs(v - x) <= 0.05 for x in matched_vals):
                        matched_vals.append(v)

        for valence in sorted(matched_vals):
            s_candidates = [x for x in sulfides if x["metal_oxi"] is not None and abs(x["metal_oxi"] - valence) <= 0.06]
            cl_candidates = [x for x in chlorides if x["metal_oxi"] is not None and abs(x["metal_oxi"] - valence) <= 0.06]
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
        "selection": "Stable binary M-S and M-Cl entries with e_hull <= 1e-6 eV/atom. Oxidation states are pymatgen composition-based guesses. A 2D point is drawn only when sulfide and chloride metal oxidation states match within ±0.06.",
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
