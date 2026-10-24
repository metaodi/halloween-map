/** Öffentlich sichtbarer Eintrag (View public_entries). */
export interface Entry {
  id: string;
  village_slug: string;
  address_label: string;
  lat: number;
  lng: number;
  note: string | null;
  created_at: string;
}
