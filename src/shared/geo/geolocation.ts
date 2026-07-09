import type { GeoPoint } from '../../app/types';

export const getCurrentPosition = (timeout = 12000): Promise<GeoPoint> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Posizione non disponibile su questo dispositivo.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        }),
      (error) => reject(new Error(error.message || 'Impossibile rilevare la posizione.')),
      { enableHighAccuracy: true, timeout, maximumAge: 15000 },
    );
  });
