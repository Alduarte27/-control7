import { createGoogle } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool, isStepCount } from 'ai';

export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, limit, orderBy, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { getSystemPrompt } from '@/lib/ai-prompt';

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const hf = createOpenAI({
  baseURL: 'https://api-inference.huggingface.co/v1/',
  apiKey: process.env.HUGGINGFACE_API_KEY,
});

// El SDK de Google por defecto SOLO lee GOOGLE_GENERATIVE_AI_API_KEY, pero en
// algunos despliegues la clave vive en GEMINI_API_KEY o GOOGLE_GENAI_API_KEY.
// Leemos la primera disponible para que funcione en cualquier entorno.
const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  || process.env.GEMINI_API_KEY
  || process.env.GOOGLE_GENAI_API_KEY
  || undefined;
const googleProvider = createGoogle({ apiKey: googleApiKey });

const KG_PER_QUINTAL = 50; // Corregido para coincidir con la lógica del dashboard (1 Quintal = 50kg para cálculos de planta)

import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  // Rate limiting (20 requests per minute per IP)
  // In App Router API routes, we can get IP from x-forwarded-for header
  const ip = req.headers.get('x-forwarded-for') || 'anonymous';
  const rateLimitResult = rateLimit(ip, 20, 60 * 1000); // 20 requests per minute

  if (!rateLimitResult.success) {
    return new Response(JSON.stringify({ error: 'Demasiadas peticiones. Por favor, intenta más tarde.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      },
    });
  }

  const { messages, config } = await req.json();

  let modelConfig = config?.model ?? 'google:gemini-2.0-flash';
  // Soporte para configuraciones antiguas guardadas en localStorage sin prefijo
  if (!modelConfig.includes(':')) {
    modelConfig = `google:${modelConfig}`;
  }

  const [provider, modelName] = modelConfig.split(':');
  
  let aiModel;
  if (provider === 'groq') {
    aiModel = groq(modelName);
  } else if (provider === 'hf') {
    aiModel = hf(modelName);
  } else if (provider === 'local') {
    const localOllama = createOpenAI({
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'ollama', // No requiere API key real
    });
    aiModel = localOllama(modelName);
  } else {
    aiModel = googleProvider(modelName);
  }

  const temperature = config?.temperature ?? 0.7;
  const maxTokens = config?.maxTokens ?? 2048;

  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  
  const customPrompt = config?.systemPrompt?.trim();
  const baseSystemPrompt = customPrompt 
    ? `${getSystemPrompt()}\n\n[INSTRUCCIONES ADICIONALES DEL USUARIO (Prioridad Alta)]:\n${customPrompt}` 
    : getSystemPrompt();

  const systemPrompt = `[INFORMACIÓN DEL SISTEMA: La fecha de hoy es ${dateString}. El año actual es ${currentDate.getFullYear()}. Utiliza este año como referencia para preguntas como "este año", "año pasado", "hoy", etc.]\n\n${baseSystemPrompt}`;

  try {
    const result = streamText({
      model: aiModel,
      messages,
      system: systemPrompt,
      temperature,
      maxOutputTokens: maxTokens,
      stopWhen: isStepCount(5), // Permite encadenar hasta 5 herramientas automáticamente (Tool Calling Multi-Step)
      tools: {
        // ─── DOCUMENTACIÓN Y ESTRUCTURA DE LA APP (RAG / REASONING) ───
        getAppBlueprint: tool({
          description: 'Obtiene el manual completo, estructura de base de datos y funcionamiento interno de la aplicación. Úsalo SIEMPRE que el usuario te pregunte "cómo funciona X", "dónde encuentro el menú Y" o si tienes dudas sobre la estructura de la app.',
          inputSchema: z.object({ request: z.string().optional() }),
          execute: async () => {
            try {
              const blueprintPath = path.join(process.cwd(), 'docs', 'blueprint.md');
              const backendPath = path.join(process.cwd(), 'docs', 'backend.json');
              
              let docData = '';
              if (fs.existsSync(blueprintPath)) {
                docData += `### BLUEPRINT (Guía de Interfaz y Lógica):\n${fs.readFileSync(blueprintPath, 'utf8')}\n\n`;
              }
              if (fs.existsSync(backendPath)) {
                docData += `### BACKEND (Estructura de Base de Datos y Firestore):\n${fs.readFileSync(backendPath, 'utf8')}\n\n`;
              }
              
              if (!docData) {
                return { warning: "Los archivos de documentación no se encontraron en la carpeta docs/" };
              }
              return { documentation: docData };
            } catch (e: any) {
              return { error: 'Error leyendo documentación: ' + e.message };
            }
          }
        }),

        // ─── COLECCIONES GENÉRICAS ───────────────────────────────────
        getDatabaseCollection: tool({
          description: 'Obtiene los datos de cualquier colección de la base de datos. Úsala para consultar catálogos (operadores, supervisores, categorias, proveedores, etc). Colecciones disponibles: accessProfiles, appConfiguration, categories, dailyLogs, maintenanceTypes, melazaSuppliers, operators, packagingMaterials, productionPlans, products, projectionSnapshots, sessions, simulation_assets, stopCauses, supervisors, suppliers, weeklySummaries. Si se crea una nueva, también puedes consultarla aquí.',
          inputSchema: z.object({
            collectionName: z.string().describe('El nombre exacto de la colección a consultar (ej: "operators", "categories").'),
            maxResultados: z.number().optional().describe('Número máximo de resultados. Por defecto 20.'),
          }),
          execute: async ({ collectionName, maxResultados = 20 }) => {
            try {
              const snapshot = await getDocs(query(collection(db, collectionName), limit(maxResultados)));
              return snapshot.docs.map(doc => {
                const data = doc.data();
                // Protección contra objetos masivos que causan Error 413 Payload Too Large
                if (collectionName === 'projectionSnapshots' && data.config) {
                  delete data.config; // Se elimina config para no saturar la memoria
                }
                return { id: doc.id, ...data };
              });
            } catch (error) {
              return { error: `Error al consultar la colección ${collectionName}. Verifica que el nombre sea correcto.` };
            }
          },
        }),

        // ─── PRODUCCIÓN REAL (fuente: productionPlans) ───────────────
        getProductionSummary: tool({
          description: `Lee los planes de producción (productionPlans) y calcula la producción REAL acumulada por producto.
  Cada plan tiene un array "products[]" donde cada producto tiene:
  - productName: nombre del producto
  - primaryPackaging: "granel", "fardo", o saco/bolsa
  - actual: objeto con días {mon, tue, wed, thu, fri, sat, sun} y cada día tiene {day: number, night: number}
  - planned: cantidad planificada total
  - sackWeight: peso por unidad en kg
  - bundleWeight: peso por fardo en kg (si aplica)
  Usar cuando pregunten por producción total, granel, fardos, sacos, producción hasta la fecha, etc.`,
          inputSchema: z.object({
            tipoEmpaque: z.string().optional().describe('Filtrar por tipo de empaque: "granel", "fardo", o dejar vacío para todos.'),
            nombreProducto: z.string().optional().describe('Filtrar por nombre de producto (búsqueda parcial).'),
            año: z.number().optional().describe('Filtrar por año calendario (ej: 2026). Si el usuario dice "este año" usa el año actual.'),
            semana: z.number().optional().describe('Filtrar por número de semana específico (1-52).'),
            maxPlanes: z.number().optional().describe('Número de planes a analizar si no se especifica año. Por defecto 52.'),
          }),
          execute: async ({ tipoEmpaque, nombreProducto, año, semana, maxPlanes = 52 }) => {
            try {
              // Si se filtra por año, usar where(); si no, usar orderBy + limit
              let q;
              if (año) {
                q = query(
                  collection(db, 'productionPlans'),
                  where('year', '==', año),
                  ...(semana ? [where('week', '==', semana)] : []),
                  limit(60)
                );
              } else {
                q = query(
                  collection(db, 'productionPlans'),
                  orderBy('year', 'desc'),
                  limit(maxPlanes)
                );
              }
              const snapshot = await getDocs(q);
              const añoFiltrado = año ?? 'todos';

              const resumenProductos: Record<string, any> = {};
              let totalUnidades = 0;
              let totalQQ = 0;

              snapshot.docs.forEach(doc => {
                const plan = doc.data();
                const semana = `Semana ${plan.week ?? '?'} - ${plan.year ?? '?'}`;
                const productos: any[] = plan.products ?? [];

                productos.forEach((prod: any) => {
                  // Filtro por tipo de empaque
                  if (tipoEmpaque && prod.primaryPackaging !== tipoEmpaque) return;
                  // Filtro por nombre
                  if (nombreProducto && !prod.productName?.toLowerCase().includes(nombreProducto.toLowerCase())) return;

                  // Sumar producción real de todos los días y turnos
                  const actualObj = prod.actual ?? {};
                  let prodReal = 0;
                  for (const dayKey of Object.keys(actualObj)) {
                    const shift = actualObj[dayKey];
                    prodReal += (shift?.day ?? 0) + (shift?.night ?? 0);
                  }

                  if (prodReal === 0) return;

                  const isFardo = prod.primaryPackaging === 'fardo' || !!prod.bundleWeight;
                  const pesoUnitario = isFardo && prod.bundleWeight ? prod.bundleWeight : (prod.sackWeight ?? KG_PER_QUINTAL);
                  const qqReal = (prodReal * pesoUnitario) / KG_PER_QUINTAL;

                  const key = prod.productName ?? prod.id ?? 'Desconocido';
                  if (!resumenProductos[key]) {
                    resumenProductos[key] = {
                      producto: key,
                      tipoEmpaque: prod.primaryPackaging ?? 'saco',
                      unidadesReales: 0,
                      quintalesReales: 0,
                      unidadesPlanificadas: 0,
                      semanas: [],
                    };
                  }
                  resumenProductos[key].unidadesReales += prodReal;
                  resumenProductos[key].quintalesReales += qqReal;
                  resumenProductos[key].unidadesPlanificadas += prod.planned ?? 0;
                  if (!resumenProductos[key].semanas.includes(semana)) {
                    resumenProductos[key].semanas.push(semana);
                  }

                  totalUnidades += prodReal;
                  totalQQ += qqReal;
                });
              });

              const lista = Object.values(resumenProductos).sort((a: any, b: any) => b.unidadesReales - a.unidadesReales);

              return {
                totalUnidades,
                totalQQ: Math.round(totalQQ * 10) / 10,
                filtroEmpaque: tipoEmpaque ?? 'todos',
                filtroAño: año ?? 'todos',
                filtroSemana: semana ?? 'todas',
                productos: lista.map((p: any) => ({
                  ...p,
                  quintalesReales: Math.round(p.quintalesReales * 10) / 10,
                })),
                planesAnalizados: snapshot.docs.length,
              };
            } catch (error) {
              console.error(error);
              return { error: 'Error al obtener producción de productionPlans.' };
            }
          },
        }),

        // ─── PARADAS (fuente: dailyLogs) ─────────────────────────────
        getRecentStops: tool({
          description: 'Obtiene las últimas paradas de producción de los registros diarios (dailyLogs). Cada documento tiene timeSlots con máquinas y dentro de cada máquina hay un array "stops". Puedes filtrar por un rango de fechas o una fecha específica usando fechaInicio y fechaFin (YYYY-MM-DD). Si el usuario pide "esta semana", calcula la fecha de inicio (lunes) y fin (domingo) y envíalas.',
          inputSchema: z.object({
            fechaInicio: z.string().optional().describe('Fecha de inicio YYYY-MM-DD (ej: 2026-06-22)'),
            fechaFin: z.string().optional().describe('Fecha de fin YYYY-MM-DD (ej: 2026-06-28)'),
            maxResultados: z.number().optional().describe('Número máximo de días/turnos a analizar. Por defecto 20.'),
          }),
          execute: async ({ fechaInicio, fechaFin, maxResultados }) => {
            try {
              let q;
              if (fechaInicio) {
                // Si solo mandan fechaInicio, usamos esa fecha para inicio y fin
                const fin = fechaFin || fechaInicio;
                // dailyLog IDs format: "YYYY-MM-DD_turn"
                q = query(
                  collection(db, 'dailyLogs'),
                  where('__name__', '>=', fechaInicio),
                  where('__name__', '<=', fin + '\uf8ff'),
                  limit(maxResultados || 50)
                );
              } else {
                q = query(collection(db, 'dailyLogs'), orderBy('__name__', 'desc'), limit(maxResultados || 15));
              }
              const snapshot = await getDocs(q);
              const paradas: any[] = [];
              snapshot.forEach(doc => {
                const data = doc.data();
                const partes = doc.id.split('_');
                const fecha = partes[0];
                const turno = partes[1];
                if (data.timeSlots) {
                  Object.values(data.timeSlots).forEach((slot: any) => {
                    Object.entries(slot).forEach(([maquina, maquinaData]: [string, any]) => {
                      if (maquinaData?.stops && Array.isArray(maquinaData.stops)) {
                        maquinaData.stops.forEach((s: any) => {
                          paradas.push({
                            fecha,
                            turno,
                            maquina: maquina.replace('machine_', 'Máquina '),
                            motivo: s.reason,
                            duracionMinutos: s.duration,
                            tipo: s.type,
                          });
                        });
                      }
                    });
                  });
                }
              });
              return paradas.slice(0, maxResultados);
            } catch (error) {
              return { error: 'Error al consultar paradas.' };
            }
          },
        }),

        // ─── PLANES DE PRODUCCIÓN ────────────────────────────────────
        getProductionPlans: tool({
          description: 'Obtiene los planes de producción semanales con metas planificadas por producto. Usa esto si el usuario pide "lo planificado para esta semana", "qué tenemos proyectado hacer la primera semana", etc.',
          inputSchema: z.object({
            año: z.number().optional().describe('Año del plan (ej: 2026)'),
            semana: z.number().optional().describe('Semana del año (ej: 31)'),
            maxPlanes: z.number().optional().describe('Número de planes a retornar. Por defecto 10.'),
          }),
          execute: async ({ año, semana, maxPlanes = 10 }) => {
            try {
              let q;
              if (año) {
                q = query(
                  collection(db, 'productionPlans'),
                  where('year', '==', año),
                  ...(semana ? [where('week', '==', semana)] : []),
                  limit(maxPlanes)
                );
              } else {
                q = query(
                  collection(db, 'productionPlans'),
                  orderBy('year', 'desc'),
                  orderBy('week', 'desc'),
                  limit(maxPlanes)
                );
              }
              const snapshot = await getDocs(q);
              return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  semana: data.week,
                  año: data.year,
                  totalProductos: data.products?.length ?? 0,
                  resumen: data.products?.map((p: any) => ({
                    producto: p.productName,
                    planificado: p.planned ?? 0,
                    empaque: p.primaryPackaging ?? 'saco',
                  })) ?? [],
                };
              });
            } catch (error) {
              return { error: 'Error al obtener planes de producción.' };
            }
          },
        }),

        // ─── RESÚMENES SEMANALES (fuente: weeklySummaries) ──────────
        getWeeklySummaries: tool({
          description: `Obtiene los resúmenes semanales pre-calculados de la planta (weeklySummaries). Cada resumen incluye:
- planificado y real total de la semana (en unidades),
- producción no planificada,
- cumplimiento porcentual (planificado vs real),
- total por día de la semana (dailyTotals),
- total por día y turno (dailyShiftTotals: day/night),
- totales por categoría (categoryTotals).
Ideal para reportes comparativos entre semanas, historial, tendencias y resúmenes ejecutivos. Los IDs de los documentos tienen el formato "AAAA-WWW" (ej: "2025-W31").`,
          inputSchema: z.object({
            año: z.number().optional().describe('Filtrar por año (ej: 2026). Si el usuario dice "este año", usa el año actual.'),
            semana: z.number().optional().describe('Filtrar por semana específica (1-52).'),
            maxResultados: z.number().optional().describe('Número máximo de semanas a retornar. Por defecto 12.'),
          }),
          execute: async ({ año, semana, maxResultados = 12 }) => {
            try {
              // Los IDs son "AAAA-WWW". Se lee en orden ascendente (no requiere índice
              // compuesto) y se invierte en memoria para devolver las semanas más recientes.
              const q = query(collection(db, 'weeklySummaries'), orderBy('__name__', 'asc'), limit(300));
              const snapshot = await getDocs(q);

              const resumenes = snapshot.docs
                .filter(doc => {
                  const m = /^(\d{4})-W(\d{1,2})$/i.exec(doc.id);
                  if (!m) return false;
                  const docYear = parseInt(m[1], 10);
                  const docWeek = parseInt(m[2], 10);
                  if (año && docYear !== año) return false;
                  if (semana && docWeek !== semana) return false;
                  return true;
                })
                .reverse()
                .map(doc => {
                  const d = doc.data();
                  const planificado = d.totalPlanned ?? 0;
                  const realSobrePlanificado = d.totalActualForPlanned ?? 0;
                  const cumplimiento = planificado > 0 ? Math.round((realSobrePlanificado / planificado) * 100) : null;
                  return {
                    semana: `Semana ${d.week} - ${d.year}`,
                    planificado,
                    real: d.totalActual ?? 0,
                    realSobrePlanificado,
                    noPlanificado: d.totalUnplannedProduction ?? 0,
                    cumplimientoPorcentaje: cumplimiento,
                    totalPorDia: d.dailyTotals ?? {},
                    totalPorDiaYTurno: d.dailyShiftTotals ?? {},
                    porCategoria: d.categoryTotals ?? {},
                  };
                });

              if (resumenes.length === 0) {
                return { mensaje: 'No se encontraron resúmenes semanales con ese filtro.', resumenes: [] };
              }
              return { resumenes };
            } catch (error) {
              console.error(error);
              return { error: 'Error al obtener resúmenes semanales.' };
            }
          },
        }),

        // ─── MATERIAL DE EMPAQUE ─────────────────────────────────────
        getPackagingMaterials: tool({
          description: 'Obtiene el inventario de materiales de empaque (packagingMaterials). Incluye código, nombre, cantidad, proveedor, estado y fecha de recepción.',
          inputSchema: z.object({
            estado: z.string().optional().describe('Filtrar por estado: active, consumed, partial.'),
            maxResultados: z.number().optional().describe('Número máximo de registros. Por defecto 25.'),
          }),
          execute: async ({ estado, maxResultados = 25 }) => {
            try {
              let q;
              if (estado) {
                q = query(collection(db, 'packagingMaterials'), where('status', '==', estado), limit(maxResultados));
              } else {
                q = query(collection(db, 'packagingMaterials'), orderBy('receivedAt', 'desc'), limit(maxResultados));
              }
              const snapshot = await getDocs(q);
              return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
              return { error: 'Error al obtener materiales de empaque.' };
            }
          },
        }),

        // ─── PROYECCIONES Y ESCENARIOS ───────────────────────────────
        getProjections: tool({
          description: 'Obtiene la LISTA de "escenarios simulados" o "proyecciones" guardadas (solo nombres y fechas, sin detalle masivo). Úsalo para saber qué escenarios existen y obtener su ID.',
          inputSchema: z.object({
            maxResultados: z.number().optional().describe('Número de proyecciones a retornar. Por defecto 20.'),
          }),
          execute: async ({ maxResultados = 20 }) => {
            try {
              const q = query(
                collection(db, 'projectionSnapshots'),
                orderBy('createdAt', 'desc'),
                limit(maxResultados)
              );
              const snapshot = await getDocs(q);
              return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                  id: doc.id,
                  name: data.name,
                  createdAt: data.createdAt,
                  isGranelActive: data.config?.isGranelActive,
                  zafraEndDate: data.config?.zafraEndDate,
                };
              });
            } catch (error: any) {
              return { error: 'Error al obtener proyecciones: ' + error.message };
            }
          },
        }),

        getProjectionDetails: tool({
          description: 'Obtiene el detalle de lo que se va a producir en una proyección específica, filtrado por un mes y año para evitar saturar la memoria de la IA. Usa esta herramienta para responder "qué tenemos planificado en el mes X según la proyección Y".',
          inputSchema: z.object({
            projectionId: z.string().describe('El ID de la proyección (obtenido de getProjections).'),
            year: z.string().describe('El año a consultar (ej: "2026").'),
            month: z.string().describe('El mes a consultar en formato de 2 dígitos (ej: "08" para Agosto).'),
          }),
          execute: async ({ projectionId, year, month }) => {
            try {
              const docSnap = await getDocs(query(collection(db, 'projectionSnapshots')));
              const snapshot = docSnap.docs.find(d => d.id === projectionId);
              if (!snapshot) return { error: 'Proyección no encontrada' };
              
              const data = snapshot.data();
              const overrides = data.config?.overrides || {};
              const prefix = `${year}-${month}`; // Ej: 2026-08
              
              // Filtrar solo las fechas que coincidan con el mes y resumir por producto
              const resumenPorProducto: Record<string, { turnosAsignados: number, velocidadPromedio: number }> = {};
              let totalTurnos = 0;

              for (const [key, value] of Object.entries(overrides)) {
                // key format: "maq-YYYY-MM-DD-turno"
                // Mejor comprobación de la fecha en la llave
                if (key.includes(`-${prefix}-`)) {
                  const val = value as any;
                  if (!val.inactive && val.productId) {
                    const prodId = val.productId;
                    if (!resumenPorProducto[prodId]) {
                      resumenPorProducto[prodId] = { turnosAsignados: 0, velocidadPromedio: 0 };
                    }
                    resumenPorProducto[prodId].turnosAsignados += 1;
                    resumenPorProducto[prodId].velocidadPromedio += (val.speed || 0);
                    totalTurnos++;
                  }
                }
              }

              // Calcular promedios
              for (const p of Object.values(resumenPorProducto)) {
                if (p.turnosAsignados > 0) {
                  p.velocidadPromedio = Math.round(p.velocidadPromedio / p.turnosAsignados);
                }
              }

              return {
                nombreEscenario: data.name,
                mesConsultado: `${year}-${month}`,
                totalTurnosActivosEnMes: totalTurnos,
                resumenPorProducto,
                mensaje: "Estos son los turnos asignados por producto en este mes según la proyección. La velocidad es la producción estimada por turno."
              };
            } catch (error: any) {
              return { error: 'Error al obtener detalles de la proyección: ' + error.message };
            }
          }
        }),

        // ─── CATÁLOGO DE PRODUCTOS ───────────────────────────────────
        getProducts: tool({
          description: 'Obtiene el catálogo completo de productos configurados en el sistema.',
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const snapshot = await getDocs(query(collection(db, 'products'), orderBy('order')));
              return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            } catch (error) {
              return { error: 'Error al obtener productos.' };
            }
          },
        }),

        // ─── BITÁCORAS ───────────────────────────────────────────────
        getLogHistory: tool({
          description: 'Obtiene el historial de bitácoras de turno registradas en dailyLogs.',
          inputSchema: z.object({
            maxResultados: z.number().optional().describe('Número de registros. Por defecto 20.'),
          }),
          execute: async ({ maxResultados = 20 }) => {
            try {
              const snapshot = await getDocs(query(
                collection(db, 'dailyLogs'),
                orderBy('__name__', 'desc'),
                limit(maxResultados)
              ));
              return snapshot.docs.map(doc => {
                const data = doc.data();
                const partes = doc.id.split('_');
                return {
                  id: doc.id,
                  fecha: partes[0],
                  turno: partes[1] ?? '?',
                  tieneParadas: Object.values(data.timeSlots ?? {}).some((slot: any) =>
                    Object.values(slot).some((m: any) => m?.stops?.length > 0)
                  ),
                };
              });
            } catch (error) {
              return { error: 'Error al obtener bitácoras.' };
            }
          },
        }),

      },
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error('SERVER ERROR in /api/chat:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
