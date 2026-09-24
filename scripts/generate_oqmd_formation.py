#!/usr/bin/env python3
import json
import math
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
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

session = requests.Session()
session.headers.update({
    "User-Agent": "Tinsense-material-energy-map/1.0 (public scientific data visualization)"
})

def query_stable_binary(metal, anion):
    params = {
        "fields": "name,entry_id,icsd_id,delta_e,stability",
        "limit": 80,
        "noduplicate": "True",
        "sort_by": "delta_e",
        "desc": "False",
        "format": "json",
        "filter": f"element_set=({metal},{anion}) AND ntypes=2 AND stability=0",
    }
    last_exc = None
    for attempt in range(2):
        try:
            r = session.get(API, params=params, timeout=20)
            r.raise_for_status()
            payload = r.json()
            rows = payload.get("data", [])
            clean = []
            for row in rows:
                try:
                    e = float(row["delta_e"])
                    st = float(row.get("stability", 0))
                except (TypeError, ValueError, KeyError):
                    continue
                if not (math.isfinite(e) and math.isfinite(st)):
                    continue
                clean.append({
                    "formula": row.get("name"),
                    "entry_id": row.get("entry_id"),
                    "icsd_id": row.get("icsd_id"),
                    "e_form": e,
                    "stability": st,
                })
            clean.sort(key=lambda x: (x["e_form"], x["stability"]))
            return clean
        except Exception as exc:
            last_exc = exc
            time.sleep(0.8 * (attempt + 1))
    raise RuntimeError(f"{metal}-{anion}: {last_exc}")

def main():
    records = []
    errors = []

    def fetch_pair(metal):
        sulfides = query_stable_binary(metal, "S")
        chlorides = query_stable_binary(metal, "Cl")
        if not sulfides or not chlorides:
            return None
        s = sulfides[0]
        cl = chlorides[0]
        return {
            "m": metal,
            "sulfide_formula": s["formula"],
            "sulfide_e": round(s["e_form"], 6),
            "sulfide_entry_id": s["entry_id"],
            "sulfide_icsd_id": s["icsd_id"],
            "sulfide_stable_count": len(sulfides),
            "chloride_formula": cl["formula"],
            "chloride_e": round(cl["e_form"], 6),
            "chloride_entry_id": cl["entry_id"],
            "chloride_icsd_id": cl["icsd_id"],
            "chloride_stable_count": len(chlorides),
            "delta_s_minus_cl": round(s["e_form"] - cl["e_form"], 6),
        }

    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {pool.submit(fetch_pair, metal): metal for metal in METALS}
        for fut in as_completed(futures):
            metal = futures[fut]
            try:
                row = fut.result()
                if row:
                    records.append(row)
            except Exception as exc:
                errors.append(f"{metal}: {exc}")

    order = {m: i for i, m in enumerate(METALS)}
    records.sort(key=lambda x: order[x["m"]])

    if len(records) < 10:
        raise RuntimeError(f"Only {len(records)} paired records obtained; refusing to overwrite dataset. Errors: {errors[:8]}")

    meta = {
        "source": "OQMD",
        "source_url": "https://oqmd.org/",
        "api_url": API,
        "license": "CC BY 4.0",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "selection": "For each M, stable binary M-S and M-Cl entries (stability=0, ntypes=2); representative is the stable phase with the most negative formation energy per atom.",
        "energy_unit": "eV/atom",
        "paired_metals": len(records),
        "errors": errors,
    }

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// Auto-generated from the public OQMD REST API. Do not hand-edit.\\n")
        f.write("window.FORMATION_META = ")
        json.dump(meta, f, ensure_ascii=False, indent=2)
        f.write(";\\nwindow.FORMATION_DATA = ")
        json.dump(records, f, ensure_ascii=False, indent=2)
        f.write(";\\n")

    print(f"Wrote {len(records)} paired metals to {OUT}")
    if errors:
        print(f"Non-fatal query errors: {len(errors)}")
        for err in errors[:10]:
            print(" -", err)

if __name__ == "__main__":
    main()
