-- DRAFT ONLY: review before running in the dedicated Wedding Supabase project.
-- Do not run this in Pindara Finance or any unrelated Supabase project.

create extension if not exists pgcrypto;

create table if not exists public.wedding_rsvp (
    id uuid primary key default gen_random_uuid(),
    guest_name text not null
        check (char_length(btrim(guest_name)) between 1 and 80),
    attendance text not null
        check (attendance in ('attending', 'not-attending')),
    guest_count integer,
    message text
        check (message is null or char_length(btrim(message)) between 1 and 1500),
    created_at timestamptz not null default now(),
    constraint wedding_rsvp_guest_count_check check (
        (attendance = 'attending' and guest_count between 1 and 2)
        or
        (attendance = 'not-attending' and guest_count is null)
    )
);

create table if not exists public.wedding_wishes (
    id uuid primary key default gen_random_uuid(),
    guest_name text not null
        check (char_length(btrim(guest_name)) between 1 and 80),
    message text not null
        check (char_length(btrim(message)) between 1 and 1500),
    created_at timestamptz not null default now()
);

alter table public.wedding_rsvp enable row level security;
alter table public.wedding_wishes enable row level security;

revoke all on table public.wedding_rsvp from anon, authenticated;
revoke all on table public.wedding_wishes from anon, authenticated;

grant insert on table public.wedding_rsvp to anon;
grant insert, select on table public.wedding_wishes to anon;

drop policy if exists "Public guests can submit wedding RSVP" on public.wedding_rsvp;
create policy "Public guests can submit wedding RSVP"
on public.wedding_rsvp
for insert
to anon
with check (
    char_length(btrim(guest_name)) between 1 and 80
    and attendance in ('attending', 'not-attending')
    and (
        (attendance = 'attending' and guest_count between 1 and 2)
        or
        (attendance = 'not-attending' and guest_count is null)
    )
    and (message is null or char_length(btrim(message)) between 1 and 1500)
);

drop policy if exists "Public guests can submit wedding wishes" on public.wedding_wishes;
create policy "Public guests can submit wedding wishes"
on public.wedding_wishes
for insert
to anon
with check (
    char_length(btrim(guest_name)) between 1 and 80
    and char_length(btrim(message)) between 1 and 1500
);

drop policy if exists "Public guests can read wedding wishes" on public.wedding_wishes;
create policy "Public guests can read wedding wishes"
on public.wedding_wishes
for select
to anon
using (true);

-- No UPDATE or DELETE grants/policies are provided to anon or authenticated.
