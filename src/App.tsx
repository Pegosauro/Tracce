import {
  Camera,
  Check,
  ChevronUp,
  Ellipsis,
  Filter,
  Info,
  List,
  LocateFixed,
  MapPinned,
  MapPin,
  Menu,
  Navigation,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Settings,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppSettings, Category, Filters, GeoPoint, Place, PlacePhoto, Section } from './app/types';
import { categoryRepository } from './data/repositories/categoryRepository';
import { isIncompletePlace, placeRepository } from './data/repositories/placeRepository';
import { settingsRepository } from './data/repositories/settingsRepository';
import { UNCATEGORIZED_ID } from './data/seedCategories';
import { MapView } from './features/map/MapView';
import { Onboarding } from './features/onboarding/Onboarding';
import { getCurrentPosition } from './shared/geo/geolocation';
import { ensureSeedData } from './shared/storage/db';
import { distanceMeters, formatDistance } from './shared/utils/distance';
import { compressPhoto } from './shared/utils/photo';

const emptyFilters: Filters = { query: '', categoryIds: [], tags: [], favoritesOnly: false, incompleteOnly: false };

type DraftPlace = {
  point: GeoPoint;
  name: string;
  categoryId: string;
  createdManually?: boolean;
  positionAdjusted?: boolean;
};

type ManualMode = { kind: 'new' } | { kind: 'draft' } | { kind: 'edit'; placeId: string } | null;

const sectionMeta: Array<{ id: Section; label: string; Icon: typeof MapPinned }> = [
  { id: 'map', label: 'Mappa', Icon: MapPinned },
  { id: 'list', label: 'Elenco', Icon: List },
  { id: 'nearby', label: 'Vicini', Icon: Navigation },
  { id: 'settings', label: 'Impostazioni', Icon: Settings },
];

const nowIso = () => new Date().toISOString();

const parseTags = (value: string) =>
  value
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

const categoryLabel = (categories: Category[], id: string) => categories.find((category) => category.id === id)?.name ?? 'Senza categoria';

export const App = () => {
  const [booting, setBooting] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [activeSection, setActiveSection] = useState<Section>('map');
  const [menuOpen, setMenuOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>();
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftPlace | null>(null);
  const [manualMode, setManualMode] = useState<ManualMode>(null);
  const [currentPosition, setCurrentPosition] = useState<GeoPoint | null>(null);
  const autoLocateStartedRef = useRef(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [forceMapUnavailable, setForceMapUnavailable] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);

  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const filteredPlaces = useMemo(() => {
    return places
      .filter((place) => {
        const query = filters.query.trim().toLowerCase();
        const text = [place.name, place.notes, categoryNames.get(place.categoryId), ...place.tags].filter(Boolean).join(' ').toLowerCase();
        if (query && !text.includes(query)) return false;
        if (filters.categoryIds.length && !filters.categoryIds.includes(place.categoryId)) return false;
        if (filters.tags.length && !filters.tags.every((tag) => place.tags.includes(tag))) return false;
        if (filters.favoritesOnly && !place.isFavorite) return false;
        if (filters.incompleteOnly && !isIncompletePlace(place)) return false;
        return true;
      })
      .sort((a, b) => (a.name || 'Luogo senza nome').localeCompare(b.name || 'Luogo senza nome', 'it'));
  }, [categoryNames, filters, places]);

  const allTags = useMemo(() => Array.from(new Set(places.flatMap((place) => place.tags))).sort(), [places]);
  const selectedPlace = places.find((place) => place.id === selectedPlaceId);
  const deviceId = settings?.deviceId ?? 'local-device';

  const refresh = async () => {
    const [nextSettings, nextCategories, nextPlaces] = await Promise.all([
      settingsRepository.get(),
      categoryRepository.list(),
      placeRepository.listAll(),
    ]);
    setSettings(nextSettings);
    setCategories(nextCategories);
    setPlaces(nextPlaces);
  };

  useEffect(() => {
    ensureSeedData()
      .then(refresh)
      .finally(() => setBooting(false));
  }, []);

  const completeOnboarding = async (gpsAsked: boolean, point?: GeoPoint) => {
    const next = await settingsRepository.update({ onboardingCompleted: true, gpsPermissionAsked: gpsAsked });
    setSettings(next);
    if (point) setCurrentPosition(point);
  };

  const locateCurrentPosition = useCallback(async (options?: { focusMap?: boolean }) => {
    try {
      setNotice('Rilevo la posizione...');
      const point = await getCurrentPosition();
      setCurrentPosition(point);
      if (options?.focusMap !== false) setActiveSection('map');
      setNotice(null);
      return point;
    } catch {
      setNotice('Posizione attuale non disponibile.');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!settings?.onboardingCompleted || autoLocateStartedRef.current) return;
    autoLocateStartedRef.current = true;
    void locateCurrentPosition({ focusMap: false });
  }, [locateCurrentPosition, settings?.onboardingCompleted]);

  const checkForAppUpdate = useCallback(async () => {
    try {
      const checkUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
      checkUrl.searchParams.set('update-check', Date.now().toString());

      const response = await fetch(checkUrl.toString(), { cache: 'no-store' });
      if (!response.ok) return;

      const latestDocument = new DOMParser().parseFromString(await response.text(), 'text/html');
      const latestScriptPath = latestDocument.querySelector<HTMLScriptElement>('script[type="module"][src]')?.getAttribute('src');
      const activeScript = Array.from(document.scripts).find((script) => script.type === 'module' && script.src.includes('/assets/index-'));
      if (!latestScriptPath || !activeScript) return;

      const latestScriptUrl = new URL(latestScriptPath, response.url).href;
      if (latestScriptUrl !== activeScript.src) setUpdateAvailable(true);
    } catch {
      // A network error simply postpones the next update check.
    }
  }, []);

  useEffect(() => {
    void checkForAppUpdate();
    const intervalId = window.setInterval(checkForAppUpdate, 5 * 60 * 1000);
    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') void checkForAppUpdate();
    };
    document.addEventListener('visibilitychange', checkWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, [checkForAppUpdate]);

  const startTrace = async () => {
    try {
      setNotice('Rilevo la posizione...');
      const point = await getCurrentPosition();
      setCurrentPosition(point);
      setDraft({ point, name: '', categoryId: UNCATEGORIZED_ID });
      setNotice(point.accuracyMeters && point.accuracyMeters > 30 ? 'Precisione GPS bassa, puoi salvare o correggere la posizione.' : null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'GPS non disponibile.');
      if (!mapUnavailable && !forceMapUnavailable) setManualMode({ kind: 'new' });
    }
  };

  const chooseOnMap = () => {
    if (mapUnavailable || forceMapUnavailable) {
      setNotice('La scelta manuale richiede la mappa disponibile.');
      return;
    }
    setDraft(null);
    setMenuOpen(false);
    setManualMode({ kind: 'draft' });
    setActiveSection('map');
  };

  const saveDraft = async () => {
    if (!draft || !settings) return;
    const timestamp = nowIso();
    const place: Place = {
      id: crypto.randomUUID(),
      name: draft.name.trim() || undefined,
      categoryId: draft.categoryId,
      tags: [],
      latitude: draft.point.latitude,
      longitude: draft.point.longitude,
      accuracyMeters: draft.point.accuracyMeters,
      lowAccuracy: Boolean(draft.point.accuracyMeters && draft.point.accuracyMeters > 30),
      createdManually: draft.createdManually,
      positionAdjusted: draft.positionAdjusted,
      isFavorite: false,
      photos: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      deviceId,
    };
    await placeRepository.save(place);
    await refresh();
    setDraft(null);
    setSelectedPlaceId(place.id);
    setDetailExpanded(true);
    setActiveSection('map');
  };

  const updatePlace = async (place: Place) => {
    await placeRepository.save(place);
    await refresh();
    setSelectedPlaceId(place.id);
  };

  const toggleFavorite = (place: Place) => updatePlace({ ...place, isFavorite: !place.isFavorite });

  const handleManualConfirm = async (latitude: number, longitude: number) => {
    if (!manualMode) return;
    if (manualMode.kind === 'edit') {
      const place = places.find((item) => item.id === manualMode.placeId);
      if (place) await updatePlace({ ...place, latitude, longitude, positionAdjusted: true });
      setManualMode(null);
      return;
    }
    const point: GeoPoint = { latitude, longitude, accuracyMeters: currentPosition?.accuracyMeters };
    setDraft({ point, name: '', categoryId: UNCATEGORIZED_ID, createdManually: true, positionAdjusted: manualMode.kind === 'draft' });
    setManualMode(null);
  };

  const addPhoto = async (place: Place, file: File) => {
    if (place.photos.length >= 5) {
      setNotice('Puoi aggiungere al massimo 5 foto per luogo.');
      return;
    }
    const compressed = await compressPhoto(file);
    const photo: PlacePhoto = {
      id: crypto.randomUUID(),
      placeId: place.id,
      blob: compressed.blob,
      mimeType: compressed.mimeType,
      width: compressed.width,
      height: compressed.height,
      sizeBytes: compressed.sizeBytes,
      createdAt: nowIso(),
    };
    await updatePlace({ ...place, photos: [...place.photos, photo] });
  };

  const requestNearbyPosition = async () => {
    await locateCurrentPosition();
  };

  const updateApplication = async () => {
    if (updatingApp) return;
    setUpdatingApp(true);
    setNotice('Controllo aggiornamenti...');

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(async (registration) => {
          try {
            await registration.update();
          } finally {
            await registration.unregister();
          }
        }));
      }

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.filter((name) => name.startsWith('tracce-')).map((name) => caches.delete(name)));
      }

      const freshUrl = new URL(window.location.href);
      freshUrl.searchParams.set('update', Date.now().toString());
      window.location.replace(freshUrl.toString());
    } catch {
      window.location.reload();
    }
  };

  const removeCategory = async (category: Category) => {
    if (!window.confirm(`Eliminare la categoria "${category.name}"? I luoghi passeranno a Senza categoria.`)) return;
    await categoryRepository.remove(category.id);
    await refresh();
  };

  if (booting || !settings) return <div className="boot">Tracce</div>;
  if (!settings.onboardingCompleted) return <Onboarding onComplete={completeOnboarding} />;

  return (
    <div className="app-shell">
      <header className="sr-only">
        <h1>Tracce</h1>
      </header>

      {activeSection === 'map' && (
        <MapView
          places={filteredPlaces}
          categories={categories}
          currentPosition={currentPosition}
          selectedPlaceId={selectedPlaceId}
          manualSelect={Boolean(manualMode)}
          forcedUnavailable={forceMapUnavailable}
          onLocateUser={locateCurrentPosition}
          onOpenPlace={(place) => {
            setSelectedPlaceId(place.id);
            setDetailExpanded(false);
          }}
          onManualConfirm={handleManualConfirm}
          onManualCancel={() => setManualMode(null)}
          onMapUnavailable={setMapUnavailable}
          onGoList={() => setActiveSection('list')}
        />
      )}

      {activeSection === 'list' && (
        <ListScreen places={filteredPlaces} categories={categories} filters={filters} setFilters={setFilters} onOpen={(place) => {
          setSelectedPlaceId(place.id);
          setDetailExpanded(true);
        }} />
      )}

      {activeSection === 'nearby' && (
        <NearbyScreen places={filteredPlaces} categories={categories} currentPosition={currentPosition} onLocate={requestNearbyPosition} onOpen={(place) => {
          setSelectedPlaceId(place.id);
          setDetailExpanded(true);
        }} />
      )}

      {activeSection === 'settings' && (
        <SettingsScreen
          categories={categories}
          forceMapUnavailable={forceMapUnavailable}
          setForceMapUnavailable={setForceMapUnavailable}
          onSaveCategory={async (category) => {
            await categoryRepository.save(category);
            await refresh();
          }}
          onRemoveCategory={removeCategory}
          placesCount={places.length}
          tags={allTags}
        />
      )}

      <button className={`floating filter ${filtersOpen ? 'is-active' : ''}`} onClick={() => setFiltersOpen(true)} aria-label="Apri filtri">
        <Filter size={22} />
        {(filters.query || filters.categoryIds.length || filters.tags.length || filters.favoritesOnly || filters.incompleteOnly) && <span />}
      </button>

      {updateAvailable && (
        <button
          className={`floating update-app ${updatingApp ? 'is-updating' : ''}`}
          onClick={updateApplication}
          aria-label="Aggiornamento disponibile. Aggiorna applicazione"
          disabled={updatingApp}
        >
          <RefreshCw size={18} />
          <span>{updatingApp ? 'Aggiorno...' : 'Aggiorna'}</span>
        </button>
      )}

      {!manualMode && (
        <>
          <nav className={`section-dock ${menuOpen ? 'is-open' : ''}`} aria-label="Sezioni">
            <button
              className="floating menu"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Menu sezioni"
              aria-expanded={menuOpen}
              aria-controls="section-menu"
            >
              <Menu size={22} />
            </button>
            <div id="section-menu" className="section-pill" aria-hidden={!menuOpen}>
              {sectionMeta.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  className={activeSection === id ? 'active' : ''}
                  onClick={() => {
                    setActiveSection(id);
                    setMenuOpen(false);
                  }}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </nav>

          <button className="floating leave-trace" onClick={startTrace} aria-label="Lascia Traccia"><MapPin size={24} fill="currentColor" /></button>
        </>
      )}

      {filtersOpen && (
        <FilterSheet
          filters={filters}
          categories={categories}
          tags={allTags}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      {draft && (
        <DraftSheet
          draft={draft}
          categories={categories}
          onChange={setDraft}
          onChooseMap={chooseOnMap}
          onCancel={() => setDraft(null)}
          onSave={saveDraft}
        />
      )}

      {selectedPlace && (
        <PlaceSheet
          place={selectedPlace}
          categories={categories}
          expanded={detailExpanded}
          editing={editingPlaceId === selectedPlace.id}
          onExpand={() => setDetailExpanded(true)}
          onClose={() => {
            setSelectedPlaceId(undefined);
            setEditingPlaceId(null);
          }}
          onToggleFavorite={() => toggleFavorite(selectedPlace)}
          onSave={updatePlace}
          onEditToggle={() => setEditingPlaceId(editingPlaceId === selectedPlace.id ? null : selectedPlace.id)}
          onEditPosition={() => {
            setMenuOpen(false);
            setManualMode({ kind: 'edit', placeId: selectedPlace.id });
            setActiveSection('map');
          }}
          onDelete={async () => {
            if (!window.confirm('Vuoi eliminare questo luogo?')) return;
            await placeRepository.softDelete(selectedPlace.id);
            await refresh();
            setSelectedPlaceId(undefined);
          }}
          onAddPhoto={(file) => addPhoto(selectedPlace, file)}
        />
      )}

      {notice && (
        <div className="notice">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Chiudi"><X size={16} /></button>
        </div>
      )}
    </div>
  );
};

type SheetProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
};

const Sheet = ({ title, children, className = '' }: SheetProps) => (
  <section className={`bottom-sheet ${className}`}>
    <div className="grabber" />
    {title && <h2>{title}</h2>}
    {children}
  </section>
);

const DraftSheet = ({
  draft,
  categories,
  onChange,
  onChooseMap,
  onCancel,
  onSave,
}: {
  draft: DraftPlace;
  categories: Category[];
  onChange: (draft: DraftPlace) => void;
  onChooseMap: () => void;
  onCancel: () => void;
  onSave: () => void;
}) => (
  <Sheet title="Lascia Traccia">
    <div className="meta-card">
      <strong>Posizione rilevata</strong>
      <span>{draft.point.latitude.toFixed(5)}, {draft.point.longitude.toFixed(5)}</span>
      <span className={draft.point.accuracyMeters && draft.point.accuracyMeters > 30 ? 'warn' : ''}>
        Precisione: {draft.point.accuracyMeters ? `± ${Math.round(draft.point.accuracyMeters)} m` : 'non disponibile'}
      </span>
    </div>
    <label>Nome opzionale<input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="Es. Belvedere" /></label>
    <label>Categoria<select value={draft.categoryId} onChange={(event) => onChange({ ...draft, categoryId: event.target.value })}>
      {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
    </select></label>
    <div className="sheet-actions">
      <button onClick={onChooseMap}>Scegli sulla mappa</button>
      <button onClick={onCancel}>Annulla</button>
      <button className="primary" onClick={onSave}>Salva</button>
    </div>
  </Sheet>
);

const FilterSheet = ({ filters, categories, tags, onChange, onClose }: {
  filters: Filters;
  categories: Category[];
  tags: string[];
  onChange: (filters: Filters) => void;
  onClose: () => void;
}) => {
  const toggle = (key: keyof Filters, value: string) => {
    const current = filters[key] as string[];
    onChange({ ...filters, [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] });
  };

  return (
    <Sheet title="Filtra luoghi" className="filter-sheet">
      <label className="search-field"><Search size={18} /><input value={filters.query} placeholder="Cerca..." onChange={(event) => onChange({ ...filters, query: event.target.value })} /></label>
      <h3>Categoria</h3>
      <div className="choice-grid">
        {categories.map((category) => (
          <button key={category.id} className={filters.categoryIds.includes(category.id) ? 'selected' : ''} onClick={() => toggle('categoryIds', category.id)}>
            <span style={{ background: category.color }} />{category.name}
          </button>
        ))}
      </div>
      <h3>Tag</h3>
      <div className="tag-row">
        {tags.length === 0 && <small>Nessun tag salvato.</small>}
        {tags.map((tag) => <button key={tag} className={filters.tags.includes(tag) ? 'selected' : ''} onClick={() => toggle('tags', tag)}>{tag}</button>)}
      </div>
      <label className="check-row"><input type="checkbox" checked={filters.favoritesOnly} onChange={(event) => onChange({ ...filters, favoritesOnly: event.target.checked })} /> Solo preferiti</label>
      <label className="check-row"><input type="checkbox" checked={filters.incompleteOnly} onChange={(event) => onChange({ ...filters, incompleteOnly: event.target.checked })} /> Da completare</label>
      <div className="sheet-actions">
        <button onClick={() => onChange(emptyFilters)}>Azzera filtri</button>
        <button className="primary" onClick={onClose}>Applica</button>
      </div>
    </Sheet>
  );
};

const PlaceSheet = ({
  place,
  categories,
  expanded,
  editing,
  onExpand,
  onClose,
  onToggleFavorite,
  onSave,
  onEditToggle,
  onEditPosition,
  onDelete,
  onAddPhoto,
}: {
  place: Place;
  categories: Category[];
  expanded: boolean;
  editing: boolean;
  onExpand: () => void;
  onClose: () => void;
  onToggleFavorite: () => void;
  onSave: (place: Place) => void;
  onEditToggle: () => void;
  onEditPosition: () => void;
  onDelete: () => void;
  onAddPhoto: (file: File) => void;
}) => {
  const [form, setForm] = useState(place);
  const [moreOpen, setMoreOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null);

  useEffect(() => {
    setForm(place);
    setMoreOpen(false);
    setDetailsOpen(false);
    setNotesOpen(false);
    setOpenPhotoId(null);
  }, [place]);

  const mapsUrl = `https://maps.apple.com/?ll=${place.latitude},${place.longitude}`;
  const shareUrl = `https://maps.google.com/?q=${place.latitude},${place.longitude}`;
  const openPhoto = place.photos.find((photo) => photo.id === openPhotoId);

  const save = () => {
    onSave({ ...form, tags: form.tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean) });
    onEditToggle();
  };

  const sharePlace = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: place.name || 'Tracce', url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
    } catch {
      // Closing the native share sheet is not an application error.
    }
  };

  return (
    <Sheet className={`place-sheet ${expanded ? 'expanded' : ''} ${editing ? 'is-editing' : ''}`}>
      <div className="place-head">
        <div className="place-title-block">
          <h2>{place.name?.trim() || 'Luogo senza nome'}</h2>
          <p>{categoryLabel(categories, place.categoryId)}</p>
          {isIncompletePlace(place) && <span className="badge">Da completare</span>}
        </div>
        <button className="icon-button" onClick={onToggleFavorite} aria-label="Preferito"><Star size={22} fill={place.isFavorite ? 'currentColor' : 'none'} /></button>
        <button className="icon-button" onClick={onClose} aria-label="Chiudi"><X size={21} /></button>
      </div>
      {!expanded && (
        <div className="sheet-actions compact">
          <button onClick={onExpand}><ChevronUp size={16} /> Apri scheda</button>
          <a href={mapsUrl} target="_blank" rel="noreferrer">Apri in Maps</a>
        </div>
      )}
      {expanded && (
        <div className={`expanded-content place-details-content ${editing ? 'is-editing' : ''}`}>
          {editing ? (
            <>
              <PhotoRail
                photos={form.photos}
                editing
                onRemove={(photoId) => setForm({ ...form, photos: form.photos.filter((photo) => photo.id !== photoId) })}
                onAddPhoto={onAddPhoto}
                onOpenPhoto={setOpenPhotoId}
              />
              <label>Nome<input value={form.name ?? ''} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Categoria<select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select></label>
              <label>Tag<input value={form.tags.join(', ')} onChange={(event) => setForm({ ...form, tags: parseTags(event.target.value) })} placeholder="ombra, panorama" /></label>
              <label>Note<textarea value={form.notes ?? ''} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
              <div className="place-edit-actions">
                <button onClick={onEditToggle}><X size={18} /> Annulla</button>
                <button className="primary" onClick={save}><Check size={18} /> Salva</button>
              </div>
            </>
          ) : (
            <>
              <PhotoRail
                photos={place.photos}
                onAddPhoto={onAddPhoto}
                onOpenPhoto={setOpenPhotoId}
              />
              {place.tags.length > 0 && <div className="tag-row place-tags">{place.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
              {place.notes ? (
                <button className="note-preview" onClick={() => setNotesOpen(true)}>
                  <span>Note</span>
                  <p>{place.notes}</p>
                </button>
              ) : (
                <button className="note-preview is-empty" onClick={onEditToggle}><Plus size={17} /> Aggiungi una nota</button>
              )}

              <div className="place-action-bar">
                <a href={mapsUrl} target="_blank" rel="noreferrer"><MapPinned size={20} /><span>Maps</span></a>
                <button onClick={sharePlace}><Share2 size={20} /><span>Condividi</span></button>
                <button onClick={onEditToggle}><Pencil size={20} /><span>Modifica</span></button>
                <button className={moreOpen ? 'active' : ''} onClick={() => setMoreOpen((open) => !open)} aria-expanded={moreOpen}><Ellipsis size={21} /><span>Altro</span></button>
              </div>

              {moreOpen && (
                <div className="place-more-menu" role="menu">
                  <button onClick={() => { setDetailsOpen(true); setMoreOpen(false); }}><Info size={18} /> Dettagli luogo</button>
                  <button onClick={onEditPosition}><Navigation size={18} /> Modifica posizione</button>
                  <button className="danger" onClick={onDelete}><Trash2 size={18} /> Elimina luogo</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {detailsOpen && (
        <div className="place-overlay" role="dialog" aria-modal="true" aria-label="Dettagli luogo">
          <section className="place-overlay-card technical-dialog">
            <div className="overlay-head"><h3>Dettagli luogo</h3><button onClick={() => setDetailsOpen(false)} aria-label="Chiudi dettagli"><X size={20} /></button></div>
            <dl>
              <div><dt>Coordinate</dt><dd>{place.latitude.toFixed(5)}, {place.longitude.toFixed(5)}</dd></div>
              <div><dt>Precisione GPS</dt><dd>{place.accuracyMeters ? `± ${Math.round(place.accuracyMeters)} m` : 'n/d'}</dd></div>
              <div><dt>Creato il</dt><dd>{new Date(place.createdAt).toLocaleString('it-IT')}</dd></div>
              <div><dt>Ultima modifica</dt><dd>{new Date(place.updatedAt).toLocaleString('it-IT')}</dd></div>
            </dl>
          </section>
        </div>
      )}

      {notesOpen && (
        <div className="place-overlay" role="dialog" aria-modal="true" aria-label="Note del luogo">
          <section className="place-overlay-card notes-dialog">
            <div className="overlay-head"><h3>Note</h3><button onClick={() => setNotesOpen(false)} aria-label="Chiudi note"><X size={20} /></button></div>
            <p>{place.notes}</p>
          </section>
        </div>
      )}

      {openPhoto && (
        <div className="place-overlay photo-viewer" role="dialog" aria-modal="true" aria-label="Foto del luogo">
          <button className="photo-viewer-close" onClick={() => setOpenPhotoId(null)} aria-label="Chiudi foto"><X size={22} /></button>
          <PhotoImage photo={openPhoto} alt={`Foto di ${place.name || 'questo luogo'}`} />
        </div>
      )}
    </Sheet>
  );
};

const PhotoRail = ({
  photos,
  editing = false,
  onRemove,
  onAddPhoto,
  onOpenPhoto,
}: {
  photos: PlacePhoto[];
  editing?: boolean;
  onRemove?: (id: string) => void;
  onAddPhoto: (file: File) => void;
  onOpenPhoto: (id: string) => void;
}) => {
  const addPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onAddPhoto(file);
  };

  return (
    <div className={`place-media ${photos.length === 0 ? 'is-empty' : ''}`}>
      <div className="photo-rail">
        {photos.map((photo) => (
          <figure key={photo.id}>
            <button className="photo-open" onClick={() => onOpenPhoto(photo.id)} aria-label="Apri foto">
              <PhotoImage photo={photo} alt="" />
            </button>
            {editing && onRemove && <button className="photo-remove" onClick={() => onRemove(photo.id)} aria-label="Elimina foto"><X size={14} /></button>}
          </figure>
        ))}
        {photos.length < 5 && (
          <label className="photo-add-tile">
            <Camera size={22} />
            <span>{photos.length === 0 ? 'Aggiungi una foto' : 'Aggiungi'}</span>
            <input type="file" accept="image/*" onChange={addPhoto} aria-label="Aggiungi una foto" />
          </label>
        )}
      </div>
      {photos.length > 0 && <span className="photo-count">{photos.length}/5</span>}
    </div>
  );
};

const PhotoImage = ({ photo, alt }: { photo: PlacePhoto; alt: string }) => {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const nextUrl = URL.createObjectURL(photo.blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [photo]);

  return url ? <img src={url} alt={alt} /> : null;
};

const PlaceRow = ({ place, categories, right, onOpen }: { place: Place; categories: Category[]; right?: string; onOpen: () => void }) => (
  <button className="place-row" onClick={onOpen}>
    <span className="category-dot" style={{ background: categories.find((category) => category.id === place.categoryId)?.color }} />
    <span>
      <strong>{place.isFavorite && <Star size={14} fill="currentColor" />} {place.name?.trim() || 'Luogo senza nome'}</strong>
      <small>{categoryLabel(categories, place.categoryId)}</small>
      {place.tags.length > 0 && <em>tag: {place.tags.slice(0, 3).join(', ')}</em>}
      {isIncompletePlace(place) && <i>Da completare</i>}
    </span>
    {right && <b>{right}</b>}
  </button>
);

const ListScreen = ({ places, categories, filters, setFilters, onOpen }: {
  places: Place[];
  categories: Category[];
  filters: Filters;
  setFilters: (filters: Filters) => void;
  onOpen: (place: Place) => void;
}) => (
  <main className="panel-screen">
    <h1>Elenco</h1>
    <label className="search-field"><Search size={18} /><input value={filters.query} placeholder="Cerca..." onChange={(event) => setFilters({ ...filters, query: event.target.value })} /></label>
    <p className="screen-subtitle">Ordine: Alfabetico</p>
    <div className="rows">
      {places.length === 0 && <p className="empty-state">Nessun luogo salvato. Usa il pulsante pin dalla mappa per lasciare la prima traccia.</p>}
      {places.map((place) => <PlaceRow key={place.id} place={place} categories={categories} onOpen={() => onOpen(place)} />)}
    </div>
  </main>
);

const NearbyScreen = ({ places, categories, currentPosition, onLocate, onOpen }: {
  places: Place[];
  categories: Category[];
  currentPosition: GeoPoint | null;
  onLocate: () => void;
  onOpen: (place: Place) => void;
}) => {
  const sorted = currentPosition
    ? places.map((place) => ({ place, distance: distanceMeters(currentPosition, place) })).sort((a, b) => a.distance - b.distance)
    : [];
  return (
    <main className="panel-screen">
      <h1>Vicini</h1>
      <button className="primary-action inline" onClick={onLocate}><LocateFixed size={18} /> Rileva posizione attuale</button>
      <div className="rows">
        {!currentPosition && <p className="empty-state">Rileva la posizione per ordinare i luoghi per distanza.</p>}
        {sorted.map(({ place, distance }) => <PlaceRow key={place.id} place={place} categories={categories} right={formatDistance(distance)} onOpen={() => onOpen(place)} />)}
      </div>
    </main>
  );
};

const SettingsScreen = ({ categories, placesCount, tags, forceMapUnavailable, setForceMapUnavailable, onSaveCategory, onRemoveCategory }: {
  categories: Category[];
  placesCount: number;
  tags: string[];
  forceMapUnavailable: boolean;
  setForceMapUnavailable: (value: boolean) => void;
  onSaveCategory: (category: Category) => void;
  onRemoveCategory: (category: Category) => void;
}) => (
  <main className="panel-screen settings-screen">
    <h1>Impostazioni</h1>
    <section>
      <h2>Categorie</h2>
      {categories.map((category) => (
        <div className="setting-row" key={category.id}>
          <span className="category-dot" style={{ background: category.color }} />
          <input value={category.name} onChange={(event) => onSaveCategory({ ...category, name: event.target.value })} />
          <button onClick={() => onRemoveCategory(category)} disabled={category.id === UNCATEGORIZED_ID}><Trash2 size={16} /></button>
        </div>
      ))}
    </section>
    <section>
      <h2>Tag</h2>
      <div className="tag-row">{tags.length ? tags.map((tag) => <span key={tag}>{tag}</span>) : <small>Nessun tag salvato.</small>}</div>
    </section>
    <section>
      <h2>Dati locali</h2>
      <p>{placesCount} luoghi salvati in IndexedDB.</p>
    </section>
    <section>
      <h2>Mappa</h2>
      <label className="check-row"><input type="checkbox" checked={forceMapUnavailable} onChange={(event) => setForceMapUnavailable(event.target.checked)} /> Simula mappa non disponibile</label>
    </section>
    <section>
      <h2>Cloud futuro</h2>
      <p>Non attivo nella V1.</p>
    </section>
    <section>
      <h2>Info app</h2>
      <p>Tracce 1.0 · I tuoi luoghi, sempre con te</p>
    </section>
  </main>
);
