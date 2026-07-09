import type { Filters, Place } from '../../app/types';
import { getDb } from '../../shared/storage/db';
import { UNCATEGORIZED_ID } from '../seedCategories';

export const isIncompletePlace = (place: Place) => !place.name?.trim() || place.categoryId === UNCATEGORIZED_ID;

const matchesQuery = (place: Place, query: string, categoryName: string) => {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return [place.name, place.notes, categoryName, ...place.tags].filter(Boolean).some((value) => value!.toLowerCase().includes(q));
};

export const placeRepository = {
  async listAll(): Promise<Place[]> {
    const places = await (await getDb()).getAll('places');
    return places.filter((place) => !place.deletedAt);
  },

  async get(id: string) {
    const place = await (await getDb()).get('places', id);
    return place && !place.deletedAt ? place : undefined;
  },

  async save(place: Place) {
    const now = new Date().toISOString();
    await (await getDb()).put('places', { ...place, updatedAt: now });
  },

  async softDelete(id: string) {
    const db = await getDb();
    const place = await db.get('places', id);
    if (!place) return;
    const now = new Date().toISOString();
    await db.put('places', { ...place, deletedAt: now, updatedAt: now });
  },

  async filter(filters: Filters, categoryNames: Map<string, string>): Promise<Place[]> {
    const places = await this.listAll();
    return places.filter((place) => {
      if (filters.categoryIds.length && !filters.categoryIds.includes(place.categoryId)) return false;
      if (filters.tags.length && !filters.tags.every((tag) => place.tags.includes(tag))) return false;
      if (filters.favoritesOnly && !place.isFavorite) return false;
      if (filters.incompleteOnly && !isIncompletePlace(place)) return false;
      return matchesQuery(place, filters.query, categoryNames.get(place.categoryId) ?? '');
    });
  },
};
