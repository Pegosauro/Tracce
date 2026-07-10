import { LocateFixed } from 'lucide-react';
import L, { type DivIcon, type Map as LeafletMap } from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Category, GeoPoint, Place } from '../../app/types';
import { isIncompletePlace } from '../../data/repositories/placeRepository';

type MapViewProps = {
  places: Place[];
  categories: Category[];
  currentPosition: GeoPoint | null;
  selectedPlaceId?: string;
  manualSelect: boolean;
  forcedUnavailable: boolean;
  onLocateUser: () => Promise<GeoPoint | null>;
  onOpenPlace: (place: Place) => void;
  onToggleFavorite: (place: Place) => void;
  onManualConfirm: (latitude: number, longitude: number) => void;
  onManualCancel: () => void;
  onMapUnavailable: (value: boolean) => void;
  onGoList: () => void;
};

const fallbackCenter: [number, number] = [45.4642, 9.19];
const minLiveUpdateMs = 3000;
const minLiveMoveMeters = 2;
const manualPickerIconUrl = `${import.meta.env.BASE_URL}icons/lascia-traccia.svg`;

const approximateDistanceMeters = (a: GeoPoint, b: GeoPoint) => {
  const latMeters = (b.latitude - a.latitude) * 111_320;
  const lngMeters = (b.longitude - a.longitude) * 111_320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(latMeters, lngMeters);
};

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

const makeUserLocationIcon = (): DivIcon =>
  L.divIcon({
    className: 'tracce-user-location-wrap',
    html: '<span class="tracce-user-location"></span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

export const MapView = ({
  places,
  categories,
  currentPosition,
  selectedPlaceId,
  manualSelect,
  forcedUnavailable,
  onLocateUser,
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
  const userMarkerRef = useRef<L.Marker | null>(null);
  const locateButtonRef = useRef<HTMLButtonElement | null>(null);
  const autoLocateClickDoneRef = useRef(false);
  const lastLivePositionRef = useRef<GeoPoint | null>(null);
  const lastLiveUpdateRef = useRef(0);
  const [livePosition, setLivePosition] = useState<GeoPoint | null>(currentPosition);
  const [zoom, setZoom] = useState(13);
  const [tileFailed, setTileFailed] = useState(false);
  const [userPositionOutOfView, setUserPositionOutOfView] = useState(false);
  const [locating, setLocating] = useState(false);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const unavailable = forcedUnavailable || tileFailed;
  const visibleUserPosition = livePosition ?? currentPosition;

  useEffect(() => {
    setLivePosition(currentPosition);
    lastLivePositionRef.current = currentPosition;
  }, [currentPosition]);

  useEffect(() => {
    if (!currentPosition || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const next: GeoPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        };
        const now = Date.now();
        const previous = lastLivePositionRef.current;
        const movedEnough = !previous || approximateDistanceMeters(previous, next) >= minLiveMoveMeters;
        const waitedEnough = now - lastLiveUpdateRef.current >= minLiveUpdateMs;
        const accuracyImproved = Boolean(previous?.accuracyMeters && next.accuracyMeters && next.accuracyMeters < previous.accuracyMeters);

        if (!movedEnough && !waitedEnough && !accuracyImproved) return;
        lastLiveUpdateRef.current = now;
        lastLivePositionRef.current = next;
        setLivePosition(next);
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [currentPosition]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || forcedUnavailable) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    }).setView(fallbackCenter, 13);

    L.control.attribution({ prefix: false, position: 'topleft' }).addTo(map);
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

    // Safari/iOS can change the visible viewport after Leaflet has measured it
    // (safe areas, address bar and orientation changes). Keep the tile grid in
    // sync so the map always reaches every edge of the screen.
    let resizeFrame = 0;
    const refreshMapSize = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => map.invalidateSize({ pan: false, debounceMoveend: true }));
    };
    const resizeObserver = new ResizeObserver(refreshMapSize);
    resizeObserver.observe(containerRef.current);
    window.visualViewport?.addEventListener('resize', refreshMapSize);
    window.addEventListener('orientationchange', refreshMapSize);
    window.setTimeout(refreshMapSize, 0);

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      window.visualViewport?.removeEventListener('resize', refreshMapSize);
      window.removeEventListener('orientationchange', refreshMapSize);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      userMarkerRef.current = null;
      locateButtonRef.current = null;
      autoLocateClickDoneRef.current = false;
    };
  }, [forcedUnavailable, onMapUnavailable]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !visibleUserPosition) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      setUserPositionOutOfView(false);
      return;
    }

    const latLng: [number, number] = [visibleUserPosition.latitude, visibleUserPosition.longitude];
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(latLng, {
        icon: makeUserLocationIcon(),
        interactive: false,
        keyboard: false,
        zIndexOffset: 900,
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng(latLng);
    }

    const updateUserVisibility = () => {
      setUserPositionOutOfView(!map.getBounds().pad(-0.04).contains(latLng));
    };

    updateUserVisibility();
    map.on('moveend zoomend resize', updateUserVisibility);
    return () => {
      map.off('moveend zoomend resize', updateUserVisibility);
    };
  }, [visibleUserPosition]);

  useEffect(() => {
    if (!visibleUserPosition || !userPositionOutOfView || manualSelect || autoLocateClickDoneRef.current) return;

    const timer = window.setTimeout(() => {
      const button = locateButtonRef.current;
      if (!button || button.disabled) return;
      autoLocateClickDoneRef.current = true;
      button.click();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [manualSelect, userPositionOutOfView, visibleUserPosition]);

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

  const showUserLocation = async () => {
    setLocating(true);
    const point = await onLocateUser();
    if (point && mapRef.current) {
      setLivePosition(point);
      mapRef.current.flyTo([point.latitude, point.longitude], Math.max(16, mapRef.current.getZoom()), { duration: 0.45 });
      setUserPositionOutOfView(false);
    }
    setLocating(false);
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
      {visibleUserPosition && userPositionOutOfView && !manualSelect && (
        <button
          ref={locateButtonRef}
          className={`floating locate-user ${locating ? 'is-locating' : ''}`}
          onClick={showUserLocation}
          aria-label="Mostra la mia posizione"
          disabled={locating}
        >
          <LocateFixed size={22} />
        </button>
      )}
      {manualSelect && (
        <div className="manual-picker" aria-live="polite">
          <img className="center-pin" src={manualPickerIconUrl} alt="" aria-hidden="true" />
          <button className="round-control cancel" onClick={onManualCancel} aria-label="Annulla scelta posizione">×</button>
          <button className="round-control confirm" onClick={confirmManual} aria-label="Conferma posizione">✓</button>
        </div>
      )}
    </div>
  );
};
