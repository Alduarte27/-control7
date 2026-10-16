const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyB0Mv7wdCkz-lMBARnKi3ZNlKZFdM4Any4",
  authDomain: "control-7-61a3f.firebaseapp.com",
  projectId: "control-7-61a3f",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const observationCategories = [
  {
    name: "Calidad de Insumo / Materia Prima",
    description: "Novedades y variaciones en materia prima o empaque que no detienen el equipo pero requieren seguimiento."
  },
  {
    name: "Desviaciones de Proceso / Operativas",
    description: "Ajustes menores de parámetros, pruebas o fluctuaciones en la línea durante operación continua."
  },
  {
    name: "Condiciones de Máquina / Ruido / Desgaste",
    description: "Observaciones de monitoreo físico (ruidos, vibraciones, leves fugas) para inspección en mantenimiento posterior."
  },
  {
    name: "Condiciones Ambientales / Entorno",
    description: "Factores de entorno (temperatura, humedad, espacio) que afectan la marcha sin parar la máquina."
  }
];

const observationCauses = [
  {
    name: "Materia Prima / Empaque Defectuoso (en marcha)",
    categoryName: "Calidad de Insumo / Materia Prima",
    color: "#0ea5e9",
    type: "observation",
    description: "Defecto en bobina, fardo o empaque que permite continuar operando con ajustes."
  },
  {
    name: "Variación Ligera de Peso / Dosificación",
    categoryName: "Calidad de Insumo / Materia Prima",
    color: "#06b6d4",
    type: "observation",
    description: "Desviación detectada dentro de límites tolerables de peso sin requerir detención."
  },
  {
    name: "Impresión / Fechado / Cierre Defectuoso",
    categoryName: "Calidad de Insumo / Materia Prima",
    color: "#6366f1",
    type: "observation",
    description: "Defecto estético o menor en loteado/sellado registrado para control de calidad."
  },
  {
    name: "Ruido o Vibración Anormal en Monitoreo",
    categoryName: "Condiciones de Máquina / Ruido / Desgaste",
    color: "#8b5cf6",
    type: "observation",
    description: "Sonido o vibración inusual detectada en operación continua para pronta revisión."
  },
  {
    name: "Fuga Menor (Aire / Aceite) en Operación",
    categoryName: "Condiciones de Máquina / Ruido / Desgaste",
    color: "#a855f7",
    type: "observation",
    description: "Pequeño escape neumático o de lubricante que no interrumpe el ciclo productivo."
  },
  {
    name: "Lote de Prueba / Corrida Experimental",
    categoryName: "Desviaciones de Proceso / Operativas",
    color: "#10b981",
    type: "observation",
    description: "Evaluación de nuevo material o parámetro manteniendo marcha de la máquina."
  },
  {
    name: "Variación Ambiental (Humedad / Temperatura)",
    categoryName: "Condiciones Ambientales / Entorno",
    color: "#64748b",
    type: "observation",
    description: "Novedad climática o de entorno registrada por impacto potencial en el insumo."
  }
];

async function seed() {
  console.log('🚀 Iniciando script para agregar Categorías y Motivos de Observación...');
  
  // 1. Obtener categorías existentes
  const maintSnap = await getDocs(collection(db, 'maintenanceTypes'));
  const existingCategories = new Map();
  maintSnap.forEach(doc => {
    existingCategories.set(doc.data().name, doc.id);
  });

  // Crear categorías faltantes
  for (const cat of observationCategories) {
    if (!existingCategories.has(cat.name)) {
      const docRef = await addDoc(collection(db, 'maintenanceTypes'), cat);
      existingCategories.set(cat.name, docRef.id);
      console.log(`✅ Categoría creada: "${cat.name}" (ID: ${docRef.id})`);
    } else {
      console.log(`ℹ️ Categoría ya existente: "${cat.name}"`);
    }
  }

  // 2. Obtener motivos existentes
  const causeSnap = await getDocs(collection(db, 'stopCauses'));
  const existingCauses = new Set();
  causeSnap.forEach(doc => {
    existingCauses.add(doc.data().name);
  });

  // Crear motivos faltantes
  for (const cause of observationCauses) {
    if (!existingCauses.has(cause.name)) {
      const maintTypeId = existingCategories.get(cause.categoryName) || "";
      const newCauseData = {
        name: cause.name,
        color: cause.color,
        type: cause.type,
        maintenanceType: maintTypeId,
        description: cause.description
      };
      const docRef = await addDoc(collection(db, 'stopCauses'), newCauseData);
      console.log(`✅ Motivo de Observación creado: "${cause.name}" (ID: ${docRef.id})`);
    } else {
      console.log(`ℹ️ Motivo ya existente: "${cause.name}"`);
    }
  }

  console.log('🎉 Proceso completado exitosamente.');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Error ejecutando el script:', err);
  process.exit(1);
});
