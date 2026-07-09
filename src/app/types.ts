export type PlacePhoto = {
  id: string;
  placeId: string;
  blob: Blob;
  mimeType: 'image/webp' | string;
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
};

export type Place = {
  id: string;
  syncId?: string;
  name?: string;
  categoryId: string;
  tags: string[];
  notes?: string;
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  lowAccuracy?: boolean;
  createdManually?: boolean;
  positionAdjusted?: boolean;
  isFavorite: boolean;
  photos: PlacePhoto[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deviceId: string;
};

export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  sortOrder: number;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AppSettings = {
  onboardingCompleted: boolean;
  gpsPermissionAsked: boolean;
  deviceId: string;
  mapLastCenter?: { latitude: number; longitude: number; zoom: number };
};

export type Filters = {
  query: string;
  categoryIds: string[];
  tags: string[];
  favoritesOnly: boolean;
  incompleteOnly: boolean;
};

export type Section = 'map' | 'list' | 'nearby' | 'settings';

export type GeoPoint = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
};
