const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyB0Mv7wdCkz-lMBARnKi3ZNlKZFdM4Any4",
  authDomain: "control-7-61a3f.firebaseapp.com",
  projectId: "control-7-61a3f",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const descriptions = {
  "Mantenimiento No Planificado / Preventivo": "Son paradas que no estaban en el calendario (no planificadas), pero que se hacen para evitar un daño mayor (preventivas). Suele ocurrir cuando el operador o el técnico nota que algo 'suena raro' o no va bien, y deciden detener la máquina antes de que se rompa del todo.",
  "Mantenimiento Planificado / Correctivo": "Fallos que ya ocurrieron o piezas desgastadas, pero que permitían operar, por lo que se programó su reparación para no afectar la producción.",
  "Mantenimiento Autónomo": "Mantenimiento básico (limpieza, lubricación, ajustes menores) realizado por los propios operadores para prevenir el deterioro del equipo.",
  "Mantenimiento Planificado / Preventivo": "Intervenciones programadas rutinarias basadas en tiempo o uso para mantener la confiabilidad del equipo.",
  "Mantenimiento No Planificado / Correctivo": "Parada inesperada por rotura, fallo total o emergencia que detiene la producción y requiere acción inmediata.",
  "Producción Normal": "Actividades regulares que son parte del proceso productivo, como ajustes de rutina o cambios previstos.",
  "Calidad": "Interrupciones debidas a inspecciones, rechazos, retrabajo o validaciones de calidad.",
  "Paradas logística / Suministro": "Detenciones causadas por falta de materiales, espera de montacargas o problemas de abastecimiento externo al área.",
  "Factor Humano / Administrativo": "Tiempos inactivos por falta de personal, reuniones, capacitaciones o pausas administrativas.",
  "Servicos Generales": "Fallas externas a la máquina como cortes de energía eléctrica, falta de aire comprimido o agua.",

  "Inspección por ruido anormal / vibración": "Detener la máquina para revisar un sonido extraño o vibración inusual antes de que se genere una falla mayor.",
  "Lubricación de emergencia": "Detención rápida para aplicar grasa o aceite debido a un secamiento repentino detectado durante la operación.",
  "Ajuste de tensión (cadenas/bandas)": "Pausa breve para tensar una banda o cadena que se aflojó repentinamente para evitar que salte o se rompa.",
  "Fuga menor (aire/aceite)": "Fuga incipiente detectada que se corrige rápidamente para evitar perder presión o contaminar el producto.",
  "Reemplazo de pieza desgastada": "Cambio de una pieza (rodamiento, cuchilla, sello) que ya estaba al límite de su vida útil. Reparación programada.",
  "Corrección de falla menor postergada": "Reparación de un sensor o mecanismo secundario que fallaba pero no impedía producir, reparado en tiempo programado.",
  "Cambio de repuesto programado": "Instalación de un repuesto que llegó del proveedor o almacén, cuya colocación estaba prevista.",
  "Overhaul / Reparación mayor": "Reconstrucción o mantenimiento profundo de un componente importante ya planificado en el cronograma anual.",
  
  "Electronico": "Falla imprevista en componentes electrónicos, PLCs, pantallas o sensores.",
  "Accidente Laboral": "Parada obligatoria por incidente de seguridad, primeros auxilios o evaluación de riesgos.",
  "Espera de Montacargas": "El área está detenida esperando abastecimiento o retiro de producto terminado.",
  "Cambio rollo": "Reemplazo del rollo de material o bobina como parte del proceso continuo.",
  "Retrabajo": "Tiempo dedicado a corregir producto que no cumplió los estándares a la primera.",
  "Falla de Aire Comprimido": "Corte en el suministro general de aire afectando los sistemas neumáticos.",
  "Gestión Mantenimiento": "Revisión rutinaria programada.",
  "Envio de Granel": "Espera de suministro de granel o materia prima desde otra área.",
  "Limpieza": "Limpieza rutinaria de la máquina o área de trabajo por el operador.",
  "Alimentacion": "Pausa para alimentación de la línea de producción o descanso del personal (si aplica).",
  "Cambio rollo Enfardadora": "Cambio rutinario del rollo de plástico en el equipo de enfardado.",
  "Bodega sin espacio": "Imposibilidad de producir porque no hay dónde colocar el producto terminado.",
  "Operación": "Ajustes propios del arranque o seteo de máquina.",
  "Bajo Nivel": "Tolva o tanque de suministro con nivel insuficiente para continuar operando.",
  "Materia prima defectuosa / Empaque defectuoso": "Paro por material que traba la máquina o no sella/cierra correctamente.",
  "Mecanico": "Falla mecánica inesperada: engranes, flechas, soportes rotos o trabados.",
  "Atasco de material": "El material se enganchó o trabó en la máquina y debe ser retirado manualmente.",
  "Electrico": "Cortocircuito, motor quemado o fallo eléctrico repentino.",
  "Electroneumatico": "Fallo en válvulas o actuadores que combinan señal eléctrica y fuerza neumática.",
  "Falta de Material": "Falta absoluta de insumos para producir.",
  "Reunión / Cambio de turno": "Parada administrativa programada para empalme o charla de 5 minutos.",
  "Ajustes de parámetros / Calibración": "Modificación fina en la HMI o sensores para asegurar el peso o tamaño correcto.",
  "Neumático": "Fuga severa, manguera rota o pistón neumático atascado.",
  "Falta de personal": "No se puede operar la máquina porque el operador asignado no está o falta ayuda.",
  "Falta de Energía Eléctrica": "Corte o apagón general en la planta.",
  "Cambio presentacion": "Cambio de formato o producto en la línea (Set-up / Changeover).",
  "Preparacion para aranque": "Tiempo previo de alistamiento y calentamiento de la máquina antes de empezar a producir."
};

async function run() {
  const m = await getDocs(collection(db, 'maintenanceTypes'));
  for (const docSnapshot of m.docs) {
    const data = docSnapshot.data();
    if (descriptions[data.name]) {
      await updateDoc(doc(db, 'maintenanceTypes', docSnapshot.id), { description: descriptions[data.name] });
      console.log('Updated MT:', data.name);
    }
  }

  const c = await getDocs(collection(db, 'stopCauses'));
  for (const docSnapshot of c.docs) {
    const data = docSnapshot.data();
    if (descriptions[data.name]) {
      await updateDoc(doc(db, 'stopCauses', docSnapshot.id), { description: descriptions[data.name] });
      console.log('Updated C:', data.name);
    }
  }
}
run().catch(console.error);
