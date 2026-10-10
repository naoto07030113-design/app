begin;
alter table public.applicants add column if not exists staff_reply_mode boolean not null default false;
create table if not exists public.recruiting_outbox (
 id uuid primary key,
 applicant_id uuid not null references public.applicants(id),
 staff_user_id uuid not null references auth.users(id),
 last_actor_id uuid not null references auth.users(id),
 staff_name text not null,
 target_line_user_id text not null,
 body text not null check(length(body) between 1 and 5000),
 state text not null check(state in ('sending','accepted','failed','unknown')),
 attempts integer not null default 1,
 error_code text,
 line_request_id text,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 accepted_at timestamptz,
 lease_until timestamptz
);
create unique index if not exists recruiting_outbox_one_pending_idx on public.recruiting_outbox(applicant_id) where state in ('sending','unknown');
alter table public.recruiting_outbox enable row level security;
revoke all on public.recruiting_outbox from public,anon,authenticated;
grant all on public.recruiting_outbox to service_role;
grant select(id,applicant_id,staff_name,body,state,attempts,error_code,created_at,updated_at,accepted_at) on public.recruiting_outbox to authenticated;
drop policy if exists "staff read permitted reply attempts" on public.recruiting_outbox;
create policy "staff read permitted reply attempts" on public.recruiting_outbox for select to authenticated using (
 exists(select 1 from public.applicants a join public.staff_profiles p on p.user_id=auth.uid() where a.id=recruiting_outbox.applicant_id and (p.department='admin' or p.department=a.department))
);
alter table public.messages add column if not exists staff_name text;
alter table public.messages add column if not exists send_request_id uuid references public.recruiting_outbox(id);
create unique index if not exists messages_send_request_unique on public.messages(send_request_id) where send_request_id is not null;
create or replace function public.recruiting_reserve_staff_reply(p_id uuid,p_applicant_id uuid,p_actor_id uuid,p_body text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.applicants; p public.staff_profiles; o public.recruiting_outbox; pending uuid;
begin
 select * into p from public.staff_profiles where user_id=p_actor_id;
 if not found then raise exception 'STAFF_REQUIRED';end if;
 select * into a from public.applicants where id=p_applicant_id for update;
 if not found or (p.department<>'admin' and p.department<>a.department) then raise exception 'APPLICANT_FORBIDDEN';end if;
 if a.line_user_id is null or a.line_user_id !~ '^U[0-9a-f]{32}$' then raise exception 'LINE_NOT_LINKED';end if;
 if p_body is null or length(btrim(p_body))=0 or length(p_body)>5000 then raise exception 'INVALID_TEXT';end if;
 select * into o from public.recruiting_outbox where id=p_id for update;
 if found then
 if o.applicant_id<>a.id or o.body<>p_body or o.target_line_user_id<>a.line_user_id then raise exception 'REQUEST_MISMATCH';end if;
 if o.state in ('accepted','failed') then return jsonb_build_object('result',o.state,'id',o.id,'error_code',o.error_code);end if;
 if o.created_at<clock_timestamp()-interval '23 hours' then return jsonb_build_object('result','expired','id',o.id);end if;
 if o.lease_until>clock_timestamp() then return jsonb_build_object('result','in_progress','id',o.id);end if;
 update public.recruiting_outbox set state='sending',attempts=attempts+1,last_actor_id=p_actor_id,updated_at=clock_timestamp(),lease_until=clock_timestamp()+interval '2 minutes' where id=o.id returning * into o;
 else
 select id into pending from public.recruiting_outbox where applicant_id=a.id and state in ('sending','unknown');
 if pending is not null then return jsonb_build_object('result','pending_other','id',pending);end if;
 insert into public.recruiting_outbox(id,applicant_id,staff_user_id,last_actor_id,staff_name,target_line_user_id,body,state,lease_until)
 values(p_id,a.id,p_actor_id,p_actor_id,coalesce(nullif(p.display_name,''),'採用担当者'),a.line_user_id,p_body,'sending',clock_timestamp()+interval '2 minutes') returning * into o;
 end if;
 update public.applicants set staff_reply_mode=true,
 intake_state=case when o.attempts>1 then intake_state else
 (jsonb_set(coalesce(intake_state,'{"version":1,"answers":{}}'::jsonb),'{mode}','"human"'::jsonb,true)-'screen'-'contactReturn') ||
 case when p_body='ご相談ありがとうございます。
担当者からのお返事は、どの方法がよいですか？
電話・メール・LINEから選んでください。電話やメールを選んだ方には、続けて連絡先をお聞きします。' then '{"screen":"contact-method","contactReturn":"manual"}'::jsonb else '{}'::jsonb end end,
 intake_revision=intake_revision+1,
 status=case when status in ('new','ai_handling') then 'human_review' else status end,
 updated_at=clock_timestamp() where id=a.id;
 return jsonb_build_object('result','send','id',o.id,'target',o.target_line_user_id,'body',o.body,'retry',o.attempts>1);
end;$$;
create or replace function public.recruiting_finish_staff_reply(p_id uuid,p_state text,p_error_code text,p_line_request_id text)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare o public.recruiting_outbox;
begin
 if p_state not in ('accepted','failed','unknown') then raise exception 'INVALID_STATE';end if;
 select * into o from public.recruiting_outbox where id=p_id;
 if not found then raise exception 'REQUEST_NOT_FOUND';end if;
 perform 1 from public.applicants where id=o.applicant_id for update;
 select * into o from public.recruiting_outbox where id=p_id for update;
 if o.state='accepted' then return 'accepted';end if;
 update public.recruiting_outbox set state=p_state,error_code=case when p_state='accepted' then null else left(p_error_code,100) end,
 line_request_id=left(p_line_request_id,200),updated_at=clock_timestamp(),
 accepted_at=case when p_state='accepted' then clock_timestamp() else null end,
 lease_until=case when p_state='unknown' then clock_timestamp()+interval '10 seconds' else null end where id=p_id;
 if p_state='failed' then
 update public.applicants set intake_state=intake_state-'screen'-'contactReturn',updated_at=clock_timestamp() where id=o.applicant_id and intake_state->>'screen'='contact-method' and intake_state->>'contactReturn'='manual';
 end if;
 if p_state='accepted' then
 insert into public.messages(applicant_id,direction,channel,body,staff_name,send_request_id) values(o.applicant_id,'outbound','line_staff',o.body,o.staff_name,o.id)
 on conflict(send_request_id) where send_request_id is not null do nothing;
 update public.applicants set updated_at=clock_timestamp() where id=o.applicant_id;
 end if;
 return p_state;
end;$$;
create or replace function public.recruiting_commit_manual_turn(p_applicant_id uuid,p_revision integer,p_event_id text,p_inbound text,p_state jsonb default null,p_outbound text default null)
returns text language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.applicants;
begin
 select * into a from public.applicants where id=p_applicant_id for update;
 if not found then raise exception 'APPLICANT_NOT_FOUND';end if;
 if exists(select 1 from public.recruiting_events where event_id=p_event_id) then return 'duplicate';end if;
 if not a.staff_reply_mode or a.intake_revision<>p_revision then return 'conflict';end if;
 insert into public.recruiting_events(event_id,applicant_id) values(p_event_id,p_applicant_id);
 update public.applicants set intake_state=coalesce(p_state,intake_state),intake_revision=intake_revision+1,updated_at=clock_timestamp() where id=p_applicant_id;
 insert into public.messages(applicant_id,direction,channel,body) values(p_applicant_id,'inbound','line',p_inbound);
 if p_outbound is not null then insert into public.messages(applicant_id,direction,channel,body) values(p_applicant_id,'outbound','line',p_outbound);end if;
 return 'committed';
end;$$;
create or replace function public.recruiting_resume_auto(p_applicant_id uuid,p_expected_updated_at timestamptz)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.applicants; p public.staff_profiles;
begin
 select * into p from public.staff_profiles where user_id=auth.uid();
 if not found then raise exception 'STAFF_REQUIRED';end if;
 select * into a from public.applicants where id=p_applicant_id for update;
 if not found or (p.department<>'admin' and p.department<>a.department) then raise exception 'APPLICANT_FORBIDDEN';end if;
 if a.updated_at is distinct from p_expected_updated_at then raise exception 'EDIT_CONFLICT';end if;
 if a.status not in ('new','ai_handling','human_review') then raise exception 'MANAGED_STATUS';end if;
 if exists(select 1 from public.recruiting_outbox where applicant_id=a.id and state in ('sending','unknown')) then raise exception 'REPLY_PENDING';end if;
 update public.applicants set staff_reply_mode=false,
 intake_state=(jsonb_set(coalesce(intake_state,'{"version":1,"answers":{}}'::jsonb),'{mode}','"intake"'::jsonb,true)-'screen'),
 intake_revision=intake_revision+1,updated_at=clock_timestamp() where id=a.id returning * into a;
 insert into public.messages(applicant_id,direction,channel,body) values(a.id,'internal','admin','自動受付を再開 / 担当ID：'||auth.uid()::text);
 return jsonb_build_object('applicant',to_jsonb(a));
end;$$;
revoke all on function public.recruiting_reserve_staff_reply(uuid,uuid,uuid,text),public.recruiting_finish_staff_reply(uuid,text,text,text),public.recruiting_commit_manual_turn(uuid,integer,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.recruiting_reserve_staff_reply(uuid,uuid,uuid,text),public.recruiting_finish_staff_reply(uuid,text,text,text),public.recruiting_commit_manual_turn(uuid,integer,text,text,jsonb,text) to service_role;
revoke all on function public.recruiting_resume_auto(uuid,timestamptz) from public,anon;
grant execute on function public.recruiting_resume_auto(uuid,timestamptz) to authenticated;
commit;
