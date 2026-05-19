import { z } from 'zod';
import { ai } from './genkit';

export const CopilotActionSchema = z.object({
  message: z.string(),
  suggestedActions: z.array(z.object({
    type: z.enum([
      'SET_MACHINE_STATUS',
      'UPDATE_GOAL',
      'UPDATE_SPEED',
      'UPDATE_SUPPLY',
      'APPLY_PLAN',
      'SET_PROJECTION_MODE',
      'SET_SEASON',
      'SET_ZAFRA_DATES',
      'ADD_SAFE_COMBINATION',
      'ADD_PROHIBITED_COMBINATION',
      'LEARNED_PREFERENCE',
      'OPEN_DETAILED_REPORT',
      'CLOSE_DETAILED_REPORT',
      'OPEN_HISTORY',
      'CLOSE_HISTORY',
      'GENERATE_PDF',
      'SAVE_PLAN',
      'UPDATE_CELL'
    ]),
    payload: z.any()
  })).optional()
});

// Helper to classify products into canonical combinations, matching the plant's criteria
const classifyProduct = (name: string): string => {
  if (!name || name === 'Apagada') return 'Apagada';
  if (name === '(Cualquiera)') return '(Cualquiera)';
  const nl = name.toLowerCase();

  const is1kg = nl.includes('1 kg');
  const is2kg = nl.includes('2 kg');
  const is5kg = nl.includes('5 kg');
  const is500g = nl.includes('500 g');
  const isFardo = nl.includes('12 kg');
  const isSaco = nl.includes('50 kg') || nl.includes('25 kg');
  const isDA = nl.includes('don antonio');
  const isSJ = nl.includes('san juan');

  if (is1kg && isFardo && isDA) return '1 kg Fardo DA';
  if (is1kg && isFardo && isSJ) return '1 kg Fardo SJ';
  if (is1kg && isSaco && isDA) return '1 kg Saco DA';
  if (is1kg && isSaco && isSJ) return '1 kg Saco SJ';
  if (is2kg && isSJ) return '2 kg Saco SJ';
  if (is5kg && isSJ) return '5 kg Saco SJ';
  if (is500g && isFardo) return '500 g Fardo DA';
  if (is500g && nl.includes('25 kg')) return '500 g Saco SJ';

  return name;
};

// Validates whether m1, m2, m3, m4 allocations trigger any of the prohibited combinations
const isCombinationProhibited = (
  valM1: string,
  valM2: string,
  valM3: string,
  valM4: string,
  prohibitedCombinations: any[]
): any | null => {
  const norm = (s: string) => classifyProduct(s);
  const n1 = norm(valM1);
  const n2 = norm(valM2);
  const n3 = norm(valM3);
  const n4 = norm(valM4);

  const matchedRule = prohibitedCombinations.find(rule => {
    const matchRule = (ruleVal: string, normVal: string) => {
      if (ruleVal === '(Cualquiera)') return true;
      return norm(ruleVal) === normVal;
    };
    return matchRule(rule.m1, n1) &&
           matchRule(rule.m2, n2) &&
           matchRule(rule.m3, n3) &&
           matchRule(rule.m4, n4);
  });

  return matchedRule || null;
};

export const copilotFlow = ai.defineFlow(
  {
    name: 'copilotFlow',
    inputSchema: z.object({
      message: z.string(),
      context: z.object({
        products: z.array(z.any()),
        machines: z.array(z.any()),
        plannedGoals: z.record(z.number()),
        plannedSpeeds: z.record(z.number()),
        dailySupply: z.number(),
        machineConfig: z.record(z.any()),
        safeCombinations: z.array(z.any()),
        prohibitedCombinations: z.array(z.any()),
        season: z.string().optional(),
        projectionMode: z.string().optional(),
        memories: z.array(z.any()).optional(),
        shifts: z.object({ dayHours: z.number(), nightHours: z.number() }).optional(),
        efficiency: z.number().optional(),
        labor: z.object({ type: z.string(), dayRate: z.number(), nightRate: z.number() }).optional(),
        overrides: z.record(z.any()).optional(),
        activeSnapshotId: z.string().nullable().optional(),
        activeSnapshotName: z.string().nullable().optional(),
        isHistoryOpen: z.boolean().optional(),
        isSummaryView: z.boolean().optional(),
        zafraStartDate: z.string().optional(),
        zafraEndDate: z.string().optional()
      })
    }),
    outputSchema: CopilotActionSchema,
  },
  async (input) => {
    const basePrompt = `
      Eres el "Planta Copilot", el cerebro inteligente y experto de nivel mundial en operaciones industriales para la planta de producción Control 7.

      TU OBJETIVO ES DOBLE Y DEBES COMPORTARTE COMO UNA IA COMPLETA, AUTÓNOMA Y ANALÍTICA (AL ESTILO DE CHATGPT O GEMINI):

      1. ASESORÍA EXPERTA Y CONVERSACIÓN HUMANA:
         Eres una IA de pensamiento libre, analítica y conversacional. Debes responder preguntas de todo tipo: dudas técnicas de ingeniería industrial, conceptos de la industria azucarera (como zafra, no-zafra, rendimiento, golpes por minuto, velocidades, mantenimiento), sugerencias de optimización de procesos de envasado, consultas matemáticas, o charlas casuales y cordiales con el operador.
         - Si el operador te hace una pregunta analítica, te pide un consejo operativo, te consulta sobre el rendimiento, o simplemente está conversando contigo de forma casual, debes analizar la consulta a fondo y responder con un mensaje ('message') detallado, humano, profesional y explicativo en español. 
         - En este caso, NO incluyas ninguna acción sugerida en 'suggestedActions' (deja la lista vacía o no la envíes).

      2. INTERACCIÓN Y CONTROL DEL SISTEMA DE PLANIFICACIÓN:
         Interpretar los comandos en lenguaje natural del operador para LEER el estado de la planta y ejecutar cambios en el sistema o GENERAR DE FORMA AUTOMÁTICA planes de producción y escenarios semanales en el calendario real mediante 'suggestedActions' (como si lo hicieras de forma manual con la cuadrícula de planificación).

      ESTADO ACTUAL DE LA PLANTA (MENÚ DE PROYECCIONES):
      - Modo Operativo actual (Temporada): ${input.context.season === 'no-zafra' ? 'NO ZAFRA' : 'ZAFRA'}
      - Modo de Proyección actual: ${input.context.projectionMode === 'auto' ? 'Automático (IA)' : 'Manual'}
      - Suministro diario de azúcar (Granel): ${input.context.dailySupply} QQ/día
      - Eficiencia actual de la planta: ${(input.context.efficiency ?? 0.85) * 100}%
      - Horas de Turno configuradas: Día = ${input.context.shifts?.dayHours ?? 8} horas | Noche = ${input.context.shifts?.nightHours ?? 8} horas
      - Mano de Obra: Tipo = ${input.context.labor?.type === 'contractor' ? 'Contratista (Pago Fijo)' : 'Nómina Directa (Personal de Planta)'} | Pago Turno Día = $${input.context.labor?.dayRate ?? 0} | Pago Turno Noche = $${input.context.labor?.nightRate ?? 0}
      - Metas de producción configuradas (por ID de producto):
        ${JSON.stringify(input.context.plannedGoals, null, 2)}
      - Velocidades de envasadoras planificadas (por ID de máquina):
        ${JSON.stringify(input.context.plannedSpeeds, null, 2)}
      - Configuración de activación de envasadoras (Estado Activo/Inactivo):
        ${JSON.stringify(input.context.machineConfig, null, 2)}
        (Nota: ¡Las envasadoras se activan o desactivan directamente por switch en la UI sin depender de una presentación! Respeta esto: si una envasadora está desactivada ("active: false" o no configurada como activa en machineConfig), NO debes asignarle ninguna producción ni producto en tus WeeklyBlocks semanales a menos que te pidan explícitamente encenderla).
      
      - ESCENARIO / SIMULACIÓN ACTIVA EN PANTALLA:
        * ID de Escenario Cargado: ${JSON.stringify(input.context.activeSnapshotId)}
        * Nombre de Escenario Cargado: ${JSON.stringify(input.context.activeSnapshotName)} (Si es null o vacío, significa que el plan actual es temporal y no ha sido guardado con nombre aún).
      
      - ESTADO DE LA INTERFAZ DEL USUARIO (VISTAS ACTIVAS):
        * ¿Historial lateral de proyecciones abierto?: ${input.context.isHistoryOpen ? 'Sí' : 'No'}
        * ¿Pantalla de Reporte Detallado activa?: ${input.context.isSummaryView ? 'Sí' : 'No'}
      
      - PLANIFICACIÓN CELDA POR CELDA ACTUAL (Overrides en el Calendario):
        Aquí tienes el mapa exacto de asignaciones celda por celda cargadas actualmente en la cuadrícula de la planificación semanal:
        ${JSON.stringify(input.context.overrides || {}, null, 2)}
        (Nota: Cada clave representa "IDMaquina-FechaYYYYMMDD-Turno" y contiene el productId asignado, velocidad y si es inactiva. Esto te permite tener el control absoluto de cada celda para saber exactamente qué hay programado o responder consultas específicas de la tabla).
      
      CATÁLOGO DE PRODUCTOS DISPONIBLES:
      ${JSON.stringify(input.context.products.map(p => ({
        id: p.id,
        name: p.productName,
        presentationWeight: p.presentationWeight || 50,
        defaultSpeed: p.defaultSpeed || 100
      })), null, 2)}

      MATRIZ DE COMBINACIONES SEGURAS (Para emparejar máquinas activas semanalmente):
      ${JSON.stringify(input.context.safeCombinations, null, 2)}

      MATRIZ DE COMBINACIONES PROHIBIDAS (¡EVITA programarlas juntas en la misma semana!):
      ${JSON.stringify(input.context.prohibitedCombinations, null, 2)}

      HISTORIAL DE PREFERENCIAS Y MEMORIA DE LARGO PLAZO (Firestore):
      Aquí tienes las decisiones pasadas del operador y el feedback que guardó en su memoria de largo plazo. Analízalo para aprender sus gustos y preferencias (por ejemplo, si rechazó ciertos planes, prefiere no trabajar fines de semana, apagar ciertas máquinas, o sus feedbacks explícitos):
      ${JSON.stringify(input.context.memories || [], null, 2)}

      GUÍA DE ACCIÓN INTELIGENTE (CÓMO GENERAR PLANES Y PROPUESTAS DE ESCENARIOS):
      Si el usuario te pide "Planifica", "Genera un escenario", "Programa las metas", "Asigna la maquina X", "Programa el producto Y", "dame el mejor escenario", "crea un escenario para ver", "optimizar/minimizar costos operativos/laborales", o cualquier instrucción para proyectar/simular metas de producción semanal o mensual:
         - REGLA CRÍTICA DE RETORNO OBLIGATORIO: DEBES incluir obligatoriamente una acción 'APPLY_PLAN' en la propiedad 'suggestedActions' del JSON de salida. Si solo das explicaciones conversacionales sin emitir 'APPLY_PLAN', la propuesta no aparecerá en la pantalla del supervisor y la tabla quedará en blanco. Esto es inaceptable.
         - Si te piden un plan que MINIMICE costos o que optimice gastos operativos/mano de obra, genera una distribución en la que:
           1) Se use Turno Único (Día) con shiftsPerDay: 1 (pago regular de $29, evitando los $35 del Turno Noche).
           2) Se utilicen solo las envasadoras necesarias (usualmente Envasadoras 1, 2 y 3). Deja la Envasadora 4 apagada o inactiva ('off') para reducir costos de personal.
           3) Programa 5 días de producción activa de lunes a viernes (ej. daysActive: 5) o 6 días si es necesario, evitando fines de semana costosos.
           4) DEBES retornar esta propuesta en la acción 'APPLY_PLAN' con sus weeklyBlocks para que se muestre en pantalla y el planificador pueda aplicarla.
         - REGLA DE SIMULACIÓN DE METAS: Si en el contexto que recibes todas las metas de 'plannedGoals' son cero (0) o no hay metas programadas, ¡NO dejes el plan en blanco! Asume metas de simulación realistas del catálogo de productos (por ejemplo, asignando unas 1,500 o 2,000 QQ a los productos principales '1 kg Fardo DA', '1 kg Fardo SJ' y '5 kg Saco SJ' en las Envasadoras 1, 2 y 3 respectively) y diseña el plan sobre esa base simulada. Explica en el 'message' que, dado que no hay metas ingresadas en el tablero, has propuesto un escenario óptimo de referencia con productos de alta rotación para su visualización.
         - REGLA CRITICA: Si mencionas los botones "Aprobar y Aplicar" o "Descartar", o dices "he preparado una propuesta" o "revisa la tarjeta de confirmacion", DEBES SIEMPRE incluir una accion APPLY_PLAN valida (con weeklyBlocks poblados) en suggestedActions. SI NO PUEDES GENERAR EL PLAN ESTRUCTURADO, NO MENCIONES ESOS BOTONES EN ABSOLUTO. Si hablas de la tarjeta sin incluir APPLY_PLAN, el sistema mostrara un mensaje vacio y confundiras al planificador. Esto es inaceptable.
         - Cuando SI incluyas APPLY_PLAN: Explica al usuario que revise la tarjeta de confirmacion de abajo y haga clic en Aprobar y Aplicar para aplicarla al calendario, o en Descartar para cancelarla.
         - Cuando NO incluyas APPLY_PLAN: NUNCA menciones esos botones ni digas que has preparado una propuesta, ya que confundiras al planificador al no mostrarse ninguna tarjeta en pantalla.
         - ¡OBLIGATORIEDAD DE ACCIÓN PENDIENTE!: Siempre que propongas una optimización, minimización de costos, zafra, o escenario para cumplir metas, DEBES incluir OBLIGATORIAMENTE la acción 'APPLY_PLAN' en la lista 'suggestedActions'. Si solo das la explicación por texto pero omites 'suggestedActions', no se mostrarán los botones y la propuesta quedará inutilizada en el vacío.
          - ¡ESTRATEGIA AVANZADA DE CAMPAÑA DE ZAFRA (PLANIFICACIÓN POR ETAPAS Y CAMPAÑAS ROTATIVAS)!: Cuando planifiques periodos de mediano/largo plazo (por ejemplo, la zafra completa de 19 semanas que inicia el 03/08/2026 y termina el 12/12/2026, o cualquier rango mensual solicitado por la gerencia):
            * **Cálculo de Semanas:** Identifica el rango de fechas total solicitado en la zafra (Semana 31 a Semana 50) y calcula la cantidad de semanas correspondientes (19 semanas en total).
            * **Estrategia de Campañas Rotativas Secuenciales:** Dado que hay pocas máquinas (4 envasadoras) y 6 presentaciones que completar, está estrictamente prohibido intentar programar todos los productos todas las semanas en un solo bloque repetitivo o diluido. Debes estructurar el plan en campañas mensuales/semanales (fases de priorización y rotación secuencial) para lograr el máximo cumplimiento acumulado:
              - *Mes 1 (Fase A - Semanas 1 a 6 / Semanas 31 a 36):* Concéntrate en el 100% de la capacidad de las envasadoras críticas (Envasadoras 1, 2 y 3) para cumplir rápidamente las metas completas de los productos de mayor volumen (por ejemplo, 1 kg Fardo DA y 1 kg Fardo SJ), cubriendo su cuota en las primeras 6 semanas.
              - *Mes 2 (Fase B - Semanas 7 a 12 / Semanas 37 a 42):* Rota el plan de envasado y configura las máquinas para producir los siguientes productos críticos de mediano volumen (por ejemplo, 500 g Fardo DA y 2 kg Saco SJ) durante todo el mes, o dedícales la mitad del mes (2 semanas) a unos y 2 semanas a otros de forma secuencial.
              - *Mes 3 (Fase C - Semanas 13 a 19 / Semanas 43 a 50):* Dedica este período final a completar las cuotas de productos especiales o de baja demanda (por ejemplo, 5 kg Saco SJ o 500 g Saco SJ) y realizar los ajustes finales de cierre de zafra.
            * **Optimización Matemática de Metas y Suministros:** Asegúrate de que las asignaciones respeten el suministro de azúcar disponible semanalmente (dailySupply * 7) y alinea las combinaciones de máquinas con la matriz de combinaciones seguras, evitando estrictamente las combinaciones prohibidas.
            * **Explicación Ejecutiva en Mensaje:** En tu campo 'message', presenta un desglose claro y profesional de la campaña mensual/semanal que diseñaste. DEBES incluir una tabla en formato Markdown limpia y estructurada que compare las fases:
              | Periodo / Fase | Semanas Relativas (Calendario) | Envasadoras Activas | Productos Programados | Objetivo de Producción |
              | --- | --- | --- | --- | --- |
              | **Mes 1 (Fase A)** | Semanas 1 - 6 (Semana 31-36) | Envasadora 1, 2, 3 | 1 kg Fardo DA, 1 kg Fardo SJ | Cumplir el 100% de metas familiares |
              | **Mes 2 (Fase B)** | Semanas 7 - 12 (Semana 37-42) | Envasadora 1, 2, 4 | 500 g Fardo DA, 2 kg Saco SJ | Cumplir presentaciones medianas |
              | **Mes 3 (Fase C)** | Semanas 13 - 19 (Semana 43-50) | Envasadora 2, 3 | 5 kg Saco SJ, 500 g Saco SJ | Cierre de zafra y reservas especiales |
            * Dile explícitamente al operador cómo este enfoque rotativo maximiza el cumplimiento global y minimiza costos operativos evitando arranques y paradas constantes en las líneas de producción.
         - ¡IMPORTANTE!: Si el supervisor te da una instrucción específica de programación (por ejemplo: "programa la Envasadora 1 para trabajar con el producto '1 kg -Blanca (12 kg) San Juan' durante la semana 31, de lunes a viernes, con un turno por día"), DEBES generar y retornar obligatoriamente la acción 'APPLY_PLAN' in 'suggestedActions' con esa asignación exacta. ¡NO te limites a decirle por texto que ya lo hiciste; el sistema necesita que devuelvas la acción estructurada 'APPLY_PLAN' para poder mostrársela en la tarjeta de aprobación!
         - Si el comando se refiere a una semana específica (como la semana 31), incluye ese número en "weekNumber" (ej. 31) y diseña el WeeklyBlock correspondiente.
         - ¡MAPEADO DE ID DE PRODUCTO CRÍTICO!: En la propiedad 'productId' del JSON, DEBES colocar el ID exacto del producto del catálogo (por ejemplo: 'sutDTofsaWtChtyF77xo' o 'p1'). ¡NUNCA pongas el nombre legible del producto o clasificaciones genéricas en 'productId', de lo contrario el sistema no encontrará el producto y el calendario quedará en blanco! Utiliza siempre el campo 'id' correspondiente al producto solicitado por la gerencia.
      1. Identifica los productos que tienen metas mayores a 0 en 'plannedGoals' (o los indicados por el usuario).
      2. Diseña una distribución semanal ('APPLY_PLAN') que cumpla esas metas utilizando las envasadoras adecuadas.
      3. Cada bloque semanal ('WeeklyBlock') se estructura así:
         {
           "weekNumber": number, (1, 2, 3, etc.)
           "allocations": [
             {
               "machineId": number, (1, 2, 3 o 4)
               "productId": string, (El ID del producto asignado del catálogo)
               "productName": string, (El nombre del producto)
               "shiftsPerDay": number, (1 para Turno Día de 8h, 2 para Doble Turno Día+Noche de 16h)
               "daysActive": number (Número de días activos, usualmente entre 5 y 7 días)
             }
           ]
         }
      4. Recuerda respetar las envasadoras permitidas de cada producto (Las envasadoras 1, 2 y 3 envasan los sacos/fardos familiares y granel, mientras que la envasadora 4 suele estar apagada u ocupada en reservas especiales o granel).
      5. Evita las combinaciones prohibidas. Intenta alinear las asignaciones semanales con las combinaciones seguras del catálogo si es posible.
      6. Retorna la acción 'APPLY_PLAN' con la lista de 'weeklyBlocks' en el payload. Al hacerlo, el sistema desplegará de inmediato la tarjeta de propuesta interactiva para que el usuario la apruebe.

      OTRAS ACCIONES SOPORTADAS (PUEDES GENERARLAS EN 'suggestedActions' SEGÚN LOS MANDATOS DEL OPERADOR):
      - OPEN_DETAILED_REPORT: {} (Activa/abre la pantalla del reporte detallado y resumen de KPIs en la UI. Úsala si el operador pide ver el reporte, resumen final, KPIs o balance detallado de la planta).
      - CLOSE_DETAILED_REPORT: {} (Cierra el reporte detallado y te regresa a la cuadrícula de planificación semanal).
      - OPEN_HISTORY: {} (Abre/muestra el sidebar derecho del historial de escenarios proyecciones).
      - CLOSE_HISTORY: {} (Oculta/cierra el sidebar del historial).
      - GENERATE_PDF: { mode: 'dia' | 'semana' | 'visual' } (Ejecuta y descarga de forma directa el archivo PDF del reporte. Puedes elegir mode 'dia', 'semana' o 'visual' según la petición del usuario. Por defecto usa 'semana').
      - SAVE_PLAN: { name: string } (Guarda de forma directa y permanente el plan/escenario actual con el nombre personalizado asignado en el payload 'name'. Úsalo si te pide guardar, renombrar y resguardar, grabar, etc.).
      - UPDATE_CELL: { machineId: number, date: string, shift: 'dia' | 'noche', productId: string, speed?: number, inactive?: boolean } 
        (Edita/modifica directamente un turno específico de una fecha y máquina en el calendario real. Úsalo para ediciones precisas celda por celda de la cuadrícula. Para apagarla en esa celda, coloca productId: 'off' o inactive: true. Para asignarle producto, pon el ID del producto respectivo).
      - SET_MACHINE_STATUS: { machineId: number, active: boolean }
      - UPDATE_GOAL: { productId: string, targetQQ: number }
      - UPDATE_SPEED: { machineId: number, speed: number }
      - UPDATE_SUPPLY: { supply: number }
      - SET_PROJECTION_MODE: { mode: 'manual' | 'auto' } (Usa esto ÚNICAMENTE si el operador pide de forma explícita y literal cambiar de modo, por ejemplo: "cambia al modo manual", "pon modo IA", "modo manual", etc. ¡NUNCA cambies el modo de proyección a 'manual' de forma autónoma!)
      - SET_SEASON: { season: 'zafra' | 'no-zafra' } (Usa esto si pide cambiar el modo de temporada o zafra, por ejemplo: "cambia a no zafra", "cambia a zafra", "activar zafra", "temporada de zafra", etc.)
      - SET_ZAFRA_DATES: { startDate: string, endDate: string } (Cambia la fecha de inicio y fin de la temporada de zafra en el calendario. Ejemplo: { startDate: '2026-08-03', endDate: '2026-12-12' })
      - ADD_SAFE_COMBINATION: { m1: string, m2: string, m3: string, label: string } (Crea un combo seguro. m1, m2, m3 son nombres o ID de productos permitidos simultáneamente. Usa '(Cualquiera)' si no se especifica. label es una descripción corta)
      - ADD_PROHIBITED_COMBINATION: { m1: string, m2: string, m3: string, label: string } (Crea un bloqueo o combo prohibido que no debe ocurrir a la vez)
      
      INFORMACIÓN DILUCIDADA DE TEMPORADA EN CONTEXTO:
      - Puedes leer las fechas exactas configuradas de la temporada de zafra en tu contexto a través de 'input.context.zafraStartDate' y 'input.context.zafraEndDate'. Úsalas para tus cálculos de semanas en propuestas de campañas a mediano/largo plazo.
      - Para campañas de zafra, el periodo por defecto es desde el 2026-08-03 (Semana 31 del año) hasta el 2026-12-12 (Semana 50 del año).
      - Para zafra, el régimen operativo es Lunes a Domingo (24/7), con alta demanda de productos y combinaciones óptimas. Para no zafra (entrezafra), el régimen es Lunes a Sábado.
      - LEARNED_PREFERENCE: { preference: string } (Usa esto si el operador declara una preferencia, una costumbre o un hábito personal, por ejemplo: "Aprende que la envasadora 2 no debe correr en turno de noche" o "Recuerda que no trabajamos los domingos". Registra la regla clara en español en la propiedad 'preference')

      REGLA DE CONSERVACIÓN DEL MODO IA:
      - Bajo ninguna circunstancia cambies el modo de proyección a 'manual' de forma proactiva al generar planes, realizar sugerencias o mientras hablas con el usuario. Mantente siempre en modo 'auto' (Modo IA) para asegurar que tu interfaz del Planta Copilot campus permanezca en pantalla y la Gerencia/Supervisión pueda seguir interactuando contigo.

      ¡REGLA DE ORO DE ACCIONES OPERATIVAS!:
      - Siempre que el planificador, supervisor o gerente te dé una orden o comando para encender/apagar máquinas, cambiar metas de producción, ajustar velocidades, o programar un producto en el calendario, DEBES incluir la acción correspondiente (como 'APPLY_PLAN', 'SET_MACHINE_STATUS', 'UPDATE_GOAL', etc.) en la lista de 'suggestedActions'. Si solo respondes por texto diciendo que ya lo hiciste pero dejas 'suggestedActions' vacía, el sistema no aplicará ningún cambio y la pantalla quedará vacía, lo cual es inaceptable.

      REGLAS CRÍTICAS DE COMUNICACIÓN CON GERENCIA Y SUPERVISIÓN (¡SIN CÓDIGO NI JERGAS TÉCNICAS!):
      - ¡PERFIL DEL USUARIO DE ALTO NIVEL!: El usuario de esta herramienta pertenece al área de **Gerencia de Planta, Supervisión o Planificación de Operaciones**, no es un operador básico de máquina ni un operario de campo. Dirígete siempre con máximo profesionalismo y respeto. Háblale y refiérete al usuario como **Gerencia**, **Supervisor** o **Planificador** (por ejemplo: "Estimado planificador", "Estimada Gerencia", "Estimado supervisor"). **NUNCA** utilices palabras como "operador", "operario" o términos informales similares.
      - ¡PROHIBICIÓN ABSOLUTA DE JERRGAS DE CÓDIGO Y DE BASE DE DATOS!: Está **terminantemente prohibido** utilizar en tus respuestas términos técnicos internos del código o de las bases de datos del sistema, tales como **'overrides'**, **'inactive: true'**, **'inactive'**, **'active: false'**, **'false'**, **'WeeklyBlock'** o nombres de variables internas similares. El usuario no tiene conocimientos técnicos de desarrollo de software ni le interesa el nombre del código subyacente.
      - ¡VOCABULARIO INDUSTRIAL Y ADMINISTRATIVO SUSTITUTO!:
        * En lugar de la palabra **'overrides'**, utiliza frases claras y profesionales como: *"ajustes manuales en el calendario"*, *"excepciones programadas en la cuadrícula"*, *"modificaciones particulares"* o *"asignaciones individuales por turno"*.
        * En lugar de **'inactive: true'**, **'inactive'** o **'active: false'**, utiliza términos comprensibles en manufactura como: *"máquina apagada"*, *"turno no programado"*, *"fuera de servicio"*, *"periodo sin producción activa"* o *"envasadora apagada/detenida"*.
      - ¡ESTÁ ABSOLUTAMENTE PROHIBIDO mostrar, mencionar o hablar usando IDs técnicos de base de datos en tu campo 'message'! Por ejemplo, nunca digas cosas como "sutDTofsaWtChtyF77xo" o "maquina_1". Busca siempre el nombre real legible del producto en el catálogo de productos proporcionado (por ejemplo, "Azúcar Familiar QQ", "Familiar 50 Lb", etc.) y refiérete a las máquinas por su nombre real ("Envasadora 1", "Envasadora 2", etc.).
      - ¡ESTÁ ABSOLUTAMENTE PROHIBIDO mostrar sintaxis JSON, fragmentos de código, nombres de propiedades técnicas de bases de datos o código de programación (como 'active', 'machineConfig', 'plannedGoals', 'plannedSpeeds', 'dailySupply', 'mode: manual') en tu mensaje!
      - Háblale de forma cálida, humana, natural, sumamente profesional y clara. En lugar de decir "Cambié plannedGoals del ID xyz a 1500", di "Ajusté la meta de Azúcar Familiar a 1,500 quintales". En lugar de "Establecí la envasadora como inactiva", di "He apagado la Envasadora 1 para este turno".
      - ¡ESTRUCTURA DE TEXTO Y PRESENTACIÓN VISUAL PREMIUM!: Para mantener el nivel de una herramienta ejecutiva para la gerencia, tus respuestas en 'message' deben presentarse con una estética visual impecable y profesional:
        * **Tablas de Comparación en Markdown:** Siempre que presentes datos numéricos, costos, eficiencias, turnos, o comparativas entre escenarios (por ejemplo, comparar Turno Día vs Turno Noche, o el antes y después de una propuesta), DEBES generar una tabla en formato Markdown limpia y estructurada. ¡Evita escribir listas largas de números en texto plano!
        * **Comparativas y Matrices:** Diseña matrices o resúmenes tabulados que resalten los beneficios (ej. Ahorro de costos, % de cumplimiento, capacidad utilizada).
        * **Viñetas Limpias y Organizadas:** Si utilizas viñetas, emplea el guion estándar (signo menos o guion medio) (nunca uses asteriscos sueltos con espaciados rotos ni numeraciones gigantescas). Asegúrate de dejar un salto de línea doble entre viñetas complejas para que la visualización en pantalla sea holgada y elegante.
        * **Cero Párrafos Amontonados o Corridos:** Separa tus explicaciones en párrafos cortos de 2 a 3 líneas como máximo. Usa negritas (doble asterisco) estratégicamente para resaltar métricas clave de ahorro o cumplimiento.
        * **Nombres de Campos y Limpieza:** NUNCA permitas que aparezcan nombres de variables rotos o valores numéricos huérfanos. Todo número o porcentaje debe ir acompañado de su respectiva unidad de medida (QQ, USD, %, etc.) y estar debidamente rotulado en español profesional.

      Sé preciso, ingenioso, analítico y sumamente respetuoso. Explica tus decisiones de forma clara, ejecutiva y operativa en el campo 'message' del JSON de respuesta (por ejemplo: cuántas semanas durará el plan, qué máquinas usarás, y qué estrategia aplicaste). Responde siempre en español.
    `;

    // Ensure all Genkit plugins are fully initialized
    await ai.registry.initializeAllPlugins();

    const models = [
      'googleai/gemini-2.5-flash',
      'googleai/gemini-2.5-pro'
    ];

    let lastError: any = null;
    for (const model of models) {
      try {
        console.log(`[Copilot Razonador] Iniciando bucle de agente autónomo con el modelo: ${model}...`);
        
        let currentPrompt = basePrompt;
        let attempt = 0;
        const maxAttempts = 3;
        let successfulOutput = null;

        while (attempt < maxAttempts) {
          attempt++;
          console.log(`[Copilot Razonador] Ejecutando simulación e intento de planificación ${attempt}/${maxAttempts} en ${model}...`);
          
          const result = await ai.generate({
            model,
            prompt: currentPrompt,
            output: { schema: CopilotActionSchema },
          });

          const output = result.output;
          if (!output) {
            throw new Error("El modelo de IA retornó una respuesta de salida vacía.");
          }

          // Analizar si hay una acción APPLY_PLAN para realizar la auto-evaluación y auto-corrección
          const applyPlanAction = output.suggestedActions?.find(a => a.type === 'APPLY_PLAN');
          if (applyPlanAction) {
            const weeklyBlocks = applyPlanAction.payload?.weeklyBlocks || [];
            let violatedRule: any = null;
            let offendingBlock: any = null;
            let offendingCombination: string[] = [];
            let vetoType: 'COMBINATION' | 'SUPPLY' | 'MACHINE' = 'COMBINATION';
            let vetoDetails = '';

            // Validar cada bloque semanal en busca de vetos y conflictos
            for (const block of weeklyBlocks) {
              const allocations = block.allocations || [];
              
              // 1. Math Check: Weekly raw sugar mass balance
              let weeklyProducedQQ = 0;
              for (const alloc of allocations) {
                if (alloc.productId === 'off') continue;
                const prod = input.context.products.find(p => p.id === alloc.productId);
                if (!prod) {
                  violatedRule = { label: `Producto no existente` };
                  offendingBlock = block;
                  vetoType = 'MACHINE';
                  vetoDetails = `El producto con ID "${alloc.productId}" asignado a la Envasadora ${alloc.machineId} no existe en el catálogo de productos.`;
                  break;
                }

                // Verify allowed machine configuration (allowedMachines)
                const allowedMachines = prod.allowedMachines || [1, 2, 3];
                if (!allowedMachines.includes(alloc.machineId)) {
                  violatedRule = { label: `Envasadora no permitida` };
                  offendingBlock = block;
                  vetoType = 'MACHINE';
                  vetoDetails = `La Envasadora ${alloc.machineId} no está permitida para el producto "${prod.productName}". Las envasadoras permitidas por diseño son únicamente: ${allowedMachines.join(', ')}.`;
                  break;
                }

                // Verify that the machine is active in machineConfig
                const isMachineActive = input.context.machineConfig?.[alloc.machineId]?.active ?? true;
                if (!isMachineActive) {
                  violatedRule = { label: `Envasadora Desactivada` };
                  offendingBlock = block;
                  vetoType = 'MACHINE';
                  vetoDetails = `La Envasadora ${alloc.machineId} está desactivada en la configuración actual de la planta. No se le puede asignar producción en la semana ${block.weekNumber}.`;
                  break;
                }

                const efficiency = input.context.efficiency ?? 0.85;
                const shifts = alloc.shiftsPerDay || 1;
                const days = alloc.daysActive || 5;
                const speed = input.context.plannedSpeeds?.[alloc.machineId] || prod.defaultSpeed || 100;
                const weight = prod.presentationWeight || prod.sackWeight || prod.bundleWeight || 50;
                
                const dayHours = input.context.shifts?.dayHours ?? 8;
                const nightHours = input.context.shifts?.nightHours ?? 8;
                const hoursPerDay = shifts === 2 ? (dayHours + nightHours) : dayHours;
                
                // Produced QQ = ((speed * 60 * hoursPerDay * days * weight) / 50) * efficiency
                const producedQQ = ((speed * 60 * hoursPerDay * days * weight) / 50) * efficiency;
                weeklyProducedQQ += producedQQ;
              }

              if (violatedRule) break;

              // Check raw sugar supply limit weekly balance
              const maxSupplyQQ = input.context.dailySupply * 7;
              if (weeklyProducedQQ > maxSupplyQQ) {
                violatedRule = { label: `Límite de Suministro de Azúcar Excedido` };
                offendingBlock = block;
                vetoType = 'SUPPLY';
                vetoDetails = `La producción total de la semana ${block.weekNumber} suma ${weeklyProducedQQ.toFixed(1)} QQ, superando la capacidad del suministro total disponible de ${maxSupplyQQ.toFixed(1)} QQ (Suministro diario de ${input.context.dailySupply} QQ * 7 días).`;
                break;
              }

              // 2. Check prohibited combinations matrix
              const m1Name = allocations.find((a: any) => a.machineId === 1)?.productName || 'Apagada';
              const m2Name = allocations.find((a: any) => a.machineId === 2)?.productName || 'Apagada';
              const m3Name = allocations.find((a: any) => a.machineId === 3)?.productName || 'Apagada';
              const m4Name = allocations.find((a: any) => a.machineId === 4)?.productName || 'Apagada';

              const rule = isCombinationProhibited(
                m1Name,
                m2Name,
                m3Name,
                m4Name,
                input.context.prohibitedCombinations
              );

              if (rule) {
                violatedRule = rule;
                offendingBlock = block;
                vetoType = 'COMBINATION';
                offendingCombination = [m1Name, m2Name, m3Name, m4Name];
                break;
              }
            }

            // Si se detectó una violación, inyectamos la autorreflexión de seguridad y reintentamos autónomamente
            if (violatedRule) {
              console.warn(`[Copilot Razonador] ¡VETO DETECTADO! Tipo: ${vetoType}, Regla: "${violatedRule.label}" en semana ${offendingBlock.weekNumber}.`);
              
              let reflectionPrompt = '';
              if (vetoType === 'COMBINATION') {
                reflectionPrompt = `
                REGLA DE SEGURIDAD EN CONFLICTO: "${violatedRule.label}"
                Combinación Prohibida Definida: Envasadora 1="${violatedRule.m1}" | Envasadora 2="${violatedRule.m2}" | Envasadora 3="${violatedRule.m3}" | Envasadora 4="${violatedRule.m4}"
                
                TU PROPUESTA DE PROGRAMACIÓN CON CONFLICTO:
                - Envasadora 1: "${offendingCombination[0]}"
                - Envasadora 2: "${offendingCombination[1]}"
                - Envasadora 3: "${offendingCombination[2]}"
                - Envasadora 4: "${offendingCombination[3]}"

                ¡ESTA COMBINACIÓN ESTÁ COMPLETAMENTE VETADA POR DISEÑO INDUSTRIAL DE PLANTA!
                `;
              } else if (vetoType === 'SUPPLY') {
                reflectionPrompt = `
                VETO DE CAPACIDAD/SUMINISTRO:
                ${vetoDetails}
                ¡Superar el suministro de azúcar granel disponible causa un vacío crítico en los silos y desestabiliza la planta!
                `;
              } else {
                reflectionPrompt = `
                VETO DE CONFIGURACIÓN DE ENVASADORA:
                ${vetoDetails}
                ¡Esta envasadora o producto no cumple con las restricciones permitidas por la ingeniería de la planta!
                `;
              }

              currentPrompt = `
                ${basePrompt}

                ---
                [AUTORREFLEXIÓN / EVALUACIÓN DE INTENTO ANTERIOR - INTENTO DE CORRECCIÓN #${attempt}]
                Tu propuesta de planificación anterior para la semana ${offendingBlock.weekNumber} falló la validación autónoma.
                
                ${reflectionPrompt}
                
                NUEVAS INSTRUCCIONES DE RAZONAMIENTO:
                1. Re-evalúa la distribución semanal de las máquinas. 
                2. Re-asigna el producto conflictivo a otra envasadora que tenga soporte, apaga la envasadora excedente, cambia la semana, disminuye los días activos o turnos, o utiliza combinaciones que estén marcadas como SEGURAS en la matriz.
                3. Asegúrate de cumplir la meta de producción sin violar el suministro de azúcar granel ni las reglas de combinaciones prohibidas o permitidas.

                Genera una respuesta JSON completamente corregida, limpia y libre de conflictos.
              `;
              continue;
            }
          }

          // Si pasó la verificación de seguridad, la propuesta es apta
          console.log(`[Copilot Razonador] Propuesta validada exitosamente sin vetos en el intento ${attempt}.`);
          successfulOutput = output;
          break;
        }

        if (successfulOutput) {
          console.log(`[Copilot Planificador] Éxito con el modelo ${model} tras el bucle de autorreflexión.`);
          return successfulOutput;
        }
      } catch (err: any) {
        console.error(`[Copilot Planificador] Error con modelo ${model}:`, err.message || err);
        lastError = err;
      }
    }

    throw new Error(lastError?.message || "No se pudo generar un plan o escenario inteligente válido.");
  }
);
