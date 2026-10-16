// Global shift configuration

export const SHIFT_CONFIG = {
  day: {
    startHour: 7, // 07:00
    endHour: 18,  // 18:00
  },
  night: {
    startHour: 18, // 18:00
    endHour: 7,    // 07:00 (next day)
  }
};

// Types for shift configuration to be saved in documents
export interface ShiftTimeConfig {
  startHour: number;
  endHour: number;
}
