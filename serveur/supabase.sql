-- OBSeb : les comptes, dans Supabase.
-- À coller une seule fois dans Supabase › SQL Editor › New query, puis « Run ».
-- On peut le relancer sans risque : chaque morceau vérifie ce qui existe déjà.

-- 1. Le profil de chaque compte : sa formule. Une ligne par personne inscrite.
create table if not exists public.profils (
  id uuid primary key references auth.users (id) on delete cascade,
  formule text not null default 'gratuit' check (formule in ('gratuit', 'essentiel', 'pro', 'entreprise', 'beta')),
  version text not null default 'avec' check (version in ('avec', 'sans')),
  cree_le timestamptz not null default now()
);

-- 2. Sécurité : chacun ne voit que son propre profil, et personne ne peut changer sa formule depuis le site.
--    Seul le paiement (plus tard, côté serveur, avec la clé secrète) pourra la changer.
alter table public.profils enable row level security;
drop policy if exists "je lis mon profil" on public.profils;
create policy "je lis mon profil" on public.profils for select using (auth.uid() = id);
revoke insert, update, delete on public.profils from anon, authenticated;

-- 3. À chaque inscription, le profil est créé tout seul. Pendant la bêta, tout le monde est en « beta ».
create or replace function public.creer_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profils (id, formule) values (new.id, 'beta') on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists apres_inscription on auth.users;
create trigger apres_inscription after insert on auth.users for each row execute function public.creer_profil();

-- 4. « Supprimer mon compte » : efface la personne et son profil. Obligatoire en Europe (RGPD).
create or replace function public.supprimer_mon_compte() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'pas connecté'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
