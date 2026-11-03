-- RPC: eigenen Eintrag mit dem Löschtoken bearbeiten (Adresse, Koordinaten, Hinweis).
-- Der Ort (village_slug) bleibt unverändert.

create function public.update_entry(
  p_entry_id      uuid,
  p_token         text,
  p_address_label text,
  p_lat           double precision,
  p_lng           double precision,
  p_note          text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_label text := btrim(coalesce(p_address_label, ''));
  v_count integer;
begin
  if char_length(v_label) not between 3 and 200 then
    raise exception 'Ungültige Adresse' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 140 then
    raise exception 'Hinweis ist zu lang' using errcode = '22023';
  end if;
  if p_lat is null or p_lng is null
     or p_lat not between 45.5 and 48.0
     or p_lng not between 5.5 and 10.8 then
    raise exception 'Ungültige Koordinaten' using errcode = '22023';
  end if;

  update public.entries
  set address_label = v_label, lat = p_lat, lng = p_lng, note = v_note
  where id = p_entry_id
    and delete_token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.update_entry(uuid, text, text, double precision, double precision, text) from public;
grant execute on function public.update_entry(uuid, text, text, double precision, double precision, text) to anon, authenticated;
