import { demoEntries } from '../demoData';
import type { Entry } from '../types';
import type { Village } from '../../config/villages';
import { supabase, requireSupabase } from './client';

const COLUMNS = 'id, village_slug, address_label, lat, lng, note, created_at';

/**
 * Lädt die öffentlichen Einträge eines Orts. Ohne Supabase-Konfiguration
 * (lokale Entwicklung) werden Demo-Daten geliefert.
 */
export async function fetchEntries(village: Village): Promise<Entry[]> {
  if (!supabase) return demoEntries(village.slug, village.center);
  const { data, error } = await supabase
    .from('public_entries')
    .select(COLUMNS)
    .eq('village_slug', village.slug)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data as Entry[];
}

export { requireSupabase };

export interface NewEntry {
  village_slug: string;
  address_label: string;
  lat: number;
  lng: number;
  note: string | null;
  token: string;
}

/** Legt einen Eintrag über die RPC `create_entry` an und liefert dessen ID. */
export async function createEntry(entry: NewEntry): Promise<string> {
  const { data, error } = await requireSupabase().rpc('create_entry', {
    p_village_slug: entry.village_slug,
    p_address_label: entry.address_label,
    p_lat: entry.lat,
    p_lng: entry.lng,
    p_note: entry.note,
    p_token: entry.token,
  });
  if (error) throw new SupabaseRpcError(error.message, error.code);
  return data as string;
}

export class SupabaseRpcError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}
