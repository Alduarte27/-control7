'use server';
/**
 * @fileOverview An AI flow to forecast future production demand based on historical data.
 * 
 * - forecastDemand - A function that handles the demand forecasting process.
 * - ForecastDemandInput - The input type for the forecastDemand function.
 * - ForecastDemandOutput - The return type for the forecastDemand function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ProductHistorySchema = z.object({
  productName: z.string(),
  totalActual: z.number(),
  categoryIsPlanned: z.boolean(),
});

const WeeklyHistorySchema = z.object({
  week: z.number(),
  year: z.number(),
  products: z.array(ProductHistorySchema),
});

export const ForecastDemandInputSchema = z.object({
  historicalData: z.array(WeeklyHistorySchema).describe("An array of past weekly production data for plannable products. The most recent week is the last element."),
});
export type ForecastDemandInput = z.infer<typeof ForecastDemandInputSchema>;

export const ForecastDemandOutputSchema = z.object({
  analysis: z.string().describe("A qualitative forecast of demand for the next 2-4 weeks, written in Spanish. It should identify products with growing, stable, or declining demand."),
});
export type ForecastDemandOutput = z.infer<typeof ForecastDemandOutputSchema>;

export async function forecastDemand(input: ForecastDemandInput): Promise<ForecastDemandOutput> {
  return forecastDemandFlow(input);
}

const prompt = ai.definePrompt({
  name: 'forecastDemandPrompt',
  input: { schema: ForecastDemandInputSchema },
  output: { schema: ForecastDemandOutputSchema },
  prompt: `Eres un analista de datos senior especializado en pronósticos de demanda para una empresa de alimentos. Tu tarea es generar un pronóstico cualitativo en español para las próximas 2-4 semanas.

**Instrucciones Clave:**
1.  **Idioma**: Tu respuesta DEBE estar completamente en español.
2.  **Enfoque**: Analiza únicamente los datos de productos de categorías planificables.
3.  **Análisis de Tendencias**: Examina los datos históricos para identificar patrones clave:
    *   **Tendencia Creciente**: Productos cuya producción real ha aumentado consistentemente.
    *   **Tendencia Estable**: Productos con producción constante y predecible.
    *   **Tendencia Decreciente/Volátil**: Productos con producción a la baja, esporádica o muy variable.
4.  **Generación del Pronóstico**:
    *   Escribe un resumen ejecutivo sobre la perspectiva general de la demanda.
    *   Luego, en una sección de "Pronóstico por Producto", usa viñetas para clasificar los productos más relevantes en las categorías de tendencia (Creciente, Estable, Decreciente/Volátil).
    *   Para cada producto, proporciona una breve justificación de tu pronóstico (ej: "Se espera que la demanda continúe fuerte debido a...")
    *   Sé claro y directo. El objetivo es proporcionar una guía estratégica para la planificación.
    *   NO incluyas los IDs de los productos, solo los nombres.

**Datos Históricos de Producción (Productos Planificables):**
{{#each historicalData}}
Semana {{week}}, Año {{year}}:
  {{#each products}}
    {{#if this.categoryIsPlanned}}
  - {{this.productName}}: Producción Real {{this.totalActual}} unidades.
    {{/if}}
  {{/each}}
{{/each}}
`,
});

const forecastDemandFlow = ai.defineFlow(
  {
    name: 'forecastDemandFlow',
    inputSchema: ForecastDemandInputSchema,
    outputSchema: ForecastDemandOutputSchema,
  },
  async (input) => {
    // Filter to only include plannable products for the analysis
    const plannableInput = {
      ...input,
      historicalData: input.historicalData.map(week => ({
        ...week,
        products: week.products.filter(p => p.categoryIsPlanned),
      })),
    };

    if (plannableInput.historicalData.length === 0) {
      return {
        analysis: "No hay suficientes datos históricos de productos planificables para generar un pronóstico de demanda. Por favor, asegúrate de tener varias semanas de producción registradas.",
      };
    }
    const { output } = await prompt(plannableInput);
    return output!;
  }
);
