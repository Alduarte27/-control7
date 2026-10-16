const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyB0Mv7wdCkz-lMBARnKi3ZNlKZFdM4Any4",
  authDomain: "control-7-61a3f.firebaseapp.com",
  projectId: "control-7-61a3f",
  storageBucket: "control-7-61a3f.firebasestorage.app",
  messagingSenderId: "246236490186",
  appId: "1:246236490186:web:57214e96476c5ec3220733"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const mapping = {
  'Electronico': 'Mantenimiento No Planificado / Correctivo',
  'Accidente Laboral': 'Factor Humano / Administrativo',
  'Espera de Montacargas': 'Paradas logística / Suministro',
  'Cambio rollo': 'Producción Normal',
  'Retrabajo': 'Calidad',
  'Falla de Aire Comprimido': 'Servicos Generales',
  'Gestión Mantenimiento': 'Mantenimiento Planificado / Preventivo',
  'Envio de Granel': 'Paradas logística / Suministro',
  'Limpieza': 'Mantenimiento Autónomo',
  'Alimentacion': 'Producción Normal',
  'Cambio rollo Enfardadora': 'Producción Normal',
  'Bodega sin espacio': 'Paradas logística / Suministro',
  'Operación': 'Producción Normal',
  'Bajo Nivel': 'Paradas logística / Suministro',
  'Materia prima defectuosa / Empaque defectuoso': 'Calidad',
  'Mecanico': 'Mantenimiento No Planificado / Correctivo',
  'Atasco de material': 'Producción Normal',
  'Electrico': 'Mantenimiento No Planificado / Correctivo',
  'Electroneumatico': 'Mantenimiento No Planificado / Correctivo',
  'Falta de Material': 'Paradas logística / Suministro',
  'Reunión / Cambio de turno': 'Factor Humano / Administrativo',
  'Ajustes de parámetros / Calibración': 'Mantenimiento Autónomo',
  'Neumático': 'Mantenimiento No Planificado / Correctivo',
  'Falta de personal': 'Factor Humano / Administrativo',
  'Falta de Energía Eléctrica': 'Servicos Generales',
  'Cambio presentacion': 'Producción Normal',
  'Preparacion para aranque': 'Producción Normal'
};

const typeMapping = {
  'Electronico': 'unplanned',
  'Electrico': 'unplanned',
  'Mecanico': 'unplanned',
  'Electroneumatico': 'unplanned',
  'Neumático': 'unplanned',
  'Atasco de material': 'unplanned'
};

async function run() {
  console.log('Fetching maintenance types...');
  const maintSnapshot = await getDocs(collection(db, 'maintenanceTypes'));
  const maintMap = {};
  maintSnapshot.forEach(doc => {
    maintMap[doc.data().name] = doc.id;
  });
  console.log('Maintenance categories found:', Object.keys(maintMap).length);

  console.log('Fetching causes...');
  const causesSnapshot = await getDocs(collection(db, 'stopCauses'));
  let updated = 0;
  
  for (const docSnapshot of causesSnapshot.docs) {
    const data = docSnapshot.data();
    const name = data.name;
    const targetMaintName = mapping[name];
    let needsUpdate = false;
    let updates = {};
    
    if (targetMaintName && maintMap[targetMaintName]) {
      if (data.maintenanceType !== maintMap[targetMaintName]) {
        updates.maintenanceType = maintMap[targetMaintName];
        needsUpdate = true;
      }
    }
    
    // Some types are missing completely
    if (!data.type && typeMapping[name]) {
        updates.type = typeMapping[name];
        needsUpdate = true;
    } else if (!data.type) {
        updates.type = 'planned'; // Default
        needsUpdate = true;
    }

    if (needsUpdate) {
      console.log(`Updating ${name}...`, updates);
      await updateDoc(doc(db, 'stopCauses', docSnapshot.id), updates);
      updated++;
    }
  }
  console.log(`Finished. Updated ${updated} causes.`);
}

run().catch(console.error);
