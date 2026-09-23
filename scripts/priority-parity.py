"""Referencia independiente para verificar la fórmula de prioridad de TypeScript."""
import json
import sys

def priority(vulnerability, pressure, access, spatial):
    pressure_score = min(max(pressure - 0.6, 0), 1)
    access_deficit = max(1 - access, 0)
    raw = .35 * vulnerability + .25 * pressure_score + .25 * access_deficit + .15 * spatial
    return int(min(max(raw, .05), .98) * 100 + .5) / 100

payload = json.load(sys.stdin)
json.dump([priority(*row) for row in payload], sys.stdout)
