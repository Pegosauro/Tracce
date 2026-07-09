import { Camera, Database, MapPinned, Navigation, ShieldCheck } from 'lucide-react';
import type { GeoPoint } from '../../app/types';
import { getCurrentPosition } from '../../shared/geo/geolocation';

type OnboardingProps = {
  onComplete: (gpsAsked: boolean, point?: GeoPoint) => void;
};

export const Onboarding = ({ onComplete }: OnboardingProps) => {
  const requestGps = async () => {
    try {
      const point = await getCurrentPosition(8000);
      onComplete(true, point);
      return;
    } catch {
      // The app remains usable with manual map selection when tiles are available.
    }
    finally {
      onComplete(true);
    }
  };

  return (
    <main className="onboarding">
      <img src={`${import.meta.env.BASE_URL}icons/tracce.svg`} alt="" className="app-logo" />
      <h1>Tracce</h1>
      <p className="payoff">I tuoi luoghi, sempre con te</p>
      <div className="onboarding-list">
        <article>
          <MapPinned size={22} />
          <span>Salva luoghi personali da GPS o scegliendoli sulla mappa.</span>
        </article>
        <article>
          <Navigation size={22} />
          <span>Ritrova subito mappa, elenco alfabetico e luoghi vicini.</span>
        </article>
        <article>
          <Camera size={22} />
          <span>Aggiungi note, tag e fino a 5 foto compresse localmente.</span>
        </article>
        <article>
          <Database size={22} />
          <span>I dati restano sul dispositivo, senza cloud o login nella V1.</span>
        </article>
        <article>
          <ShieldCheck size={22} />
          <span>Il permesso GPS serve solo a lasciare una traccia più precisa.</span>
        </article>
      </div>
      <button className="primary-action" onClick={requestGps}>Continua</button>
      <button className="ghost-action" onClick={() => onComplete(false)}>Usa senza GPS ora</button>
    </main>
  );
};
