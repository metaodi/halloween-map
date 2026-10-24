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
