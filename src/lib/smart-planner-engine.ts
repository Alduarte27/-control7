import { addDays, format, isSaturday, isSunday } from 'date-fns';

export interface WeeklyAllocation {
  machineId: number;
  productId: string;
  productName: string;
  shiftsPerDay: number;
  daysActive: number;
}

export interface WeeklyBlock {
  weekNumber: number;
  allocations: WeeklyAllocation[];
}

export interface SmartPlannerContext {
  zafraStartDate: string;
  maxWeeks: number;
  products: any[];
  machines: any[];
  plannedSpeeds: Record<string, number>;
  holidays: string[];
  safeCombinations: any[];
  prohibitedCombinations: any[];
  classifyProduct: (name: string) => string;
  generateAutoLabel: (m1: string, m2: string, m3: string, m4: string, isProhibited: boolean) => string;
}

export function runSmartPlannerEngine(weeklyBlocks: WeeklyBlock[], context: SmartPlannerContext) {
  const overrides: Record<string, any> = {};
  const start = new Date(context.zafraStartDate);
  const holidaySet = new Set(context.holidays);

  // Helper to check if it's a maintenance day (last Sat/Sun of month)
  const isMaintenanceDay = (d: Date) => {
    const day = d.getDay(); // 0=Sun, 6=Sat
    if (day !== 0 && day !== 6) return false;
    const nextWeek = addDays(d, 7);
    return nextWeek.getMonth() !== d.getMonth();
  };

  // Pre-index prohibited combinations for fast lookup
  const isCombinationProhibited = (valM1: string, valM2: string, valM3: string, valM4: string) => {
    const norm = (s: string) => context.classifyProduct(s);
    const n1 = norm(valM1);
    const n2 = norm(valM2);
    const n3 = norm(valM3);
    const n4 = norm(valM4);

    return context.prohibitedCombinations.some(rule => {
      const matchRule = (ruleVal: string, normVal: string) => {
        if (ruleVal === '(Cualquiera)') return true;
        return norm(ruleVal) === normVal;
      };
      return matchRule(rule.m1, n1) &&
             matchRule(rule.m2, n2) &&
             matchRule(rule.m3, n3) &&
             matchRule(rule.m4, n4);
    });
  };

  // Clear everything first
  const zafraLengthDays = context.maxWeeks * 7;
  for (let d = 0; d < zafraLengthDays; d++) {
    const curr = addDays(start, d);
    const dateStr = format(curr, 'yyyy-MM-dd');
    [1, 2, 3, 4].forEach(id => {
      overrides[`${id}-${dateStr}-dia`] = { inactive: true };
      overrides[`${id}-${dateStr}-noche`] = { inactive: true };
    });
  }

  // Helper to calculate the calendar week number for a given date
  const getCalendarWeekNumber = (date: Date) => {
    const year = date.getFullYear();
    let d = new Date(year, 0, 1);
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1); // Get first Monday of the year
    if (date < d) return 1;
    const diffMs = date.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  };

  const zafraStartWeek = getCalendarWeekNumber(start);

  // Iterate over each week block
  for (const block of weeklyBlocks) {
    if (!block) continue;
    
    // Convert absolute calendar week (e.g. Week 31) to relative harvest zafra week if needed
    let relativeWeek = block.weekNumber || 1;
    if (relativeWeek >= zafraStartWeek) {
      relativeWeek = relativeWeek - zafraStartWeek + 1;
    }
    
    const weekOffsetDays = (relativeWeek - 1) * 7;

    // Track active days per machine allocation
    const allocations = block.allocations || [];
    const machineTracks = allocations.map(alloc => ({
      ...alloc,
      remainingDays: alloc.daysActive || 0
    }));

    // Process day by day within the week
    for (let d = 0; d < 7; d++) {
      const currentDay = addDays(start, weekOffsetDays + d);
      const dateStr = format(currentDay, 'yyyy-MM-dd');
      const dayOfWeek = currentDay.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Skip holidays and maintenance
      if (holidaySet.has(dateStr) || isMaintenanceDay(currentDay)) {
        [1, 2, 3, 4].forEach(id => {
          overrides[`${id}-${dateStr}-dia`] = { inactive: true };
          overrides[`${id}-${dateStr}-noche`] = { inactive: true };
        });
        continue;
      }

      // Build daily configuration candidate
      const dayConfig: Record<number, { productId: string; productName?: string; shiftsPerDay: number }> = {};
      
      machineTracks.forEach(track => {
        if (track.remainingDays > 0) {
          // If it's weekend, check if this allocation allows weekends or if the global rules permit it
          // In standard strategy, we might skip weekends
          if (isWeekend && track.shiftsPerDay === 1 && d >= 5) { // Skip Sat/Sun for 5/2 plans
            return;
          }
          
          dayConfig[track.machineId] = {
            productId: track.productId,
            productName: track.productName,
            shiftsPerDay: track.shiftsPerDay
          };
        }
      });

      // Constraint Solver: Check for Prohibited Combinations
      const m1Val = dayConfig[1]?.productId ? (context.products.find(p => p.id === dayConfig[1].productId)?.productName || 'Apagada') : 'Apagada';
      const m2Val = dayConfig[2]?.productId ? (context.products.find(p => p.id === dayConfig[2].productId)?.productName || 'Apagada') : 'Apagada';
      const m3Val = dayConfig[3]?.productId ? (context.products.find(p => p.id === dayConfig[3].productId)?.productName || 'Apagada') : 'Apagada';
      const m4Val = dayConfig[4]?.productId ? (context.products.find(p => p.id === dayConfig[4].productId)?.productName || 'Apagada') : 'Apagada';

      if (isCombinationProhibited(m1Val, m2Val, m3Val, m4Val)) {
        console.warn(`[SmartEngine] VETO DETECTADO el día ${dateStr} para combinación:`, { m1Val, m2Val, m3Val, m4Val });
        // HEURISTIC: Turn off the machine with the lowest priority (usually Machine 4, then 3, then 2)
        const machinesToTry = [4, 3, 2, 1];
        for (const mId of machinesToTry) {
          if (dayConfig[mId]) {
            console.log(`[SmartEngine] Resolviendo VETO: Apagando Máquina #${mId}`);
            delete dayConfig[mId];
            
            // Re-verify
            const testM1 = dayConfig[1]?.productId ? (context.products.find(p => p.id === dayConfig[1].productId)?.productName || 'Apagada') : 'Apagada';
            const testM2 = dayConfig[2]?.productId ? (context.products.find(p => p.id === dayConfig[2].productId)?.productName || 'Apagada') : 'Apagada';
            const testM3 = dayConfig[3]?.productId ? (context.products.find(p => p.id === dayConfig[3].productId)?.productName || 'Apagada') : 'Apagada';
            const testM4 = dayConfig[4]?.productId ? (context.products.find(p => p.id === dayConfig[4].productId)?.productName || 'Apagada') : 'Apagada';
            
            if (!isCombinationProhibited(testM1, testM2, testM3, testM4)) {
              break;
            }
          }
        }
      }

      // Apply resolved allocations to overrides
      [1, 2, 3, 4].forEach(mId => {
        const config = dayConfig[mId];
        if (config && config.productId !== 'off') {
          const product = context.products.find(p => {
            const pid = (config.productId || '').toLowerCase().trim();
            const pname = (config.productName || '').toLowerCase().trim();
            const currId = p.id.toLowerCase().trim();
            const currName = p.productName.toLowerCase().trim();
            
            return currId === pid || 
                   currName === pid ||
                   currName.includes(pid) ||
                   pid.includes(currName) ||
                   (pname && (currName.includes(pname) || pname.includes(currName)));
          });
          if (product) {
            const effectiveSpeed = context.plannedSpeeds[product.id] || context.machines.find(m => m.id === mId)?.speed || 0;
            
            overrides[`${mId}-${dateStr}-dia`] = {
              productId: product.id,
              speed: effectiveSpeed,
              inactive: false
            };

            if (config.shiftsPerDay > 1) {
              overrides[`${mId}-${dateStr}-noche`] = {
                productId: product.id,
                speed: effectiveSpeed,
                inactive: false
              };
            } else {
              overrides[`${mId}-${dateStr}-noche`] = { inactive: true };
            }
          }
        } else {
          overrides[`${mId}-${dateStr}-dia`] = { inactive: true };
          overrides[`${mId}-${dateStr}-noche`] = { inactive: true };
        }
      });

      // Decrement remaining days for successfully scheduled allocations
      machineTracks.forEach(track => {
        if (dayConfig[track.machineId]) {
          track.remainingDays--;
        }
      });
    }
  }

  return overrides;
}
