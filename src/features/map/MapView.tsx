import L, { type DivIcon, type Map as LeafletMap } from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Category, Place } from '../../app/types';
import { isIncompletePlace } from '../../data/repositories/placeRepository';

type MapViewProps = {
  places: Place[];
  categories: Category[];
  selectedPlaceId?: string;
  manualSelect: boolean;
  forcedUnavailable: boolean;
  onOpenPlace: (place: Place) => void;
  onToggleFavorite: (place: Place) => void;
  onManualConfirm: (latitude: number, longitude: number) => void;
  onManualCancel: () => void;
  onMapUnavailable: (value: boolean) => void;
  onGoList: () => void;
};

const fallbackCenter: [number, number] = [45.4642, 9.19];

const makeIcon = (category: Category | undefined, place?: Place): DivIcon => {
  const color = place?.isFavorite ? '#FFD60A' : category?.color ?? '#08A88A';
  const incomplete = place ? isIncompletePlace(place) : false;
  return L.divIcon({
    className: 'tracce-marker-wrap',
    html: `<span class="tracce-marker ${incomplete ? 'is-incomplete' : ''}" style="--marker:${color}">${category?.icon === 'star' ? '★' : ''}</span>`,
    iconSize: [34, 42],
    iconAnchor: [17, 36],
    popupAnchor: [0, -28],
  });
};

const makeClusterIcon = (count: number): DivIcon =>
  L.divIcon({
    className: 'tracce-cluster-wrap',
    html: `<span class="tracce-cluster">${count}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

export const MapView = ({
  places,
  categories,
  selectedPlaceId,
  manualSelect,
  forcedUnavailable,
  onOpenPlace,
  onToggleFavorite,
  onManualConfirm,
  onManualCancel,
  onMapUnavailable,
  onGoList,
}: MapViewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [zoom, setZoom] = useState(13);
  const [tileFailed, setTileFailed] = useState(false);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const unavailable = forcedUnavailable || tileFailed;

  useEffect(() => {
    if (!containerRef.current || mapRef.current || forcedUnavailable) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    }).setView(fallbackCenter, 13);

    L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    })
      .on('tileerror', () => {
        setTileFailed(true);
        onMapUnavailable(true);
      })
      .addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    map.on('zoomend', () => setZoom(map.getZoom()));

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [forcedUnavailable, onMapUnavailable]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    if (places.length === 0) return;

    if (zoom < 12 && places.length > 1) {
      const lat = places.reduce((sum, place) => sum + place.latitude, 0) / places.length;
      const lng = places.reduce((sum, place) => sum + place.longitude, 0) / places.length;
      L.marker([lat, lng], { icon: makeClusterIcon(places.length) }).addTo(layer);
      return;
    }

    places.forEach((place) => {
      const category = categoryById.get(place.categoryId);
      const marker = L.marker([place.latitude, place.longitude], { icon: makeIcon(category, place) }).addTo(layer);
      const label = place.isFavorite || zoom >= 15 ? `<b>${place.name?.trim() || 'Luogo senza nome'}</b><br/>` : '';
      marker.bindPopup(
        `<div class="map-popup">${label}<span>${category?.name ?? 'Senza categoria'}</span><div><button data-action="open">Apri scheda</button><button data-action="maps">Maps</button><button data-action="favorite">${place.isFavorite ? 'Togli preferito' : 'Preferito'}</button></div></div>`,
      );
      marker.on('popupopen', (event) => {
        const popup = event.popup.getElement();
        popup?.querySelector('[data-action="open"]')?.addEventListener('click', () => onOpenPlace(place));
        popup?.querySelector('[data-action="maps"]')?.addEventListener('click', () => {
          window.open(`https://maps.google.com/?q=${place.latitude},${place.longitude}`, '_blank', 'noopener,noreferrer');
        });
        popup?.querySelector('[data-action="favorite"]')?.addEventListener('click', () => onToggleFavorite(place));
      });
    });
  }, [categoryById, onOpenPlace, onToggleFavorite, places, zoom]);

  useEffect(() => {
    const selected = places.find((place) => place.id === selectedPlaceId);
    if (selected && mapRef.current) mapRef.current.flyTo([selected.latitude, selected.longitude], Math.max(15, zoom), { duration: 0.45 });
  }, [places, selectedPlaceId, zoom]);

  const confirmManual = () => {
    const center = mapRef.current?.getCenter();
    if (center) onManualConfirm(center.lat, center.lng);
  };

  if (unavailable) {
    return (
      <section className="map-unavailable">
        <div>
          <h2>Mappa non disponibile</h2>
          <p>La mappa richiede una connessione internet.</p>
          <div className="map-unavailable-actions">
            <button onClick={() => window.location.reload()}>Riprova</button>
            <button onClick={onGoList}>Vai all'elenco</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="map-stage">
      <div ref={containerRef} className="leaflet-host" />
      {manualSelect && (
        <div className="manual-picker" aria-live="polite">
          <div className="center-pin" />
          <button className="round-control cancel" onClick={onManualCancel} aria-label="Annulla scelta posizione">×</button>
          <button className="round-control confirm" onClick={confirmManual} aria-label="Conferma posizione">✓</button>
        </div>
      )}
    </div>
  );
};
