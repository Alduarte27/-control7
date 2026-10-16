const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Iniciar app de Firebase Admin
// Asegúrate de tener GOOGLE_APPLICATION_CREDENTIALS configurado en tu entorno,
// o inicializa admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (error) {
    console.error('Error al inicializar Firebase Admin. Asegúrate de configurar GOOGLE_APPLICATION_CREDENTIALS o proveer las credenciales (Service Account).', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

// Colecciones principales a respaldar
const COLLECTIONS_TO_BACKUP = [
  'dailyLogs',
  'categories',
  'products',
  'supervisors',
  'operators',
  'packagingMaterials',
  'stopCauses',
  'suppliers',
  'melazaSuppliers',
  'productionPlans'
];

async function backup() {
  const backupDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = path.join(backupDir, `backup-${timestamp}.json`);
  
  console.log(`Iniciando backup en ${backupFileName}...`);
  const backupData = {};

  try {
    for (const collectionName of COLLECTIONS_TO_BACKUP) {
      console.log(`Exportando colección: ${collectionName}...`);
      const snapshot = await db.collection(collectionName).get();
      backupData[collectionName] = {};
      
      snapshot.forEach(doc => {
        backupData[collectionName][doc.id] = doc.data();
      });
      console.log(`- ${snapshot.size} documentos exportados.`);
    }

    fs.writeFileSync(backupFileName, JSON.stringify(backupData, null, 2));
    console.log(`✅ Backup completado exitosamente: ${backupFileName}`);
    
  } catch (error) {
    console.error('❌ Error durante el backup:', error);
  }
}

backup();
