create extension if not exists pgcrypto;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department text not null check (department in ('welfare','therapy')),
  employment_type text,
  salary_text text,
  schedule_text text,
  location_text text,
  required_qualifications text,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.applicants (
  id uuid primary key default gen_random_uuid(),
  line_user_id text unique,
  display_name text,
  department text not null default 'unknown' check (department in ('welfare','therapy','unknown')),
  desired_job text,
  qualifications text,
  desired_schedule text,
  desired_start text,
  can_drive text,
  status text not null default 'new' check (status in ('new','ai_handling','human_review','tour','interview','hired','rejected','hold','withdrawn')),
  source text not null default 'line',
  ai_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references public.applicants(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound','internal')),
  channel text not null default 'line',
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  department text not null check (department in ('welfare','therapy','admin')),
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.jobs enable row level security;
alter table public.applicants enable row level security;
alter table public.messages enable row level security;
alter table public.staff_profiles enable row level security;

create policy "staff can read own profile"
on public.staff_profiles for select
to authenticated
using (user_id = auth.uid());

create policy "staff can read permitted jobs"
on public.jobs for select
to authenticated
using (
  exists (
    select 1 from public.staff_profiles p
    where p.user_id = auth.uid()
      and (p.department = 'admin' or p.department = jobs.department)
  )
);

create policy "staff can read permitted applicants"
on public.applicants for select
to authenticated
using (
  exists (
    select 1 from public.staff_profiles p
    where p.user_id = auth.uid()
      and (p.department = 'admin' or p.department = applicants.department)
  )
);

create policy "staff can update permitted applicants"
on public.applicants for update
to authenticated
using (
  exists (
    select 1 from public.staff_profiles p
    where p.user_id = auth.uid()
      and (p.department = 'admin' or p.department = applicants.department)
  )
)
with check (
  exists (
    select 1 from public.staff_profiles p
    where p.user_id = auth.uid()
      and (p.department = 'admin' or p.department = applicants.department)
  )
);

create policy "staff can read permitted messages"
on public.messages for select
to authenticated
using (
  exists (
    select 1
    from public.applicants a
    join public.staff_profiles p on p.user_id = auth.uid()
    where a.id = messages.applicant_id
      and (p.department = 'admin' or p.department = a.department)
  )
);

create index if not exists applicants_line_user_id_idx on public.applicants(line_user_id);
create index if not exists applicants_department_status_idx on public.applicants(department, status);
create index if not exists messages_applicant_created_idx on public.messages(applicant_id, created_at desc);
