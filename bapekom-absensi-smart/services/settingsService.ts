import { SystemSettings } from '../types';

const SETTINGS_KEY = 'bapekom_settings';

// Default settings (Bapekom Wilayah VIII Makassar approx)
const DEFAULT_SETTINGS: SystemSettings = {
  officeLat: -5.1597000997736,
  officeLng: 119.40979746499184,
  maxDistanceMeters: 500,
  lateThreshold: '07:40',
  clockOutTimeMonThu: '16:00',
  clockOutTimeFri: '16:30'
};

export const getSettings = (): SystemSettings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  }
  
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
  return DEFAULT_SETTINGS;
};

export const saveSettings = (settings: SystemSettings): boolean => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    console.error("Failed to save settings", e);
    return false;
  }
};