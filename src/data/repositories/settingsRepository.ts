import type { AppSettings } from '../../app/types';
import { getDb } from '../../shared/storage/db';

type SettingsRecord = AppSettings & { id: 'settings' };

export const settingsRepository = {
  async get(): Promise<AppSettings> {
    const record = await (await getDb()).get('settings', 'settings');
    if (!record) throw new Error('Settings not initialized');
    const { id: _id, ...settings } = record;
    return settings;
  },

  async update(patch: Partial<AppSettings>) {
    const db = await getDb();
    const existing = await db.get('settings', 'settings');
    if (!existing) throw new Error('Settings not initialized');
    const next: SettingsRecord = { ...existing, ...patch, id: 'settings' };
    await db.put('settings', next);
    const { id: _id, ...settings } = next;
    return settings;
  },
};
