import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isObservationEvent(
  stop?: { type?: string; reason?: string },
  causeConfig?: { type?: string }
): boolean {
  if (!stop) return false;
  if (stop.type === 'observation') return true;
  if (causeConfig?.type === 'observation') return true;
  if (!stop.reason) return false;

  const normalizedReason = stop.reason
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return (
    normalizedReason.includes('observacion') ||
    normalizedReason.includes('novedad') ||
    normalizedReason.includes('en marcha') ||
    normalizedReason.includes('sin parada') ||
    normalizedReason.includes('en operacion') ||
    normalizedReason.includes('en produccion')
  );
}
