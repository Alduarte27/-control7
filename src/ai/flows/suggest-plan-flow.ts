'use server';
/**
 * @fileOverview An AI flow to suggest a production plan based on historical data.
 * 
 * - suggestProductionPlan - A function that handles the plan suggestion process.
 * - SuggestPlanInput - The input type for the suggestProductionPlan function.
 * - SuggestPlanOutput - The return type for the suggestProductionPlan function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ProductHistorySchema = z.object({
  id: z.string(),
  productName: z.string(),
  totalActual: z.number(),
  categoryIsPlanned: z.boolean(),
});

const WeeklyHistorySchema = z.object({
  week: z.number(),
  year: z.number(),
  products: z.array(ProductHistorySchema),
});

const SuggestPlanInputSchema = z.object({
  historicalData: z.array(WeeklyHistorySchema).describe("An array of past weekly production data. The most recent week is the last element."),
  allProducts: z.array(z.object({ id: z.string(), productName: z.string(), categoryIsPlanned: z.boolean() })).describe("A list of all active products to consider for the new plan."),
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
2.  **Enfoque**: Tu análisis debe centrarse EXCLUSIVAMENTE en los productos que pertenecen a categorías planificables ('categoryIsPlanned' es true). IGNORA por completo cualquier producto de categorías no planificables.
3.  **Análisis de Datos y Cálculo de Base**:
    a. Para cada producto planificable, calcula un **promedio ponderado** de la producción real de las últimas semanas. Dale más peso a las semanas más recientes (ej: 40% a la última semana, 30% a la penúltima, etc.). Este promedio será tu **base de sugerencia**.
    b. Analiza la tendencia de producción (creciente, decreciente, estable, esporádica).
4.  **Generación del Plan (Cálculo Numérico)**:
    a. **Tendencia Creciente**: Si la producción ha aumentado consistentemente, sugiere un valor **ligeramente superior** al promedio ponderado.
    b. **Tendencia Estable**: Utiliza el promedio ponderado como tu sugerencia principal.
    c. **Tendencia Decreciente/Esporádica**: Sugiere un valor **inferior** al promedio, o 0 si la producción ha sido nula en las últimas 1-2 semanas.
    d. Debes generar un plan para CADA producto planificable en 'allProducts'. Si un producto no debe producirse, su 'suggestedPlan' debe ser 0.
5.  **Resumen del Análisis (MUY IMPORTANTE)**:
    -   Escribe un resumen de tu análisis. Comienza con un párrafo de resumen general.
    -   Luego, utiliza listas con viñetas (guiones) para explicar las sugerencias clave. Agrupa los productos por categorías como "Aumento/Mantenimiento de Producción" y "Reducción/Cese de Producción".
    -   **NO incluyas los IDs de los productos en tu análisis de texto.** Usa solo los nombres de los productos.
    -   **Asegúrate de que los valores numéricos sugeridos en el array 'suggestions' sean coherentes con tu análisis de texto.**

**Datos de Entrada:**

**Datos Históricos (Solo productos planificables):**
{{#each historicalData}}
Semana {{week}}, Año {{year}}:
  {{#each products}}
    {{#if this.categoryIsPlanned}}
  - {{this.productName}}: Producido {{this.totalActual}} unidades.
    {{/if}}
  {{/each}}
{{/each}}

**Todos los Productos Activos Planificables para los que se debe generar un plan:**
{{#each allProducts}}
  {{#if this.categoryIsPlanned}}
- {{this.productName}}
  {{/if}}
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
    // Filter historical data and product list to only include plannable items
    const plannableInput = {
      ...input,
      historicalData: input.historicalData.map(week => ({
        ...week,
        products: week.products.filter(p => p.categoryIsPlanned),
      })),
      allProducts: input.allProducts.filter(p => p.categoryIsPlanned),
    };

    if (plannableInput.historicalData.length === 0 || plannableInput.allProducts.length === 0) {
      return {
        analysis: "No hay datos históricos o productos planificables disponibles para analizar. Se ha sugerido un plan de 0 para todos los productos planificables. Por favor, utilice la función 'Copiar Plan Anterior' o introduzca un plan manualmente para empezar.",
        suggestions: plannableInput.allProducts.map(p => ({ productId: p.id, suggestedPlan: 0 })),
      };
    }
    const { output } = await prompt(plannableInput);
    return output!;
  }
);
