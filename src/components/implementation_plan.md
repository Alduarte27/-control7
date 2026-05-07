# Simulador de Turnos Reales y Horarios de Pausa

Este plan detalla cómo transformaremos la simulación continua actual en un simulador basado en turnos reales (Día/Noche) con reloj virtual y gestión de descansos.

## User Review Required

> [!IMPORTANT]
> Revisa la lógica de las pausas (almuerzo, merienda, desayuno). Durante estas pausas, el reloj virtual seguirá avanzando rápido, pero **las máquinas de empaque no producirán ni consumirán material**. Los silos y centrífugas, por defecto, también asumiremos que se detienen. Si necesitas que ciertas áreas (como cocimiento) sigan trabajando en el almuerzo, házmelo saber.

## Open Questions

> [!NOTE]
> 1. **Comportamiento en Pausa:** Durante el almuerzo/desayuno, ¿Se detiene el 100% de la planta (incluyendo Tachos y Centrífugas) o solo el área de Empaque? El plan actual asume detener el 100% para simplificar.
> 2. **Configuración de Horas:** ¿Deseas que las horas de inicio y fin de las pausas sean editables por el usuario en la pantalla, o prefieres que estén fijas (ej. 12:00 a 13:00)? El plan propone campos editables tipo "reloj".

## Proposed Changes

### Componente Principal

#### [MODIFY] `src/components/ia-client.tsx`

1. **Actualización del Estado de Configuración (`SimulationConfig`)**:
   - Agregar `shiftType: 'day' | 'night'`.
   - Reemplazar el slider manual de `targetShiftHours` por un valor derivado del turno (11h para Día, 13h para Noche).
   - Agregar configuraciones de pausas con hora de inicio y fin:
     - `dayLunchBreak: { start: string, end: string, enabled: boolean }`
     - `nightDinnerBreak: { start: string, end: string, enabled: boolean }`
     - `nightBreakfastBreak: { start: string, end: string, enabled: boolean }`

2. **Lógica del Reloj Virtual (`virtualTime`)**:
   - Convertir `elapsedTime` (segundos) en hora real basada en el turno. 
   - Turno Día empieza a las 07:00 (`25200` segundos desde la medianoche).
   - Turno Noche empieza a las 18:00 (`64800` segundos desde la medianoche).
   - Crear una función para verificar si la "hora virtual actual" cae dentro de algún rango de pausa habilitado.

3. **Modificación del Bucle de Simulación (`useEffect` o `interval`)**:
   - Si la hora virtual entra en una "Pausa Activa" (ej. Almuerzo):
     - El reloj sigue corriendo acelerado, pero la producción de las envasadoras y flujo de azúcar se multiplica por `0`.
     - Mostrar un letrero grande tipo **"ALMUERZO - PLANTA PAUSADA"**.
   - Si el reloj llega al final del turno (`elapsedTime >= targetShiftHours * 3600`):
     - Detener la simulación automáticamente (`setIsSimulating(false)`).
     - Levantar el nuevo modal de `ShiftReportDialog`.

4. **Interfaz de Usuario (Panel Superior)**:
   - Añadir un gran Reloj Digital que muestre la hora simulada actual (ej: `10:45 AM ☀️`).
   - Añadir un panel de control rápido para seleccionar Turno y configurar los horarios de comida justo arriba o al lado de los botones de Iniciar/Detener.

5. **Nuevo Sub-Componente: `ShiftReportModal`**:
   - Un cuadro de diálogo que salta automáticamente al terminar el turno.
   - Mostrará: Tipo de turno, Total Producido, Tiempo total de paradas y opción de limpiar para arrancar el próximo turno.

## Verification Plan

### Manual Verification
- Iniciar Turno Día, fijar acelerador alto y verificar que el reloj digital empiece a las 07:00 AM.
- Verificar que al llegar a la hora de almuerzo configurada, la producción se detenga temporalmente.
- Verificar que a las 18:00 la simulación termine automáticamente y salte el reporte.
- Repetir prueba con Turno Noche (18:00 a 07:00) verificando el salto de día (medianoche) y las pausas de cena/desayuno.
