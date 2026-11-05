-- Prompt chains, LLM config, request/response logging, and signup rules.
-- Run in the Supabase SQL Editor after admin.sql. Safe to run more than once.
-- The main app reads the config and writes the logs with its server-side service role;
-- the admin area reads and manages everything through superadmin-only RLS policies.
begin;

-- 1. LLM providers and models (the caption pipeline tries active models in priority order).
create table if not exists public.llm_providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  api_base_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.llm_models (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.llm_providers (id) on delete cascade,
  model_id text not null unique,
  display_name text not null,
  priority integer not null default 100, -- lower runs first
  timeout_ms integer not null default 45000 check (timeout_ms between 5000 and 120000),
  supports_images boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Prompt chains: an ordered list of steps; each step's output feeds the next.
create table if not exists public.prompt_chains (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Templates may use {{caption_count}}, {{vibe_label}}, {{vibe_instructions}}, {{context}},
-- {{terms}}, {{examples}} and {{previous_output}}.
create table if not exists public.prompt_chain_steps (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.prompt_chains (id) on delete cascade,
  position smallint not null,
  name text not null,
  template text not null,
  output_format text not null check (output_format in ('text', 'captions')),
  uses_image boolean not null default true,
  created_at timestamptz not null default now(),
  unique (chain_id, position)
);

-- The mix: how often each chain is picked for a new generation (relative weights).
create table if not exists public.prompt_chain_mix (
  chain_id uuid primary key references public.prompt_chains (id) on delete cascade,
  weight integer not null default 0 check (weight between 0 and 100),
  updated_at timestamptz not null default now()
);

-- 3. Terms and examples mixed into prompts.
create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  definition text not null,
  category text not null default 'columbia' check (category in ('columbia', 'nyc', 'slang')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_examples (
  id uuid primary key default gen_random_uuid(),
  vibe text check (vibe in ('genz', 'dad', 'newyorker', 'core')), -- null = any vibe
  scene text not null, -- what's in the photo
  caption text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Observability: one request per "generate captions" attempt, one response per LLM call
-- (failed fallback attempts included).
create table if not exists public.generation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  source text not null default 'app' check (source in ('app', 'admin')),
  chain_id uuid references public.prompt_chains (id) on delete set null,
  chain_name text,
  vibe text,
  image_path text,
  context text,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  error text,
  generation_id uuid references public.generations (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer
);

create index if not exists generation_requests_created_at_idx on public.generation_requests (created_at desc);

create table if not exists public.llm_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.generation_requests (id) on delete cascade,
  step_position smallint,
  step_name text,
  provider_slug text,
  model_id text not null,
  status text not null check (status in ('success', 'error')),
  http_status integer,
  prompt text not null,
  response_text text,
  error text,
  latency_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists llm_responses_request_id_idx on public.llm_responses (request_id, created_at);

-- 5. Signup rules.
create table if not exists public.allowed_signup_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.whitelisted_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  note text,
  created_at timestamptz not null default now()
);

-- Enforced in the database, so it can't be bypassed: new accounts (Google sign-in creates
-- one on first login) must match an allowed domain (or its subdomain) or a whitelisted
-- email. Existing accounts aren't affected. With both lists empty, anyone may sign up.
create or replace function public.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  signup_email text := lower(coalesce(new.email, ''));
begin
  if not exists (select 1 from public.allowed_signup_domains)
     and not exists (select 1 from public.whitelisted_emails) then
    return new;
  end if;

  if exists (select 1 from public.whitelisted_emails w where w.email = signup_email)
     or exists (
       select 1 from public.allowed_signup_domains d
       where signup_email like '%@' || d.domain or signup_email like '%.' || d.domain
     ) then
    return new;
  end if;

  raise exception 'Sign-ups are limited to approved email addresses' using errcode = 'P0001';
end;
$$;

drop trigger if exists enforce_signup_allowlist on auth.users;
create trigger enforce_signup_allowlist
  before insert on auth.users
  for each row execute function public.enforce_signup_allowlist();

-- 6. Row level security: superadmins only. (The main app's server uses the service role.)
do $$
declare
  t text;
begin
  -- Full create/read/update/delete for superadmins.
  foreach t in array array['llm_providers', 'llm_models', 'terms', 'generation_examples',
                           'allowed_signup_domains', 'whitelisted_emails']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Superadmins manage %s" on public.%I', t, t);
    execute format(
      'create policy "Superadmins manage %s" on public.%I for all to authenticated
         using ((select public.is_superadmin())) with check ((select public.is_superadmin()))', t, t);
  end loop;

  -- Read-only for superadmins.
  foreach t in array array['prompt_chains', 'prompt_chain_steps', 'prompt_chain_mix',
                           'generation_requests', 'llm_responses']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Superadmins read %s" on public.%I', t, t);
    execute format(
      'create policy "Superadmins read %s" on public.%I for select to authenticated
         using ((select public.is_superadmin()))', t, t);
  end loop;
end;
$$;

-- Superadmins can change the mix weights (but not add or remove chains).
drop policy if exists "Superadmins update prompt_chain_mix" on public.prompt_chain_mix;
create policy "Superadmins update prompt_chain_mix"
  on public.prompt_chain_mix for update to authenticated
  using ((select public.is_superadmin())) with check ((select public.is_superadmin()));

-- The admin area logs its own generations through the admin's session.
drop policy if exists "Superadmins log requests" on public.generation_requests;
create policy "Superadmins log requests"
  on public.generation_requests for insert to authenticated
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins update requests" on public.generation_requests;
create policy "Superadmins update requests"
  on public.generation_requests for update to authenticated
  using ((select public.is_superadmin())) with check ((select public.is_superadmin()));

drop policy if exists "Superadmins log responses" on public.llm_responses;
create policy "Superadmins log responses"
  on public.llm_responses for insert to authenticated
  with check ((select public.is_superadmin()));

-- 7. Images: superadmins can see every uploaded photo and upload into any folder.
drop policy if exists "Superadmins can view all uploads" on storage.objects;
create policy "Superadmins can view all uploads"
  on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and (select public.is_superadmin()));

-- List of uploaded photos with the generation that uses each one.
create or replace function public.admin_list_images()
returns table (
  path text,
  size_bytes bigint,
  mime_type text,
  created_at timestamptz,
  owner_id uuid,
  owner_first_name text,
  owner_last_name text,
  generation_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Only superadmins can list images' using errcode = '42501';
  end if;

  return query
  select
    o.name,
    coalesce((o.metadata ->> 'size')::bigint, 0),
    o.metadata ->> 'mimetype',
    o.created_at,
    p.id,
    p.first_name,
    p.last_name,
    g.id
  from storage.objects o
  left join public.profiles p on p.id::text = split_part(o.name, '/', 1)
  left join public.generations g on g.image_path = o.name
  where o.bucket_id = 'uploads'
  order by o.created_at desc;
end;
$$;

revoke execute on function public.admin_list_images() from public, anon;
grant execute on function public.admin_list_images() to authenticated;

-- 8. Starting data.
insert into public.llm_providers (slug, name, api_base_url)
values ('google', 'Google Gemini', 'https://generativelanguage.googleapis.com')
on conflict (slug) do nothing;

insert into public.llm_models (provider_id, model_id, display_name, priority, timeout_ms)
select p.id, m.model_id, m.display_name, m.priority, m.timeout_ms
from public.llm_providers p
cross join (values
  ('gemini-flash-latest', 'Gemini Flash (latest)', 10, 45000),
  ('gemini-3-flash-preview', 'Gemini 3 Flash Preview', 20, 45000),
  ('gemini-3.1-flash-lite', 'Gemini 3.1 Flash Lite', 30, 45000),
  ('gemini-3.7-flash', 'Gemini 3.7 Flash', 40, 45000),
  ('gemini-flash-lite-latest', 'Gemini Flash Lite (latest)', 50, 45000)
) as m (model_id, display_name, priority, timeout_ms)
where p.slug = 'google'
on conflict (model_id) do nothing;

insert into public.prompt_chains (slug, name, description)
values
  ('describe-then-caption', 'Describe, then caption',
   'Step 1 writes notes about the photo; step 2 turns the notes and the photo into captions.'),
  ('one-shot', 'One-shot caption', 'A single prompt that writes captions straight from the photo.')
on conflict (slug) do nothing;

insert into public.prompt_chain_steps (chain_id, position, name, template, output_format, uses_image)
select c.id, s.position, s.name, s.template, s.output_format, s.uses_image
from public.prompt_chains c
join (values
  ('describe-then-caption', 1, 'Describe the photo', $t$You help a comedy writer for a humor app used by Columbia University students in New York City.
Describe the attached photo in 3 to 5 short bullet points: who or what is in it, the setting (say if it looks like the Columbia campus, a dorm, the subway or somewhere in NYC), and anything funny, odd or relatable about it.
{{context}}
Don't write jokes yet.$t$, 'text', true),
  ('describe-then-caption', 2, 'Write captions', $t$You write captions for a humor app used by Columbia University students in New York City.
The audience is college students who are very online, many of them new to NYC, living in the dorms and exploring the city on weekends.
Write {{caption_count}} different funny captions for the attached photo.

Notes about the photo:
{{previous_output}}
{{context}}

Rules:
- Each caption is a single line under 120 characters, like a meme caption or a post.
- Style ({{vibe_label}}): {{vibe_instructions}}
- Make the captions different from each other, not variations of one joke.
- Base the humor on what is actually in the photo.
- Keep it playful: no insults about anyone's appearance, race, religion, gender, sexuality or disability, no slurs, nothing sexual.
- No hashtags. Only use an emoji if it is part of the joke.

Local terms you may use if they fit (don't force them):
{{terms}}

Examples of this style:
{{examples}}$t$, 'captions', true),
  ('one-shot', 1, 'Write captions', $t$You write captions for a humor app used by Columbia University students in New York City.
The audience is college students who are very online, many of them new to NYC, living in the dorms and exploring the city on weekends.
Write {{caption_count}} different funny captions for the attached photo.
{{context}}

Rules:
- Each caption is a single line under 120 characters, like a meme caption or a post.
- Style ({{vibe_label}}): {{vibe_instructions}}
- Make the captions different from each other, not variations of one joke.
- Base the humor on what is actually in the photo.
- Keep it playful: no insults about anyone's appearance, race, religion, gender, sexuality or disability, no slurs, nothing sexual.
- No hashtags. Only use an emoji if it is part of the joke.

Local terms you may use if they fit (don't force them):
{{terms}}

Examples of this style:
{{examples}}$t$, 'captions', true)
) as s (chain_slug, position, name, template, output_format, uses_image)
  on s.chain_slug = c.slug
on conflict (chain_id, position) do nothing;

insert into public.prompt_chain_mix (chain_id, weight)
select id, case slug when 'describe-then-caption' then 70 else 30 end
from public.prompt_chains
on conflict (chain_id) do nothing;

insert into public.terms (term, definition, category)
values
  ('Butler', 'Butler Library, where students pull all-nighters', 'columbia'),
  ('Low Steps', 'The steps of Low Library, the main hangout spot on campus', 'columbia'),
  ('JJ''s', 'JJ''s Place, the late-night dining hall in John Jay', 'columbia'),
  ('Ferris', 'Ferris Booth Commons, the dining hall in Lerner', 'columbia'),
  ('Carman', 'Carman Hall, the first-year dorm known for its cinderblock walls', 'columbia'),
  ('Lit Hum', 'Literature Humanities, the Core class reading the classics', 'columbia'),
  ('CC', 'Contemporary Civilization, the Core philosophy class', 'columbia'),
  ('the 1 train', 'The subway line that stops at 116 St–Columbia', 'nyc'),
  ('bodega cat', 'The cat that lives in a corner store', 'nyc'),
  ('Morningside', 'Morningside Heights, the neighborhood around campus', 'nyc'),
  ('it''s giving', 'Slang: it has the energy of', 'slang'),
  ('core memory', 'Slang: a moment you will never forget', 'slang')
on conflict (term) do nothing;

insert into public.generation_examples (vibe, scene, caption)
select * from (values
  ('genz', 'A pigeon sitting on a subway seat', 'bro paid the fare and is not moving for anyone'),
  ('genz', 'An empty library at 3am', 'butler at 3am is a different dimension and i live there now'),
  ('dad', 'A pizza slice on a paper plate', 'I''d tell you a pizza joke, but it''s a little cheesy.'),
  ('dad', 'Students lined up at a coffee cart', 'Looks like everyone''s brewing up some trouble this morning!'),
  ('newyorker', 'Tourists stopped in the middle of the sidewalk', 'Ah yes, the natural predator of anyone with somewhere to be.'),
  ('newyorker', 'A rat dragging a bagel', 'Even he knows the bagels uptown are overpriced.'),
  ('core', 'A messy dorm desk covered in books', 'Plato''s cave, but the shadows are my unread Lit Hum pages.'),
  ('core', 'Rain on the Low Library steps', 'The Alma Mater has survived worse: CC finals week.')
) as e (vibe, scene, caption)
where not exists (select 1 from public.generation_examples);

insert into public.allowed_signup_domains (domain, note)
values ('columbia.edu', 'Columbia students and staff'), ('barnard.edu', 'Barnard students and staff')
on conflict (domain) do nothing;

commit;
