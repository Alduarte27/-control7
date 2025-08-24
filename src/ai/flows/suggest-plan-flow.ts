'use server';
/**
 * @fileOverview An AI flow to suggest a production plan based on historical data.
 * 
 * - suggestProductionPlan - A function that handles the plan suggestion process.
 * - SuggestPlanInput - The input type for the suggestProductionPlan function.
 * - SuggestPlanOutput - The return type for the suggestProductionPlan function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ProductHistorySchema = z.object({
  id: z.string(),
  productName: z.string(),
  totalActual: z.number(),
});

const WeeklyHistorySchema = z.object({
  week: z.number(),
  year: z.number(),
  products: z.array(ProductHistorySchema),
});

const SuggestPlanInputSchema = z.object({
  historicalData: z.array(WeeklyHistorySchema).describe("An array of past weekly production data. The most recent week is the last element."),
  allProducts: z.array(z.object({ id: z.string(), productName: z.string()})).describe("A list of all active products to consider for the new plan."),
});
export type SuggestPlanInput = z.infer<typeof SuggestPlanInputSchema>;

const SuggestedProductPlanSchema = z.object({
  productId: z.string().describe("The unique ID of the product."),
  suggestedPlan: z.number().describe("The suggested production quantity for the week."),
});

const SuggestPlanOutputSchema = z.object({
  analysis: z.string().describe("A detailed text analysis explaining the reasoning behind the production plan suggestions."),
  suggestions: z.array(SuggestedProductPlanSchema),
});
export type SuggestPlanOutput = z.infer<typeof SuggestPlanOutputSchema>;

export async function suggestProductionPlan(input: SuggestPlanInput): Promise<SuggestPlanOutput> {
  return suggestPlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestPlanPrompt',
  input: { schema: SuggestPlanInputSchema },
  output: { schema: SuggestPlanOutputSchema },
  prompt: `Eres un experto planificador de producción en una empresa de alimentos. Tu tarea es crear una sugerencia de plan de producción semanal y proporcionar un análisis claro y conciso en español.

**Instrucciones Clave:**
1.  **Idioma**: Tu respuesta y análisis DEBEN estar completamente en español.
2.  **Análisis de Datos**: Analiza los datos históricos de producción proporcionados para identificar tendencias, estacionalidad y rotación de productos. Los datos están ordenados desde la semana más antigua a la más reciente.
3.  **Generación del Plan**: Basado en tu análisis, genera un plan de producción para la próxima semana para todos los productos activos listados en 'allProducts'. El objetivo es optimizar la producción para satisfacer la demanda y evitar la sobreproducción.
    -   Prioriza productos con tendencias de producción consistentes o crecientes.
    -   Sé conservador con productos de producción esporádica, decreciente o nula en semanas recientes. Sugiere un plan de 0 para productos sin actividad reciente.
    -   Debes generar un plan para CADA producto en 'allProducts'. Si un producto no debe producirse, su 'suggestedPlan' debe ser 0.
4.  **Resumen del Análisis (MUY IMPORTANTE)**:
    -   Escribe un resumen de tu análisis. Comienza con un párrafo de resumen general.
    -   Luego, utiliza listas con viñetas (guiones) para explicar las sugerencias clave. Agrupa los productos por categorías como "Aumento/Mantenimiento de Producción" y "Reducción/Cese de Producción".
    -   **NO incluyas los IDs de los productos en tu análisis de texto.** Usa solo los nombres de los productos. El análisis debe ser fácil de entender para un gerente.

**Datos de Entrada:**

**Datos Históricos:**
{{#each historicalData}}
Semana {{week}}, Año {{year}}:
  {{#each products}}
  - {{productName}}: Producido {{totalActual}} unidades.
  {{/each}}
{{/each}}

**Todos los Productos Activos para los que se debe generar un plan:**
{{#each allProducts}}
- {{productName}}
{{/each}}
`,
});

const suggestPlanFlow = ai.defineFlow(
  {
    name: 'suggestPlanFlow',
    inputSchema: SuggestPlanInputSchema,
    outputSchema: SuggestPlanOutputSchema,
  },
  async (input) => {
    if (input.historicalData.length === 0) {
      // If there's no history, suggest 0 for all products.
      return {
        analysis: "No hay datos históricos disponibles para analizar. Se ha sugerido un plan de 0 para todos los productos. Por favor, utilice la función 'Copiar Plan Anterior' o introduzca un plan manualmente para empezar.",
        suggestions: input.allProducts.map(p => ({ productId: p.id, suggestedPlan: 0 })),
      };
    }
    const { output } = await prompt(input);
    return output!;
  }
);
