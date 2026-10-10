begin;
alter table public.applicants
 add column if not exists recruitment_media text not null default '',
 add column if not exists phone text not null default '',
 add column if not exists age_text text not null default '',
 add column if not exists contact_date date,
 add column if not exists appointment_date date,
 add column if not exists appointment_kind text not null default '',
 add column if not exists admin_note text not null default '',
 add column if not exists result_reason text not null default '',
 add column if not exists legacy_key text;
create unique index if not exists applicants_legacy_key_unique on public.applicants(legacy_key) where legacy_key is not null;
create index if not exists applicants_appointment_date_idx on public.applicants(appointment_date) where appointment_date is not null;
drop policy if exists "staff can insert offline applicants" on public.applicants;
create policy "staff can insert offline applicants" on public.applicants for insert to authenticated with check (
 line_user_id is null and source in ('manual','legacy') and department in ('therapy','welfare') and exists (
 select 1 from public.staff_profiles p where p.user_id=auth.uid() and (p.department='admin' or p.department=applicants.department))
);
drop policy if exists "staff can insert internal messages" on public.messages;
create policy "staff can insert internal messages" on public.messages for insert to authenticated with check (
 direction='internal' and channel='admin' and exists (
 select 1 from public.applicants a join public.staff_profiles p on p.user_id=auth.uid()
 where a.id=messages.applicant_id and (p.department='admin' or p.department=a.department))
);
create or replace function public.recruiting_save_applicant(p_id uuid,p_expected_updated_at timestamptz,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_role text; v_row public.applicants; v_id uuid; v_status text; v_department text; v_legacy text; v_previous text;
begin
 select department into v_role from public.staff_profiles where user_id=auth.uid();
 if v_role is null then raise exception 'STAFF_REQUIRED'; end if;
 if jsonb_typeof(p_payload)<>'object' then raise exception 'INVALID_PAYLOAD'; end if;
 v_status:=p_payload->>'status';v_department:=p_payload->>'department';
 if v_status is null or v_status not in ('new','human_review','tour','interview','hold','hired','rejected','withdrawn') then raise exception 'INVALID_STATUS';end if;
 if v_department is null or v_department not in ('therapy','welfare','unknown') or (v_role<>'admin' and v_role<>v_department) then raise exception 'DEPARTMENT_FORBIDDEN';end if;
 if length(coalesce(p_payload->>'display_name','')) not between 1 and 200
 or length(coalesce(p_payload->>'admin_note',''))>5000 or length(coalesce(p_payload->>'result_reason',''))>1000
 or length(coalesce(p_payload->>'recruitment_media',''))>200
 or length(coalesce(p_payload->>'phone',''))>100 or length(coalesce(p_payload->>'age_text',''))>100
 or length(coalesce(p_payload->>'desired_job',''))>200 or length(coalesce(p_payload->>'qualifications',''))>1000
 or length(coalesce(p_payload->>'desired_schedule',''))>1000 or length(coalesce(p_payload->>'appointment_kind',''))>100 then raise exception 'INVALID_LENGTH';end if;
 if p_id is not null then
 select * into v_row from public.applicants where id=p_id for update;
 if not found then raise exception 'APPLICANT_NOT_FOUND';end if;
 if p_expected_updated_at is null or v_row.updated_at<>p_expected_updated_at then raise exception 'EDIT_CONFLICT';end if;
 v_previous:=v_row.status;
 update public.applicants set display_name=p_payload->>'display_name',department=v_department,status=v_status,
 desired_job=p_payload->>'desired_job',qualifications=p_payload->>'qualifications',desired_schedule=p_payload->>'desired_schedule',
 recruitment_media=coalesce(p_payload->>'recruitment_media',recruitment_media,''),phone=coalesce(p_payload->>'phone',''),age_text=coalesce(p_payload->>'age_text',''),
 contact_date=nullif(p_payload->>'contact_date','')::date,appointment_date=nullif(p_payload->>'appointment_date','')::date,
 appointment_kind=coalesce(p_payload->>'appointment_kind',''),admin_note=coalesce(p_payload->>'admin_note',''),result_reason=coalesce(p_payload->>'result_reason',''),updated_at=clock_timestamp()
 where id=p_id returning * into v_row;
 else
 if v_department='unknown' or p_payload->>'source' is null or p_payload->>'source' not in ('manual','legacy') then raise exception 'INVALID_SOURCE';end if;
 v_legacy:=nullif(p_payload->>'legacy_key','');
 if p_payload->>'source'='legacy' and (v_legacy is null or v_legacy !~ '^planet-v1:[0-9a-f]{64}$') then raise exception 'INVALID_LEGACY_KEY';end if;
 if p_payload->>'source'='manual' then v_legacy:=null;end if;
 insert into public.applicants(display_name,department,status,source,desired_job,qualifications,desired_schedule,recruitment_media,phone,age_text,contact_date,appointment_date,appointment_kind,admin_note,result_reason,legacy_key)
 values(p_payload->>'display_name',v_department,v_status,p_payload->>'source',p_payload->>'desired_job',p_payload->>'qualifications',p_payload->>'desired_schedule',coalesce(p_payload->>'recruitment_media',''),coalesce(p_payload->>'phone',''),coalesce(p_payload->>'age_text',''),nullif(p_payload->>'contact_date','')::date,nullif(p_payload->>'appointment_date','')::date,coalesce(p_payload->>'appointment_kind',''),coalesce(p_payload->>'admin_note',''),coalesce(p_payload->>'result_reason',''),v_legacy)
 on conflict(legacy_key) where legacy_key is not null do nothing returning id into v_id;
 if v_id is null then return jsonb_build_object('result','duplicate');end if;
 select * into v_row from public.applicants where id=v_id;
 end if;
 insert into public.messages(applicant_id,direction,channel,body) values(v_row.id,'internal','admin',
 '管理画面で'||case when p_id is null then '登録' else '更新' end||' / 担当ID：'||auth.uid()::text||' / 状態：'||coalesce(v_previous,'未登録')||' → '||v_status);
 return jsonb_build_object('result','saved','applicant',to_jsonb(v_row));
end;$$;
revoke all on function public.recruiting_save_applicant(uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.recruiting_save_applicant(uuid,timestamptz,jsonb) to authenticated;
commit;
