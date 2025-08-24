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
  prompt: `You are an expert production planner for a food manufacturing company.
Your task is to create a weekly production plan suggestion and provide a clear, concise analysis explaining your reasoning.

First, analyze the provided historical production data to identify trends, seasonality, and product rotation. The data is ordered from oldest to most recent week.

Second, based on your analysis, generate a production plan for the upcoming week for all active products listed in 'allProducts'. Your goal is to optimize production to meet demand while avoiding overproduction, which could lead to product spoilage.
- Prioritize products that show consistent or increasing production trends.
- Be conservative with products that have sporadic, declining, or zero production in recent weeks. Suggest a plan of 0 for products with no recent activity unless there is a clear cyclical pattern.
- The output must be a production plan for every product listed in 'allProducts'. If a product should not be produced, its suggestedPlan should be 0.

Third, write a summary of your analysis. Explain the key trends you noticed and justify your most significant suggestions (e.g., why you are increasing production for Product A, or decreasing it for Product B). This analysis should be clear and easy for a non-technical manager to understand.

Return both the analysis and the plan suggestions in the required JSON format.

Historical Data:
{{#each historicalData}}
Week {{week}}, Year {{year}}:
  {{#each products}}
  - {{productName}} (ID: {{id}}): Produced {{totalActual}} units.
  {{/each}}
{{/each}}

All Active Products to generate a plan for:
{{#each allProducts}}
- {{productName}} (ID: {{id}})
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
