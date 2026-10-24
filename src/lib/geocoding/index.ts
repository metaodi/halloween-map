import { PhotonGeocoder } from './photon';
import { SwisstopoGeocoder } from './swisstopo';
import type { GeocoderProvider } from './types';

export type { BBox, GeocodeResult, GeocoderProvider } from './types';

/** Provider per VITE_GEOCODER: «swisstopo» (Default) oder «photon». */
export function createGeocoder(name: string | undefined = import.meta.env.VITE_GEOCODER): GeocoderProvider {
  return name === 'photon' ? new PhotonGeocoder() : new SwisstopoGeocoder();
}
