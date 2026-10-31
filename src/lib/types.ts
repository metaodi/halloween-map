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

/** Öffentlich sichtbare Nachricht (View public_messages). */
export interface Message {
  id: string;
  village_slug: string;
  author_name: string;
  body: string;
  is_admin: boolean;
  is_sticky: boolean;
  created_at: string;
}
