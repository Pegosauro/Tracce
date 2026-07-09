import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, Category, Place } from '../../app/types';
import { createDefaultCategories } from '../../data/seedCategories';

type SettingsRecord = AppSettings & { id: 'settings' };

interface TracceDb extends DBSchema {
  places: {
    key: string;
    value: Place;
    indexes: { 'by-updatedAt': string; 'by-categoryId': string };
  };
  categories: {
    key: string;
    value: Category;
    indexes: { 'by-sortOrder': number };
  };
  settings: {
    key: string;
    value: SettingsRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<TracceDb>> | undefined;

export const getDb = () => {
  dbPromise ??= openDB<TracceDb>('tracce-db', 1, {
    upgrade(db) {
      const places = db.createObjectStore('places', { keyPath: 'id' });
      places.createIndex('by-updatedAt', 'updatedAt');
      places.createIndex('by-categoryId', 'categoryId');

      const categories = db.createObjectStore('categories', { keyPath: 'id' });
      categories.createIndex('by-sortOrder', 'sortOrder');

      db.createObjectStore('settings', { keyPath: 'id' });
    },
  });
  return dbPromise;
};

const makeDeviceId = () => {
  const existing = localStorage.getItem('tracce-device-id');
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem('tracce-device-id', id);
  return id;
};

export const ensureSeedData = async () => {
  const db = await getDb();
  const tx = db.transaction(['categories', 'settings'], 'readwrite');
  const categoryCount = await tx.objectStore('categories').count();
  if (categoryCount === 0) {
    await Promise.all(createDefaultCategories().map((category) => tx.objectStore('categories').put(category)));
  }

  const settings = await tx.objectStore('settings').get('settings');
  if (!settings) {
    await tx.objectStore('settings').put({
      id: 'settings',
      onboardingCompleted: false,
      gpsPermissionAsked: false,
      deviceId: makeDeviceId(),
      mapLastCenter: { latitude: 45.4642, longitude: 9.19, zoom: 13 },
    });
  }
  await tx.done;
};
