-- MixBrain initial schema v1
-- Execute once in Supabase SQL Editor. This script is intentionally not idempotent.

create extension if not exists pgcrypto;

create type public.track_candidate_status as enum (
  'candidate',
  'active',
  'suggested_reserve',
  'reserved',
  'required',
  'excluded',
  'bridge'
);

create type public.confidence_level as enum ('high', 'medium', 'low', 'unknown');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  artist text not null,
  version_name text,
  album text,
  label text,
  release_year integer check (release_year between 1900 and 2100),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  spotify_url text,
  youtube_url text,
  soundcloud_url text,
  spotify_track_id text,
  isrc text,
  popularity smallint check (popularity is null or popularity between 0 and 100),
  genres text[] not null default '{}',
  source_name text not null default 'manual',
  source_imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, spotify_track_id),
  unique (user_id, isrc)
);

create table public.track_features (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null unique references public.tracks(id) on delete cascade,
  bpm numeric(6,2) check (bpm is null or bpm between 40 and 250),
  musical_key text,
  camelot text check (camelot is null or camelot ~ '^(1[0-2]|[1-9])[AB]$'),
  energy smallint check (energy is null or energy between 0 and 100),
  mood text[] not null default '{}',
  danceability numeric(5,4) check (danceability is null or danceability between 0 and 1),
  acousticness numeric(5,4) check (acousticness is null or acousticness between 0 and 1),
  instrumentalness numeric(5,4) check (instrumentalness is null or instrumentalness between 0 and 1),
  valence numeric(5,4) check (valence is null or valence between 0 and 1),
  loudness_db numeric(6,2) check (loudness_db is null or loudness_db <= 0),
  dancefloor_intensity smallint check (dancefloor_intensity is null or dancefloor_intensity between 0 and 100),
  tension smallint check (tension is null or tension between 0 and 100),
  hypnosis smallint check (hypnosis is null or hypnosis between 0 and 100),
  emotion smallint check (emotion is null or emotion between 0 and 100),
  melody smallint check (melody is null or melody between 0 and 100),
  vocal_presence smallint check (vocal_presence is null or vocal_presence between 0 and 100),
  brightness smallint check (brightness is null or brightness between 0 and 100),
  groove smallint check (groove is null or groove between 0 and 100),
  aggressiveness smallint check (aggressiveness is null or aggressiveness between 0 and 100),
  darkness smallint check (darkness is null or darkness between 0 and 100),
  data_source text not null default 'manual',
  confidence public.confidence_level not null default 'unknown',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.set_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text,
  target_duration_minutes integer check (target_duration_minutes is null or target_duration_minutes > 0),
  bpm_min numeric(6,2) check (bpm_min is null or bpm_min between 40 and 250),
  bpm_max numeric(6,2) check (bpm_max is null or bpm_max between 40 and 250),
  narrative_brief text,
  narrative_profile jsonb,
  narrative_profile_approved_at timestamptz,
  scoring_weights jsonb not null default '{"narrative":28,"moment":22,"harmony":16,"energy":13,"texture":9,"bpm":7,"diversity":5}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (bpm_min is null or bpm_max is null or bpm_min <= bpm_max)
);

create table public.set_candidates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.set_projects(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete restrict,
  status public.track_candidate_status not null default 'candidate',
  narrative_role text check (narrative_role is null or narrative_role in ('opening','build','peak','release','closing','bridge')),
  position_lock integer check (position_lock is null or position_lock > 0),
  is_start_track boolean not null default false,
  is_end_track boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, track_id)
);

create table public.approved_transitions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.set_projects(id) on delete cascade,
  from_candidate_id uuid not null references public.set_candidates(id) on delete cascade,
  to_candidate_id uuid not null references public.set_candidates(id) on delete cascade,
  status text not null check (status in ('approved','rejected')),
  explanation text,
  created_at timestamptz not null default now(),
  unique (project_id, from_candidate_id, to_candidate_id)
);

create table public.frozen_blocks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.set_projects(id) on delete cascade,
  name text,
  candidate_ids jsonb not null check (jsonb_typeof(candidate_ids) = 'array' and jsonb_array_length(candidate_ids) >= 2),
  is_frozen boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.set_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.set_projects(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table public.curation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.set_projects(id) on delete cascade,
  candidate_id uuid references public.set_candidates(id) on delete set null,
  event_type text not null check (event_type in (
    'track_included','track_reserved','track_removed','track_moved',
    'track_position_locked','transition_approved','transition_rejected',
    'block_frozen','block_unfrozen','bridge_accepted','bridge_rejected',
    'set_version_saved','set_version_restored'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index tracks_user_id_idx on public.tracks(user_id);
create index set_projects_user_id_idx on public.set_projects(user_id);
create index set_candidates_project_id_idx on public.set_candidates(project_id);
create index set_candidates_track_id_idx on public.set_candidates(track_id);
create index approved_transitions_project_id_idx on public.approved_transitions(project_id);
create index frozen_blocks_project_id_idx on public.frozen_blocks(project_id);
create index set_versions_project_id_idx on public.set_versions(project_id);
create index curation_events_project_id_idx on public.curation_events(project_id);
create index curation_events_user_id_idx on public.curation_events(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger tracks_updated_at before update on public.tracks for each row execute function public.set_updated_at();
create trigger track_features_updated_at before update on public.track_features for each row execute function public.set_updated_at();
create trigger set_projects_updated_at before update on public.set_projects for each row execute function public.set_updated_at();
create trigger set_candidates_updated_at before update on public.set_candidates for each row execute function public.set_updated_at();
create trigger frozen_blocks_updated_at before update on public.frozen_blocks for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.tracks enable row level security;
alter table public.track_features enable row level security;
alter table public.set_projects enable row level security;
alter table public.set_candidates enable row level security;
alter table public.approved_transitions enable row level security;
alter table public.frozen_blocks enable row level security;
alter table public.set_versions enable row level security;
alter table public.curation_events enable row level security;

create policy "profiles_own_all" on public.profiles for all to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "tracks_own_all" on public.tracks for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "track_features_own_all" on public.track_features for all to authenticated
using (exists (select 1 from public.tracks t where t.id = track_id and t.user_id = (select auth.uid())))
with check (exists (select 1 from public.tracks t where t.id = track_id and t.user_id = (select auth.uid())));

create policy "projects_own_all" on public.set_projects for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "candidates_own_all" on public.set_candidates for all to authenticated
using (exists (select 1 from public.set_projects p where p.id = project_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.set_projects p where p.id = project_id and p.user_id = (select auth.uid())));

create policy "transitions_own_all" on public.approved_transitions for all to authenticated
using (exists (select 1 from public.set_projects p where p.id = project_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.set_projects p where p.id = project_id and p.user_id = (select auth.uid())));

create policy "blocks_own_all" on public.frozen_blocks for all to authenticated
using (exists (select 1 from public.set_projects p where p.id = project_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.set_projects p where p.id = project_id and p.user_id = (select auth.uid())));

create policy "versions_own_all" on public.set_versions for all to authenticated
using (exists (select 1 from public.set_projects p where p.id = project_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.set_projects p where p.id = project_id and p.user_id = (select auth.uid())));

create policy "events_own_all" on public.curation_events for all to authenticated
using ((select auth.uid()) = user_id and exists (select 1 from public.set_projects p where p.id = project_id and p.user_id = (select auth.uid())))
with check ((select auth.uid()) = user_id and exists (select 1 from public.set_projects p where p.id = project_id and p.user_id = (select auth.uid())));

-- Creates a profile for the user that already existed before this schema was installed.
insert into public.profiles (id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;
