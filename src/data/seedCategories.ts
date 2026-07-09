import type { Category } from '../app/types';

const now = () => new Date().toISOString();

export const UNCATEGORIZED_ID = 'senza-categoria';
export const FAVORITES_CATEGORY_ID = 'preferiti';

export const createDefaultCategories = (): Category[] => {
  const createdAt = now();
  return [
    { id: 'parcheggi', name: 'Parcheggi', icon: 'car', color: '#0A84FF', sortOrder: 10, isDefault: true, createdAt, updatedAt: createdAt },
    { id: 'natura', name: 'Natura/Passeggiate', icon: 'tree', color: '#30B45D', sortOrder: 20, isDefault: true, createdAt, updatedAt: createdAt },
    { id: 'famiglia', name: 'Famiglia/Bambini', icon: 'heart', color: '#FF7A59', sortOrder: 30, isDefault: true, createdAt, updatedAt: createdAt },
    { id: 'cibo', name: 'Cibo', icon: 'utensils', color: '#FF9F0A', sortOrder: 40, isDefault: true, createdAt, updatedAt: createdAt },
    { id: 'servizi', name: 'Servizi utili', icon: 'wrench', color: '#6E6BE8', sortOrder: 50, isDefault: true, createdAt, updatedAt: createdAt },
    { id: UNCATEGORIZED_ID, name: 'Senza categoria', icon: 'pin', color: '#8E8E93', sortOrder: 60, isDefault: true, createdAt, updatedAt: createdAt },
    { id: FAVORITES_CATEGORY_ID, name: 'Preferiti', icon: 'star', color: '#FFD60A', sortOrder: 70, isDefault: true, createdAt, updatedAt: createdAt },
  ];
};
