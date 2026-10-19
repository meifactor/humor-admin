-- Admin area: superadmin flag, admin-only RLS policies, and dashboard/user functions.
-- Run in the Supabase SQL Editor (same project as the main app). Safe to run more than once.
begin;

-- 1. The superadmin flag. Defaults to false for everyone.
alter table public.profiles
  add column if not exists is_superadmin boolean not null default false;

-- Lock it down: signed-in users may only write their own name/photo columns, so nobody can
-- set is_superadmin on themselves through the public API. (The main app only writes these.)
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, first_name, last_name, avatar_path, updated_at) on public.profiles to authenticated;
grant update (id, first_name, last_name, avatar_path, updated_at) on public.profiles to authenticated;

-- Don't reveal who the admins are: public reads can't see is_superadmin.
revoke select on public.profiles from anon, authenticated;
grant select (id, first_name, last_name, avatar_path, created_at, updated_at) on public.profiles
  to anon, authenticated;

-- 2. Is the current user a superadmin? security definer so it can read the hidden column;
-- it only ever answers for the caller.
create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_superadmin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke execute on function public.is_superadmin() from public, anon;
grant execute on function public.is_superadmin() to authenticated;

-- 3. Admin-only policies, added on top of the main app's policies.

-- Ratings: superadmins can read everyone's reactions (users still only see their own).
drop policy if exists "Superadmins can view all votes" on public.caption_votes;
create policy "Superadmins can view all votes"
  on public.caption_votes for select
  to authenticated
  using ((select public.is_superadmin()));

-- AI generated media: superadmins can create, edit and delete generations and captions.
drop policy if exists "Superadmins can create generations" on public.generations;
create policy "Superadmins can create generations"
  on public.generations for insert
  to authenticated
  with check ((select public.is_superadmin()) and user_id = (select auth.uid()));

drop policy if exists "Superadmins can edit generations" on public.generations;
create policy "Superadmins can edit generations"
  on public.generations for update
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins can delete generations" on public.generations;
create policy "Superadmins can delete generations"
  on public.generations for delete
  to authenticated
  using ((select public.is_superadmin()));

drop policy if exists "Superadmins can create captions" on public.captions;
create policy "Superadmins can create captions"
  on public.captions for insert
  to authenticated
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins can edit captions" on public.captions;
create policy "Superadmins can edit captions"
  on public.captions for update
  to authenticated
  using ((select public.is_superadmin()))
  with check ((select public.is_superadmin()));

drop policy if exists "Superadmins can delete captions" on public.captions;
create policy "Superadmins can delete captions"
  on public.captions for delete
  to authenticated
  using ((select public.is_superadmin()));

-- Photos: superadmins can delete any uploaded photo (e.g. when deleting a generation).
drop policy if exists "Superadmins can delete any upload" on storage.objects;
create policy "Superadmins can delete any upload"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'uploads' and (select public.is_superadmin()));

-- 4. Users list for the admin area, including sign-in details from auth.users.
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  first_name text,
  last_name text,
  avatar_path text,
  is_superadmin boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  generation_count bigint,
  reaction_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_superadmin() then
    raise exception 'Only superadmins can list users' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    p.first_name,
    p.last_name,
    p.avatar_path,
    coalesce(p.is_superadmin, false),
    u.created_at,
    u.last_sign_in_at,
    (select count(*) from public.generations g where g.user_id = u.id),
    (select count(*) from public.caption_votes v where v.user_id = u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
end;
$$;

revoke execute on function public.admin_list_users() from public, anon;
grant execute on function public.admin_list_users() to authenticated;

-- 5. Dashboard statistics in one call. Runs with the caller's rights (RLS applies), and
-- refuses anyone who isn't a superadmin.
create or replace function public.admin_dashboard()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not public.is_superadmin() then
    raise exception 'Only superadmins can view the dashboard' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'totals', jsonb_build_object(
      'users', (select count(*) from public.profiles),
      'generations', (select count(*) from public.generations),
      'captions', (select count(*) from public.captions),
      'reactions', (select count(*) from public.caption_votes),
      'dead', (select count(*) from public.caption_votes where reaction = 'dead'),
      'funny', (select count(*) from public.caption_votes where reaction = 'funny'),
      'cringe', (select count(*) from public.caption_votes where reaction = 'cringe'),
      'huh', (select count(*) from public.caption_votes where reaction = 'huh')
    ),

    -- Reactions per day for the last 30 days (New York time), one row per day.
    'daily', (
      select coalesce(jsonb_agg(d order by d.day), '[]'::jsonb)
      from (
        select
          days.day::date as day,
          count(v.*) filter (where v.reaction = 'dead') as dead,
          count(v.*) filter (where v.reaction = 'funny') as funny,
          count(v.*) filter (where v.reaction = 'cringe') as cringe,
          count(v.*) filter (where v.reaction = 'huh') as huh
        from generate_series(
          (now() at time zone 'America/New_York')::date - 29,
          (now() at time zone 'America/New_York')::date,
          interval '1 day'
        ) as days(day)
        left join public.caption_votes v
          on (v.created_at at time zone 'America/New_York')::date = days.day::date
        group by days.day
      ) d
    ),

    -- How each caption vibe performs.
    'vibes', (
      select coalesce(jsonb_agg(x order by x.avg_score desc), '[]'::jsonb)
      from (
        select
          g.vibe,
          count(distinct g.id) as generations,
          count(c.id) as captions,
          coalesce(sum(c.dead_count + c.funny_count + c.cringe_count + c.huh_count), 0) as reactions,
          coalesce(sum(c.dead_count), 0) as dead,
          coalesce(sum(c.funny_count), 0) as funny,
          coalesce(sum(c.cringe_count), 0) as cringe,
          coalesce(sum(c.huh_count), 0) as huh,
          coalesce(round(avg(c.score)::numeric, 2), 0) as avg_score
        from public.generations g
        left join public.captions c on c.generation_id = g.id
        group by g.vibe
      ) x
    ),

    -- Activity by hour of day (New York time).
    'hourly', (
      select jsonb_agg(h order by h.hour)
      from (
        select
          hours.hour,
          (select count(*) from public.caption_votes v
            where extract(hour from v.created_at at time zone 'America/New_York') = hours.hour) as reactions,
          (select count(*) from public.generations g
            where extract(hour from g.created_at at time zone 'America/New_York') = hours.hour) as generations
        from generate_series(0, 23) as hours(hour)
      ) h
    ),

    -- Which Gemini model actually wrote the captions.
    'models', (
      select coalesce(jsonb_agg(m order by m.generations desc), '[]'::jsonb)
      from (
        select model, count(*) as generations from public.generations group by model
      ) m
    ),

    'top_creators', (
      select coalesce(jsonb_agg(t), '[]'::jsonb)
      from (
        select user_id, first_name, last_name, avatar_path, generation_count, total_score
        from public.creator_leaderboard
        order by total_score desc, generation_count desc
        limit 5
      ) t
    ),

    'top_reactors', (
      select coalesce(jsonb_agg(t), '[]'::jsonb)
      from (
        select p.id as user_id, p.first_name, p.last_name, p.avatar_path, count(*) as reactions
        from public.caption_votes v
        join public.profiles p on p.id = v.user_id
        group by p.id
        order by reactions desc
        limit 5
      ) t
    ),

    'most_dead', (
      select coalesce(jsonb_agg(t), '[]'::jsonb)
      from (
        select c.id, c.text, c.dead_count as count, c.generation_id, g.image_path
        from public.captions c join public.generations g on g.id = c.generation_id
        where c.dead_count > 0
        order by c.dead_count desc, c.created_at desc
        limit 5
      ) t
    ),

    'most_confusing', (
      select coalesce(jsonb_agg(t), '[]'::jsonb)
      from (
        select c.id, c.text, c.huh_count as count, c.generation_id, g.image_path
        from public.captions c join public.generations g on g.id = c.generation_id
        where c.huh_count > 0
        order by c.huh_count desc, c.created_at desc
        limit 5
      ) t
    ),

    -- Divisive: lots of 💀 and lots of 😬 on the same caption.
    'most_divisive', (
      select coalesce(jsonb_agg(t), '[]'::jsonb)
      from (
        select c.id, c.text, c.dead_count as dead, c.cringe_count as cringe, c.generation_id, g.image_path
        from public.captions c join public.generations g on g.id = c.generation_id
        where c.dead_count > 0 and c.cringe_count > 0
        order by least(c.dead_count, c.cringe_count) desc, c.dead_count + c.cringe_count desc
        limit 5
      ) t
    )
  ) into result;

  return result;
end;
$$;

revoke execute on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;

commit;

-- 6. BOOTSTRAP: make yourself the first superadmin. The SQL Editor runs as the database
-- owner, so RLS and the column lock above don't apply here. Replace the email, then run:
--
-- update public.profiles set is_superadmin = true
-- where id = (select id from auth.users where email = 'YOUR_EMAIL@gmail.com');
