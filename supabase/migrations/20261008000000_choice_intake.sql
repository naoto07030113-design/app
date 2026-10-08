begin;
alter table public.applicants add column if not exists intake_state jsonb;
alter table public.applicants add column if not exists intake_revision integer not null default 0;
create table if not exists public.recruiting_events (
  event_id text primary key,
  applicant_id uuid not null references public.applicants(id),
  created_at timestamptz not null default now()
);
alter table public.recruiting_events enable row level security;
revoke all on public.recruiting_events from anon, authenticated;
grant all on public.recruiting_events to service_role;

create or replace function public.recruiting_commit_turn(
  p_applicant_id uuid, p_revision integer, p_event_id text, p_state jsonb,
  p_inbound text, p_outbound text, p_department text, p_summary text, p_handoff boolean, p_apply_answers boolean
) returns text language plpgsql security invoker set search_path = public, pg_temp as $$
declare current_revision integer; current_status text;
begin
  select intake_revision, status into current_revision, current_status
    from public.applicants where id = p_applicant_id for update;
  if not found then raise exception 'Applicant missing'; end if;
  if exists (select 1 from public.recruiting_events where event_id = p_event_id) then return 'duplicate'; end if;
  if current_revision <> p_revision then return 'conflict'; end if;
  insert into public.recruiting_events(event_id, applicant_id) values(p_event_id, p_applicant_id);
  update public.applicants set intake_state = p_state, intake_revision = intake_revision + 1,
    department = case when p_apply_answers and current_status in ('new','ai_handling','human_review') then p_department else department end,
    desired_job = case when p_apply_answers and current_status in ('new','ai_handling','human_review') then p_state->'answers'->>'role' else desired_job end,
    qualifications = case when p_apply_answers and current_status in ('new','ai_handling','human_review') then p_state->'answers'->>'qualification' else qualifications end,
    desired_schedule = case when p_apply_answers and current_status in ('new','ai_handling','human_review') then concat_ws(' / ', p_state->'answers'->>'time', p_state->'answers'->>'frequency') else desired_schedule end,
    desired_start = case when p_apply_answers and current_status in ('new','ai_handling','human_review') then p_state->'answers'->>'start' else desired_start end,
    can_drive = case when p_apply_answers and current_status in ('new','ai_handling','human_review') then p_state->'answers'->>'drive' else can_drive end,
    ai_summary = case when p_apply_answers and current_status in ('new','ai_handling','human_review') then p_summary else ai_summary end,
    status = case when current_status in ('new','ai_handling','human_review') then
      case when p_handoff then 'human_review' when current_status = 'new' then 'ai_handling' else current_status end else current_status end,
    updated_at = now() where id = p_applicant_id;
  insert into public.messages(applicant_id,direction,channel,body) values
    (p_applicant_id,'inbound','line',p_inbound), (p_applicant_id,'outbound','line',p_outbound);
  return 'committed';
end $$;
revoke all on function public.recruiting_commit_turn(uuid,integer,text,jsonb,text,text,text,text,boolean,boolean) from public, anon, authenticated;
grant execute on function public.recruiting_commit_turn(uuid,integer,text,jsonb,text,text,text,text,boolean,boolean) to service_role;
commit;
