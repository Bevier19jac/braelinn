#!/usr/bin/env python3
"""Generate FIREBASE-RULES-PASTE-THIS.json from firebase-rules.json.

Firebase rejects the _comment keys used to document the rules, so the
publishable copy is the documented tree with comments stripped. It is
GENERATED -- never edit FIREBASE-RULES-PASTE-THIS.json by hand, or the two
drift and you publish something you did not review.

    python3 make-rules.py
"""
import json, collections, pathlib

here = pathlib.Path(__file__).parent
full = json.loads((here / "firebase-rules.json").read_text(), object_pairs_hook=collections.OrderedDict)

def strip(o):
    if isinstance(o, dict):
        return collections.OrderedDict((k, strip(v)) for k, v in o.items() if not k.startswith("_"))
    if isinstance(o, list):
        return [strip(x) for x in o]
    return o

out = json.dumps(strip(full), separators=(",", ":"))
json.loads(out)                      # never write something that will not parse
(here / "FIREBASE-RULES-PASTE-THIS.json").write_text(out + "\n")
print("wrote FIREBASE-RULES-PASTE-THIS.json (%d bytes)" % len(out))
