'use server';
/**
 * @fileOverview An AI flow to simulate production based on operational parameters and historical data.
 *
 * - simulateProduction - A function that handles the production simulation process.
 * - SimulateProductionInput - The input type for the simulateProduction function.
 * - SimulateProductionOutput - The return type for the simulateProduction function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const HistoricalPerformanceSchema = z.object({
    totalPlanned: z.number().describe("Total units planned for the product in a past week."),
    totalActual: z.number().describe("Total units actually produced for the product in that week."),
    efficiency: z.number().describe("The production efficiency (actual / planned) for that week, as a percentage."),
});

const SimulateProductionInputSchema = z.object({
  productName: z.string().describe("The name of the product being simulated."),
  productionRate: z.number().describe("The production rate in sacks per hour."),
  hoursPerDayShift: z.number().describe("The number of working hours in a day shift."),
  hoursPerNightShift: z.number().describe("The number of working hours in a night shift."),
  activeDays: z.object({
    mon: z.boolean(),
    tue: z.boolean(),
    wed: z.boolean(),
    thu: z.boolean(),
    fri: z.boolean(),
    sat: z.boolean(),
    sun: z.boolean(),
  }).describe("Which days of the week production will be active."),
  historicalPerformance: z.optional(z.array(HistoricalPerformanceSchema)).describe("Optional: An array of historical weekly performance data for this product to provide context on real-world efficiency.")
});
export type SimulateProductionInput = z.infer<typeof SimulateProductionInputSchema>;

const DailySimulationResultSchema = z.object({
    day: z.string().describe("The day of the week (e.g., 'Lunes')."),
    optimalProduction: z.number().describe("The maximum possible production for that day based on parameters, in sacks."),
    realisticProjection: z.number().describe("A more realistic production projection based on historical efficiency, in sacks."),
});

const SimulateProductionOutputSchema = z.object({
  totalOptimalProduction: z.number().describe("The total maximum possible production for the week, in sacks."),
  totalRealisticProjection: z.number().describe("The total realistic production projection for the week, in sacks."),
  averageEfficiency: z.number().describe("The average historical efficiency percentage used for the realistic projection."),
  dailyBreakdown: z.array(DailySimulationResultSchema).describe("A day-by-day breakdown of the simulation."),
  recommendations: z.string().describe("Actionable recommendations in Spanish to improve production efficiency and align realistic projections with optimal goals. Should be a bulleted list."),
});
export type SimulateProductionOutput = z.infer<typeof SimulateProductionOutputSchema>;

export async function simulateProduction(input: SimulateProductionInput): Promise<SimulateProductionOutput> {
  return simulateProductionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'simulateProductionPrompt',
  input: { schema: SimulateProductionInputSchema },
  output: { schema: SimulateProductionOutputSchema },
  prompt: `Eres un analista experto en operaciones de producción para una empresa de alimentos. Tu tarea es analizar los parámetros de una simulación de producción, compararlos con datos históricos y generar un informe claro y con recomendaciones accionables en español.

**IMPORTANTE: Todos tus cálculos y resultados deben expresarse en "sacos".**

**Contexto de la Simulación:**
- Producto: {{productName}}
- Tasa de Producción Teórica: {{productionRate}} sacos/hora
- Horas Turno Día: {{hoursPerDayShift}} horas
- Horas Turno Noche: {{hoursPerNightShift}} horas
- Días Activos: {{#each activeDays}}{{#if this}}{{@key}} {{/if}}{{/each}}

**Datos de Rendimiento Histórico (si están disponibles, en sacos):**
{{#if historicalPerformance}}
  {{#each historicalPerformance}}
  - Semana Pasada: Planificado {{this.totalPlanned}}, Real {{this.totalActual}} (Eficiencia: {{this.efficiency}}%)
  {{/each}}
{{else}}
  - No hay datos históricos de rendimiento disponibles.
{{/if}}

**Tus Tareas:**

1.  **Calcular Producción Óptima (en sacos):**
    -   **Primero, suma las horas del turno de día y del turno de noche** para obtener el total de horas de producción por día.
    -   Calcula la producción diaria y semanal máxima posible basándote en la tasa de producción y el **total de horas de trabajo diarias**. El resultado debe ser en sacos.

2.  **Calcular Proyección Realista (en sacos):**
    -   Si hay datos históricos, calcula la **eficiencia promedio**.
    -   Aplica esta eficiencia promedio a la producción óptima para obtener una "proyección realista" en sacos.
    -   Si no hay datos históricos, asume una eficiencia conservadora del 90% para la proyección realista, y menciónalo en tus recomendaciones.

3.  **Generar Desglose Diario (en sacos):**
    -   Proporciona un desglose día por día (solo para los días activos) que muestre la producción óptima y la realista, ambas en sacos.

4.  **Generar Recomendaciones (MUY IMPORTANTE):**
    -   Tu análisis y recomendaciones DEBEN estar en español.
    -   Escribe una lista con viñetas (usando guiones "-") con consejos claros y accionables.
    -   Compara la producción óptima con la realista. ¿Cuál es la brecha en sacos?
    -   Si la eficiencia es baja, sugiere áreas de mejora (ej: "Revisar tiempos de inactividad los lunes", "Optimizar cambios de turno").
    -   Si la proyección realista no cumple un objetivo hipotético, ¿qué se necesitaría? (ej: "Para alcanzar X sacos, se podría activar el turno de noche el viernes o mejorar la eficiencia en un 5%").
    -   Si no hay datos históricos, indica que la proyección se basa en un 90% estándar y que se volverá más precisa con datos reales.
    -   El objetivo es proporcionar inteligencia de negocio, no solo números.
`,
});

const simulateProductionFlow = ai.defineFlow(
  {
    name: 'simulateProductionFlow',
    inputSchema: SimulateProductionInputSchema,
    outputSchema: SimulateProductionOutputSchema,
  },
  async (input) => {
    // This is a good place to do pre-processing or call other services if needed.
    // For this simulation, the logic is straightforward and can be handled by the LLM.
    const { output } = await prompt(input);
    return output!;
  }
);
