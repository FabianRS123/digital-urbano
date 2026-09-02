import numpy as np
from typing import Dict, Any, List

class DigitalTwinEngine:
    """
    Motor lógico del Gemelo Digital Urbano de Salud (Trujillo).
    Calcula dinámicamente índices de prioridad, difusión espacial de demanda y simulación What-If.
    """
    @staticmethod
    def calculate_priority_index(
        vulnerability: float,
        demand: float,
        capacity: float,
        accessibility: float,
        spatial_spillover: float = 0.3
    ) -> float:
        pressure = demand / max(capacity, 1.0)
        pressure_score = min(max((pressure - 0.6) / 1.0, 0.0), 1.0)
        access_deficit = max(1.0 - accessibility, 0.0)
        
        index = (vulnerability * 0.35) + (pressure_score * 0.25) + (access_deficit * 0.25) + (spatial_spillover * 0.15)
        return round(float(np.clip(index, 0.05, 0.98)), 2)

    def simulate_intervention(self, current_district: Dict[str, Any], intervention: Dict[str, Any]) -> Dict[str, Any]:
        """
        Intervenciones soportadas:
        - 'new_facility': Nueva IPRESS
        - 'expand_capacity': Ampliación de capacidad / horario
        - 'improve_access': Mejora de red vial y transporte sociosanitario
        - 'temporary_closure': Cierre o contingencia operativa
        """
        simulated = current_district.copy()
        itype = intervention.get("type", "new_facility")
        
        if itype == "new_facility":
            added_cap = intervention.get("capacity", 2200)
            simulated["healthcareCapacity"] = simulated.get("healthcareCapacity", 8000) + added_cap
            simulated["accessibilityIndex"] = min(simulated.get("accessibilityIndex", 0.5) + 0.24, 0.96)
            simulated["avgTravelTimeMinutes"] = max(simulated.get("avgTravelTimeMinutes", 30) * 0.70, 8.5)
            
        elif itype == "expand_capacity":
            pct = intervention.get("capacityIncreasePct", 35) / 100.0
            added = simulated.get("healthcareCapacity", 8000) * pct
            simulated["healthcareCapacity"] += int(added)
            simulated["accessibilityIndex"] = min(simulated.get("accessibilityIndex", 0.5) + 0.08, 0.95)
            simulated["avgTravelTimeMinutes"] = max(simulated.get("avgTravelTimeMinutes", 30) * 0.88, 9.0)
            
        elif itype == "improve_access":
            red_pct = intervention.get("travelTimeReductionPct", 25) / 100.0
            simulated["avgTravelTimeMinutes"] = max(simulated.get("avgTravelTimeMinutes", 30) * (1.0 - red_pct), 7.0)
            simulated["accessibilityIndex"] = min(simulated.get("accessibilityIndex", 0.5) + (red_pct * 0.7), 0.95)
            
        elif itype == "temporary_closure":
            simulated["healthcareCapacity"] = max(int(simulated.get("healthcareCapacity", 8000) * 0.60), 800)
            simulated["accessibilityIndex"] = max(simulated.get("accessibilityIndex", 0.5) - 0.20, 0.15)
            simulated["avgTravelTimeMinutes"] = simulated.get("avgTravelTimeMinutes", 30) * 1.35
            
        simulated["systemPressure"] = round(simulated.get("projectedDemand", 5000) / max(simulated["healthcareCapacity"], 1), 2)
        simulated["priorityIndex"] = self.calculate_priority_index(
            vulnerability=simulated.get("vulnerabilityIndex", 0.6),
            demand=simulated.get("projectedDemand", 5000),
            capacity=simulated["healthcareCapacity"],
            accessibility=simulated["accessibilityIndex"]
        )
        return simulated
