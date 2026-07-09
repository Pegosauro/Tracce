import type { Category } from '../../app/types';
import { getDb } from '../../shared/storage/db';
import { UNCATEGORIZED_ID } from '../seedCategories';
import { placeRepository } from './placeRepository';

export const categoryRepository = {
  async list(): Promise<Category[]> {
    const categories = await (await getDb()).getAllFromIndex('categories', 'by-sortOrder');
    return categories.sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async save(category: Category) {
    await (await getDb()).put('categories', { ...category, updatedAt: new Date().toISOString() });
  },

  async remove(categoryId: string) {
    if (categoryId === UNCATEGORIZED_ID) return;
    const db = await getDb();
    await db.delete('categories', categoryId);
    const places = await placeRepository.listAll();
    await Promise.all(
      places
        .filter((place) => place.categoryId === categoryId)
        .map((place) => placeRepository.save({ ...place, categoryId: UNCATEGORIZED_ID })),
    );
  },
};
