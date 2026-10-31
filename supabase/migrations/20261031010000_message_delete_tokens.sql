-- HalloweenMap: eigene Nachrichten löschen (analog zu den Einträgen)
-- Der Client erzeugt einen Löschtoken, in der DB liegt nur sein SHA-256-Hash.
-- Einspielen nach 20261031000000_messages.sql.

alter table public.messages add column delete_token_hash text;
create unique index messages_token_hash_idx on public.messages (delete_token_hash);

-- create_message bekommt den Token als zusätzlichen Parameter
drop function public.create_message(text, text, text, boolean);

create function public.create_message(
  p_village_slug text,
  p_author_name  text,
  p_body         text,
  p_token        text,
  p_as_admin     boolean default false
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := public.sanitize_plain_text(p_author_name, false);
  v_body text := public.sanitize_plain_text(p_body, true);
  v_is_admin boolean := exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
  v_id uuid;
begin
  if p_village_slug is null or p_village_slug !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'Ungültiger Ort' using errcode = '22023';
  end if;
  if char_length(v_name) not between 1 and 30 then
    raise exception 'Bitte einen Namen mit höchstens 30 Zeichen angeben' using errcode = '22023';
  end if;
  if char_length(v_body) not between 1 and 500 then
    raise exception 'Die Nachricht muss 1 bis 500 Zeichen lang sein' using errcode = '22023';
  end if;
  if p_token is null or char_length(p_token) not between 16 and 100 then
    raise exception 'Ungültiger Token' using errcode = '22023';
  end if;

  -- Rate-Limit: max. 10 Nachrichten pro Minute und Ort (Admins ausgenommen)
  if not v_is_admin and (select count(*) from public.messages
      where village_slug = p_village_slug
        and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Zu viele Nachrichten, bitte in einer Minute erneut versuchen' using errcode = '54000';
  end if;

  insert into public.messages (village_slug, author_name, body, is_admin, delete_token_hash)
  values (
    p_village_slug, v_name, v_body, v_is_admin and coalesce(p_as_admin, false),
    encode(extensions.digest(p_token, 'sha256'), 'hex')
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Eigene Nachricht mit dem Token löschen
create function public.delete_own_message(p_message_id uuid, p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.messages
  where id = p_message_id
    and delete_token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.create_message(text, text, text, text, boolean) from public;
revoke all on function public.delete_own_message(uuid, text) from public;
grant execute on function public.create_message(text, text, text, text, boolean) to anon, authenticated;
grant execute on function public.delete_own_message(uuid, text) to anon, authenticated;
