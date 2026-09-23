import { Territory, SimulationResult, InterventionParams, HealthFacility } from '../types';
import { getHotspotCategory } from './riskThresholds';

export class DigitalTwinEngine {
  /**
   * Spatiotemporal priority calculation:
   * Hotspot Index = (Vulnerability * 0.35) + (PressureNormalized * 0.25) + ((1 - Accessibility) * 0.25) + (SpatialSpillover * 0.15)
   */
  public static calculatePriorityIndex(
    vulnerability: number,
    systemPressure: number,
    accessibility: number,
    spatialSpillover: number = 0.3
  ): number {
    const pressureScore = Math.min(Math.max((systemPressure - 0.6) / 1.0, 0), 1);
    const accessDeficit = Math.max(1 - accessibility, 0);
    const raw = (vulnerability * 0.35) + (pressureScore * 0.25) + (accessDeficit * 0.25) + (spatialSpillover * 0.15);
    return Math.round(Math.min(Math.max(raw, 0.05), 0.98) * 100) / 100;
  }

  public static runSimulation(
    allTerritories: Territory[],
    allFacilities: HealthFacility[],
    params: InterventionParams,
    scenarioName: string = 'Escenario de Intervención Simulado',
    authorRole: string = 'Investigador Principal'
  ): SimulationResult {
    const target = allTerritories.find(t => t.id === params.targetDistrictId) || allTerritories[0];
    const beforeState = target.currentState;

    const simulatedTerritories = JSON.parse(JSON.stringify(allTerritories)) as Territory[];
    const simTarget = simulatedTerritories.find(t => t.id === target.id)!;

    let newAccessibility = simTarget.currentState.accessibilityIndex;
    let newCapacity = simTarget.currentState.healthcareCapacity;
    let newTravelTime = simTarget.currentState.avgTravelTimeMinutes;
    let newDemand = simTarget.currentState.historicalDemand;
    let verdictText = '';

    if (params.type === 'new_facility') {
      const addedCap = params.newFacilityCapacity || 2200;
      newCapacity += addedCap;
      newAccessibility = Math.min(newAccessibility + 0.24, 0.96);
      newTravelTime = Math.max(newTravelTime * 0.70, 8.5);
      simTarget.activeFacilitiesCount += 1;
      verdictText = `La construcción de una nueva IPRESS en ${target.name} incrementa la capacidad mensual en +${addedCap.toLocaleString()} atenciones y reduce el tiempo promedio de traslado en ${((1 - 0.70) * 100).toFixed(0)}%.`;
    } else if (params.type === 'expand_capacity') {
      const increasePct = (params.capacityIncreasePct || 35) / 100;
      const added = Math.round(newCapacity * increasePct);
      newCapacity += added;
      newAccessibility = Math.min(newAccessibility + 0.08, 0.95);
      newTravelTime = Math.max(newTravelTime * 0.88, 9.0);
      verdictText = `La ampliación de horario y consultorios en ${target.name} expande la oferta en +${added.toLocaleString()} consultas mensuales, mitigando la sobrecarga asistencial.`;
    } else if (params.type === 'improve_access') {
      const redPct = (params.travelTimeReductionPct || 25) / 100;
      newTravelTime = Math.max(newTravelTime * (1 - redPct), 7.0);
      newAccessibility = Math.min(newAccessibility + (redPct * 0.7), 0.95);
      verdictText = `La optimización de la red vial y transporte sociosanitario reduce el tiempo de viaje a ${newTravelTime.toFixed(1)} min (+${((newAccessibility - beforeState.accessibilityIndex) * 100).toFixed(0)}% accesibilidad).`;
    } else if (params.type === 'temporary_closure') {
      // Si se indica un establecimiento concreto se retira su capacidad real;
      // en caso contrario se asume una contingencia del 40% distrital.
      const closedFacility = params.targetFacilityId
        ? allFacilities.find(f => f.id === params.targetFacilityId)
        : undefined;

      const reduction = closedFacility && closedFacility.monthlyCapacity !== null
        ? Math.min(closedFacility.monthlyCapacity, newCapacity)
        : Math.round(newCapacity * 0.40);
      const share = newCapacity > 0 ? reduction / newCapacity : 0.4;

      newCapacity = Math.max(newCapacity - reduction, 1);
      newAccessibility = Math.max(newAccessibility - 0.20 * (share / 0.4), 0.15);
      newTravelTime = newTravelTime * (1 + 0.35 * (share / 0.4));

      verdictText = closedFacility
        ? `El cierre temporal de ${closedFacility.name} (Cat. ${closedFacility.category}) retira -${reduction.toLocaleString()} atenciones mensuales en ${target.name}, equivalente al ${(share * 100).toFixed(0)}% de la oferta distrital, y satura los establecimientos vecinos.`
        : `La contingencia general en ${target.name} reduce la oferta local en -${reduction.toLocaleString()} atenciones, saturando establecimientos vecinos.`;
    }

    const newPressure = Math.round((newDemand / newCapacity) * 100) / 100;
    const newPriority = this.calculatePriorityIndex(
      simTarget.sdoh.vulnerabilityIndex,
      newPressure,
      newAccessibility,
      simTarget.currentState.contagionRisk * 0.8
    );
    const newHotspot = getHotspotCategory(newPriority);

    // Calculate neighboring spillover effects
    const neighborDeltas = (target.neighborIds || []).map(nId => {
      const nTerr = allTerritories.find(t => t.id === nId);
      if (!nTerr) return null;
      let pressureDeltaPct = 0;
      if (params.type === 'new_facility' || params.type === 'expand_capacity') {
        // Relief of 4% to 9%
        pressureDeltaPct = -6.5;
      } else if (params.type === 'temporary_closure') {
        // Increase of 12% to 18%
        pressureDeltaPct = +14.2;
      } else {
        pressureDeltaPct = -2.0;
      }
      const newNP = Math.round(nTerr.currentState.systemPressure * (1 + pressureDeltaPct / 100) * 100) / 100;
      const newNPriority = this.calculatePriorityIndex(nTerr.sdoh.vulnerabilityIndex, newNP, nTerr.currentState.accessibilityIndex, nTerr.currentState.contagionRisk * 0.8);
      return {
        districtId: nTerr.id,
        districtName: nTerr.name,
        pressureDeltaPct,
        priorityAfter: newNPriority
      };
    }).filter(Boolean) as { districtId: number; districtName: string; pressureDeltaPct: number; priorityAfter: number }[];

    const priorityDelta = Math.round((newPriority - beforeState.priorityIndex) * 100) / 100;
    const priorityDeltaPct = Math.round(((newPriority - beforeState.priorityIndex) / beforeState.priorityIndex) * 1000) / 10;
    const accessibilityDelta = Math.round((newAccessibility - beforeState.accessibilityIndex) * 100) / 100;
    const accessibilityDeltaPct = Math.round(((newAccessibility - beforeState.accessibilityIndex) / beforeState.accessibilityIndex) * 1000) / 10;
    const pressureDelta = Math.round((newPressure - beforeState.systemPressure) * 100) / 100;
    const pressureDeltaPct = Math.round(((newPressure - beforeState.systemPressure) / beforeState.systemPressure) * 1000) / 10;
    const travelTimeSaved = Math.round((beforeState.avgTravelTimeMinutes - newTravelTime) * 10) / 10;

    return {
      id: `sim-${Date.now().toString(36)}`,
      scenarioName,
      createdAt: new Date().toISOString(),
      authorRole,
      params,
      targetDistrict: target,
      before: {
        priorityIndex: beforeState.priorityIndex,
        accessibilityIndex: beforeState.accessibilityIndex,
        systemPressure: beforeState.systemPressure,
        projectedDemand: beforeState.projectedDemand,
        hotspotCategory: beforeState.hotspotCategory,
        avgTravelTimeMinutes: beforeState.avgTravelTimeMinutes,
        totalCoveragePop: Math.round(target.population * beforeState.accessibilityIndex)
      },
      after: {
        priorityIndex: newPriority,
        accessibilityIndex: newAccessibility,
        systemPressure: newPressure,
        projectedDemand: newDemand,
        hotspotCategory: newHotspot,
        avgTravelTimeMinutes: Math.round(newTravelTime * 10) / 10,
        totalCoveragePop: Math.round(target.population * newAccessibility)
      },
      deltas: {
        priorityDelta,
        priorityDeltaPct,
        accessibilityDelta,
        accessibilityDeltaPct,
        pressureDelta,
        pressureDeltaPct,
        travelTimeSavedMinutes: travelTimeSaved
      },
      affectedNeighbors: neighborDeltas,
      verdict: verdictText,
      aiExplanation: `Escenario hipotético con efectos fijos en acceso, capacidad y presión de vecinos. Los cambios estimados para ${target.name} y ${neighborDeltas.length} distritos colindantes no son impactos observados.`
    };
  }
}
