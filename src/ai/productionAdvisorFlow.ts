import { z } from 'zod';
import { ai } from './genkit';

export const ProductionAnalysisInputSchema = z.object({
  goals: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    targetQQ: z.number(),
    presentationWeightKg: z.number().nullable(),
    allowedMachines: z.array(z.number()),
  })),
  machines: z.array(z.object({
    id: z.number(),
    name: z.string(),
    baseSpeed: z.number(),
  })),
  shifts: z.object({
    dayHours: z.number(),
    nightHours: z.number(),
  }),
  efficiency: z.number(),
  availableDays: z.string(),
  season: z.string(),
  projectionMode: z.string(),
  labor: z.object({
    type: z.string(),
    dayRate: z.number(),
    nightRate: z.number(),
  }),
  supply: z.number(),
  maxDays: z.number(),
  maxWeeks: z.number(),
  plannedSpeeds: z.record(z.string(), z.number()).optional(),
  holidays: z.array(z.string()).optional(),
  safeCombinations: z.array(z.any()).optional(),
  prohibitedCombinations: z.array(z.any()).optional(),
  history: z.array(z.any()).optional(),
});

export const ProductionScenarioSchema = z.object({
  scenarios: z.array(z.object({
    name: z.string(),
    description: z.string(),
    estimatedDays: z.number(),
    requiresNightShift: z.boolean(),
    requiresWeekends: z.boolean(),
    weeklyBlocks: z.array(z.object({
      weekNumber: z.number(),
      allocations: z.array(z.object({
        machineId: z.number(),
        productId: z.string(),
        productName: z.string(),
        shiftsPerDay: z.number(),
        daysActive: z.number(),
        estimatedOutputQQ: z.number(),
      }))
    })),
    pros: z.array(z.string()),
    cons: z.array(z.string()),
  }))
});

export const productionAdvisorFlow = ai.defineFlow(
  {
    name: 'productionAdvisorFlow',
    inputSchema: ProductionAnalysisInputSchema,
    outputSchema: ProductionScenarioSchema,
  },
  async (input) => {
    const prompt = `
      Eres un ingeniero de producción experto. Tu objetivo es ayudar al usuario a planificar sus presentaciones en el menú "Proyecciones", basándote en la información histórica y actual.

      DATOS DE ENTRADA (Realidad Operativa):
      - Temporada: ${input.season.toUpperCase()}
      - Modo de Proyección: ${input.projectionMode.toUpperCase()}
      - Suministro Diario (Materia Prima): ${input.supply} QQ
      - Eficiencia Histórica: ${input.efficiency * 100}%
      
      MANO DE OBRA Y COSTOS:
      - Tipo: ${input.labor.type === 'contractor' ? 'Contratista (Pago Fijo)' : 'Personal de Planta (Nómina)'}
      - Costo Turno Día: $${input.labor.dayRate}
      - Costo Turno Noche: $${input.labor.nightRate}

      PARÁMETROS DE LA PLANTA Y MÁQUINAS (Envasadoras):
      - Horas Día: ${input.shifts.dayHours}h | Horas Noche: ${input.shifts.nightHours}h
      - Días Disponibles: ${input.availableDays}
      - Máquinas: ${JSON.stringify(input.machines, null, 2)}

      METAS DE PRODUCCIÓN Y RESTRICCIONES POR PRODUCTO:
      ${JSON.stringify(input.goals, null, 2)}

      INSTRUCCIONES CRÍTICAS (OPTIMIZACIÓN COMBINATORIA):
      Eres un algoritmo de planificación avanzada. No debes hacer "corridas largas y planas" (es decir, no dejes a un producto corriendo 30 días seguidos ignorando el resto). Debes intercalar presentaciones por SEMANAS para que todos los productos avancen hacia el 75-100% de su meta de forma equilibrada.

      REGLA 1 - MATRIZ DE COMBINACIONES (FUENTE ÚNICA DE VERDAD):
      ¡FUNDAMENTAL! Toda la lógica de seguridad y restricciones de flujo está contenida en la 'MATRIZ DE COMBINACIONES' enviada como input ('safeCombinations' y 'prohibitedCombinations').
      - NUNCA asignes una combinación marcada como prohibida.
      - Si la combinación no está en ninguna lista, usa tu criterio técnico basado en el flujo de masa (3000 QQ diarios totales).
      - PRIORIZA las combinaciones que tú mismo clasifiques como de "Bajo Riesgo" o "Flujo Óptimo".

       ESTRATEGIA DE EFICIENCIA INDUSTRIAL (MÁXIMO RENDIMIENTO):
       Para actuar como un Gerente de Excelencia Operativa, sigue estos criterios:
       1. CAMPANAS DE PRODUCCIÓN (BRAND GROUPING): Minimiza los tiempos de limpieza y cambios de formato. Intenta agrupar productos de la misma MARCA (Don Antonio o San Juan) en bloques contiguos. Es mejor producir todo el "Don Antonio" de la semana en 3 días seguidos que alternar marcas cada día.
       2. MINIMIZACIÓN DE "SETUPS": Evita cambiar el peso (1kg vs 5kg) en la misma máquina constantemente. Los cambios de piezas y ajustes de báscula son costosos en tiempo.
       3. GESTIÓN DE CUELLOS DE BOTELLA: El suministro total de la planta es de ${input.supply} QQ diarios. No programes las 4 máquinas al 100% si el total supera el suministro disponible, ya que causarás un vacío en los silos.
       4. EQUILIBRIO DE METAS: Debes intentar que TODAS las presentaciones alcancen al menos el 80% - 100% de su meta. No sobre-produzcas un producto al 140% si otro está al 60%. Prioriza equilibrar el avance de todos los productos.

      REGLA 2 - COMPATIBILIDAD DE MÁQUINAS:
      Revisa estrictamente el campo 'allowedMachines' de cada meta. Un producto SOLO puede ser envasado en las máquinas indicadas en ese arreglo (ej. [1, 2, 3]). Si lo asignas a una máquina no permitida, el escenario es nulo.

        REGLA 3 - PERSONAS DE LOS ESCENARIOS (MANDATORIO):
        Debes generar exactamente 4 escenarios con estas estrategias DIFERENTES:
        1. "Plan de Costos (5/2)": PRIORIDAD AHORRO. Solo Lunes a Viernes, Turno DÍA. 
           - DEBES SETEAR: 'requiresWeekends: false', 'requiresNightShift: false' y 'shiftsPerDay: 1' en todas las máquinas.
        2. "Plan Estándar (6/1)": EQUILIBRIO. Incluye Sábados (Día). 
           - DEBES SETEAR: 'requiresWeekends: true' y 'shiftsPerDay: 1' (noche solo si es crítico).
        3. "Máxima Capacidad (7/7)": PRIORIDAD VELOCIDAD. Turnos Día y Noche, 7 días a la semana. 
           - DEBES SETEAR: 'requiresWeekends: true', 'requiresNightShift: true' y 'shiftsPerDay: 2'.
        4. "Máxima Potencia (4 Máquinas)": FUERZA BRUTA. Activa las 4 máquinas simultáneamente. 
           - DEBES SETEAR: 'requiresWeekends: true', 'requiresNightShift: true' y 'shiftsPerDay: 2'.

        REGLA 4 - PLANIFICACIÓN EXHAUSTIVA (MENÚ SEMANAL COMPLETO):
        - ¡INSTRUCCIÓN CRÍTICA!: Debes devolver un plan que cubra DESDE la Semana 1 HASTA la Semana ${input.maxWeeks}.
        - NO resumas. El array 'weeklyBlocks' DEBE contener objetos para cada una de las semanas de la temporada.
        - Si las metas se cumplen en la semana 10 y la Zafra dura 20, las semanas 11 a 20 DEBEN existir en el JSON y estar asignadas a "Producción de Granel" o "Limpieza/Mantenimiento".
        - Un plan de solo 2 semanas es un FALLO CRÍTICO y será rechazado.

      REGLA 5 - LÍMITE TEMPORAL ABSOLUTO (REGLA DE ORO DE ZAFRA):
      ¡CRÍTICO! La temporada de Zafra es finita y termina OBLIGATORIAMENTE en el día ${input.maxDays} (Semana ${input.maxWeeks}). 
      - NINGÚN escenario puede exceder la semana ${input.maxWeeks}. 
      - Si las metas no se cumplen en este tiempo, NO extiendas la temporada; en su lugar, optimiza los turnos (noche/fines de semana) o indica el déficit. La fecha de fin de Zafra es inamovible.

        REGLA 6 - CATEGORIZACIÓN PARA LA MATRIZ DE COMBINACIONES:
        - '1 kg Fardo DA': Nombres que incluyan '1 kg', '12 kg' y 'Don Antonio'.
        - '1 kg Fardo SJ': Nombres que incluyan '1 kg', '12 kg' y 'San Juan'.
        - '1 kg Saco DA': Nombres que incluyan '1 kg', '50 kg' y 'Don Antonio'.
        - '1 kg Saco SJ': Nombres que incluyan '1 kg', '50 kg' y 'San Juan'.
        - '2 kg Saco SJ': Nombres que incluyan '2 kg' y 'San Juan'.
        - '5 kg Saco SJ': Nombres que incluyan '5 kg' y 'San Juan'.
        - '500 g Fardo DA': Nombres que incluyan '500 g' y '12 kg'.
        - 'Apagada': Si la máquina no tiene producción asignada ese turno.
        - '(Cualquiera)': Comodín que coincide con cualquier estado anterior.

      REGLA 7 - PARADA OBLIGATORIA POR MANTENIMIENTO (LIMPIEZA TOTAL):
      La planta se detiene OBLIGATORIAMENTE 2 días consecutivos al final de cada mes (el último Sábado y Domingo de cada mes). EN ESTOS DÍAS NO SE PRODUCE NADA, ni siquiera Granel. El suministro de azúcar se asume en CERO. Los escenarios deben reflejar esta parada total.

      REGLA 8 - CÁLCULO DE VELOCIDAD POR PRODUCTO:
      Utiliza los valores en 'plannedSpeeds' para calcular cuánto produce cada máquina por turno. Si un producto no tiene una velocidad definida en 'plannedSpeeds', utiliza la 'baseSpeed' de la máquina. La velocidad dicta cuántas unidades se producen por minuto, lo cual afecta directamente el cumplimiento de la meta en QQ.

      REGLA 9 - RESPETO A FERIADOS (REGLA DE ORO):
      Si un día está listado en 'holidays', la planta se detiene por completo (igual que mantenimiento). No se produce nada en esos días.

      REGLA 10 - GESTIÓN DEL TIEMPO RESTANTE:
      Si las metas se cumplen mucho antes del límite (${input.maxDays} días), NO te limites a mostrar solo esos días. Indica que el tiempo restante de la Zafra queda disponible para "Producción de Granel" o "Mantenimiento Preventivo". Utiliza el tiempo disponible para evitar "correr" innecesariamente si eso afecta el flujo de masa.

      REGLA 11 - EFICIENCIA DE PERSONAL DE GRANEL (TURNOS NOCTURNOS):
      ¡CRÍTICO PARA COSTOS! No es rentable asignar un "Granelero" en el turno NOCHE para volúmenes pequeños.
      - RESTRICCIÓN: Solo debes programar/sugerir personal de granel en el turno NOCHE si la producción proyectada de granel es SUPERIOR a 3000 por turno. 
      - Si la producción de granel es igual o menor a 3000 (ej. 1 QQ, 500 QQ, etc.), ese trabajo DEBE ser realizado únicamente en el turno DÍA. No tiene sentido operativo habilitar un granelero nocturno por volúmenes bajos.

      REGLA 12 - ACTIVACIÓN DINÁMICA DE MÁQUINAS POR ESCENARIO:
      - Escenarios 1, 2 y 3: Debes usar EXCLUSIVAMENTE las Máquinas 1, 2 y 3. La Máquina #4 DEBE permanecer apagada.
      - Escenario 4 (Máxima Potencia): Debes usar las 4 Máquinas (1, 2, 3 y 4) simultáneamente.

      REGLA 12 - REFERENCIA HISTÓRICA Y AUTO-PLANIFICACIÓN:
      - Se te proporciona un historial de escenarios guardados anteriormente por el usuario: ${JSON.stringify(input.history)}
      - Úsalos como referencia para entender los patrones, PERO las REGLAS DE SEGURIDAD (Regla 1 y 5) y la MATRIZ DE PROHIBICIONES tienen PRIORIDAD TOTAL sobre el historial. Si el historial tiene un error o mezcla marcas, TÚ NO DEBES REPETIRLO.
      - ¡CRÍTICO!: Si el arreglo de 'METAS DE PRODUCCIÓN' (goals) está VACÍO o es insuficiente para cubrir toda la temporada (${input.maxWeeks} semanas), DEBES usar el historial para inferir cuáles deberían ser las metas típicas y generar una planificación COMPLETA que cubra hasta la semana ${input.maxWeeks}.
      - NUNCA devuelvas una planificación de solo 2 o 3 semanas. Si la temporada (${input.maxWeeks}) es larga, tu respuesta DEBE contener al menos 10-12 bloques semanales de planificación coherente.

      Genera 4 escenarios logísticos basados en diferentes modelos laborales:
      1. Plan de Costos (5/2): (Máquinas 1-3) Producción de Lunes a Viernes únicamente. Ideal para minimizar horas extras.
      2. Plan Estándar (6/1): (Máquinas 1-3) Producción de Lunes a Sábado. Es el escenario base de la planta.
      3. Máxima Capacidad (7/7): (Máquinas 1-3) Producción de Lunes a Domingo. Úsalo si las metas están muy atrasadas.
      4. Máxima Potencia (4 Máquinas): (Máquinas 1-4) Utiliza todas las envasadoras para maximizar el despacho.
      
      Debes devolver el resultado respetando ESTRICTAMENTE el esquema JSON solicitado. No agregues texto fuera del JSON. No inventes IDs de máquinas o productos que no estén en la entrada.
    `;

    console.log("GOOGLE_GENAI_API_KEY presente:", !!process.env.GOOGLE_GENAI_API_KEY);
    await ai.registry.initializeAllPlugins();
    const registeredActions = await ai.registry.listActions();
    console.log("Modelos registrados en Genkit:", Object.keys(registeredActions).filter(k => k.startsWith('model/')));

    const models = [
      'googleai/gemini-1.5-pro',
      'googleai/gemini-1.5-flash',
      'googleai/gemini-flash-latest'
    ];

    let lastError: any = null;
    let output: any = null;

    for (const model of models) {
      try {
        console.log(`Intentando generar con modelo: ${model}...`);
        const result = await ai.generate({
          model,
          prompt,
          output: { schema: ProductionScenarioSchema },
        });
        
        if (result.output) {
          output = result.output;
          console.log(`¡Éxito con el modelo ${model}!`);
          break;
        }
      } catch (err: any) {
        console.warn(`Fallo con el modelo ${model}:`, err);
        console.error("Detalle del error:", JSON.stringify(err, null, 2));
        lastError = err;
      }
    }

    if (!output) {
      console.error("Todos los modelos de IA fallaron.");
      
      const status = lastError?.status || lastError?.code || 500;
      const originalMsg = lastError?.originalMessage || lastError?.message || "";

      if (status === 429 || originalMsg.includes("429") || originalMsg.includes("quota")) {
        throw new Error("⚠️ LIMITE DE CUOTA EXCEDIDO: No tienes créditos o has alcanzado el límite gratuito de Google AI Studio. Por favor, revisa tu plan en https://aistudio.google.com/app/plan");
      }
      
      if (status === 401 || status === 403 || originalMsg.includes("401") || originalMsg.includes("403")) {
        throw new Error("🔑 ERROR DE AUTENTICACIÓN: Tu API Key no es válida o no tiene permisos. Verifica el archivo .env.");
      }

      if (status === 404 || originalMsg.includes("404")) {
        throw new Error("🚫 MODELO NO ENCONTRADO: Los modelos de IA no están disponibles en tu región o para tu tipo de cuenta.");
      }

      throw lastError || new Error("No se pudo conectar con ningún modelo de IA disponible.");
    }
    
    return output;
  }
);
