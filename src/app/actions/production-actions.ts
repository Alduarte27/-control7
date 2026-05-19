'use server';

import { productionAdvisorFlow } from '@/ai/productionAdvisorFlow';
import { copilotFlow } from '@/ai/copilotFlow';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';

// --- Production Advisor Actions ---

export async function analyzeProductionScenarios(input: any) {
  try {
    const result = await productionAdvisorFlow(input);
    return result;
  } catch (error: any) {
    console.error("Error in analyzeProductionScenarios:", error);
    throw new Error(error.message || "Failed to generate production scenarios.");
  }
}

// --- Copilot Conversational & Memory Actions ---

export async function saveCopilotMemory(role: string, content: string, actionType?: string, details?: any) {
  try {
    const docRef = await addDoc(collection(db, 'copilot_memory'), {
      role,
      content,
      actionType: actionType || null,
      details: details || null,
      timestamp: new Date().toISOString()
    });
    return { id: docRef.id };
  } catch (error: any) {
    console.error("Error in saveCopilotMemory:", error);
    throw new Error(error.message || "Failed to save copilot memory.");
  }
}

export async function getCopilotMemories(limitCount: number = 10) {
  try {
    const q = query(
      collection(db, 'copilot_memory'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    const memories: any[] = [];
    snap.forEach(doc => {
      memories.push({ id: doc.id, ...doc.data() });
    });
    return memories;
  } catch (error: any) {
    console.error("Error in getCopilotMemories:", error);
    return [];
  }
}

export async function chatWithCopilot(message: string, context: any) {
  try {
    // 1. Retrieve the latest episodic memories from Firestore to provide long-term context
    const memories = await getCopilotMemories(10);

    // 2. Inject memories dynamically into the flow context
    const enrichedContext = {
      ...context,
      memories
    };

    // 3. Invoke Genkit copilotFlow
    const result = await copilotFlow({ message, context: enrichedContext });
    return result;
  } catch (error: any) {
    console.error("Error in chatWithCopilot:", error);
    throw new Error(error.message || "Failed to interact with Copilot.");
  }
}
