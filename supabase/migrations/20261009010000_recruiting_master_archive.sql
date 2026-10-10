begin;
alter table public.applicants add column if not exists archived_at timestamptz;
grant select(archived_at) on public.applicants to authenticated;
create table if not exists public.recruiting_catalogs (
 department text primary key check(department in ('therapy','welfare')),
 media jsonb not null,
 jobs jsonb not null,
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.recruiting_catalogs enable row level security;
grant select,insert,update on public.recruiting_catalogs to authenticated;
create policy "staff read own catalogs" on public.recruiting_catalogs for select to authenticated using(exists(select 1 from public.staff_profiles p where p.user_id=auth.uid() and (p.department='admin' or p.department=recruiting_catalogs.department)));
create policy "admin insert catalogs" on public.recruiting_catalogs for insert to authenticated with check(exists(select 1 from public.staff_profiles p where p.user_id=auth.uid() and p.department='admin'));
create policy "admin update catalogs" on public.recruiting_catalogs for update to authenticated using(exists(select 1 from public.staff_profiles p where p.user_id=auth.uid() and p.department='admin')) with check(exists(select 1 from public.staff_profiles p where p.user_id=auth.uid() and p.department='admin'));
insert into public.recruiting_catalogs(department,media,jobs) values
 ('therapy','["LINE","ベイネット","ハローワーク","engage","Timee","紹介","不明"]','[{"name":"施術","open":false},{"name":"受付","open":false},{"name":"訪問マッサージ","open":false},{"name":"その他","open":false}]'),
 ('welfare','["LINE","ベイネット","ハローワーク","engage","Timee","紹介","不明"]','[{"name":"生活支援・夜間見守り","open":false},{"name":"世話人","open":false},{"name":"介護・送迎","open":false},{"name":"夜勤専従","open":false},{"name":"調理","open":false},{"name":"看護師","open":false},{"name":"機能訓練指導員","open":false},{"name":"サービス管理責任者","open":false},{"name":"介護","open":false},{"name":"その他","open":false}]') on conflict(department) do nothing;
create or replace function public.recruiting_save_catalog(p_department text,p_expected_updated_at timestamptz,p_media jsonb,p_jobs jsonb,p_rename jsonb default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_old public.recruiting_catalogs;v_kind text;v_from text;v_to text;v_name text;
begin
 if not exists(select 1 from public.staff_profiles where user_id=auth.uid() and department='admin') then raise exception 'STAFF_REQUIRED';end if;
 if p_department not in ('therapy','welfare') then raise exception 'DEPARTMENT_FORBIDDEN';end if;
 if jsonb_typeof(p_media)<>'array' or jsonb_typeof(p_jobs)<>'array' then raise exception 'INVALID_PAYLOAD';end if;
 if jsonb_array_length(p_media) not between 1 and 100 or jsonb_array_length(p_jobs) not between 1 and 100 then raise exception 'INVALID_LENGTH';end if;
 if exists(select 1 from jsonb_array_elements(p_media) x where jsonb_typeof(x)<>'string' or length(btrim(x#>>'{}')) not between 1 and 200 or btrim(x#>>'{}')<>x#>>'{}') or exists(select 1 from jsonb_array_elements(p_jobs) x where jsonb_typeof(x)<>'object' or jsonb_typeof(x->'name') is distinct from 'string' or jsonb_typeof(x->'open') is distinct from 'boolean' or length(btrim(x->>'name')) not between 1 and 200 or btrim(x->>'name')<>x->>'name') then raise exception 'INVALID_PAYLOAD';end if;
 if (select count(distinct x#>>'{}') from jsonb_array_elements(p_media) x)<>jsonb_array_length(p_media) or (select count(distinct x->>'name') from jsonb_array_elements(p_jobs) x)<>jsonb_array_length(p_jobs) then raise exception 'INVALID_DUPLICATE';end if;
 select * into v_old from public.recruiting_catalogs where department=p_department for update;
 if not found then raise exception 'CATALOG_NOT_FOUND';end if;
 if p_expected_updated_at is null or v_old.updated_at<>p_expected_updated_at then raise exception 'EDIT_CONFLICT';end if;
 if p_rename is not null then
  v_kind:=p_rename->>'kind';v_from:=p_rename->>'oldName';v_to:=p_rename->>'newName';
  if v_kind is null or v_kind not in ('media','job') or v_from is null or v_to is null or v_from=v_to then raise exception 'INVALID_RENAME';end if;
  if v_kind='media' and (not v_old.media ? v_from or v_old.media ? v_to or p_media ? v_from or not p_media ? v_to) then raise exception 'INVALID_RENAME';end if;
  if v_kind='job' and (not exists(select 1 from jsonb_array_elements(v_old.jobs) j where j->>'name'=v_from) or exists(select 1 from jsonb_array_elements(v_old.jobs) j where j->>'name'=v_to) or exists(select 1 from jsonb_array_elements(p_jobs) j where j->>'name'=v_from) or not exists(select 1 from jsonb_array_elements(p_jobs) j where j->>'name'=v_to)) then raise exception 'INVALID_RENAME';end if;
 end if;
 perform id from public.applicants where department=p_department order by id for update;
 for v_name in select jsonb_array_elements_text(v_old.media) loop
  if not p_media ? v_name and not coalesce(v_kind='media' and v_from=v_name,false) then
   if exists(select 1 from public.applicants a where department=p_department and coalesce(nullif(a.recruitment_media,''),substring(a.admin_note from '旧媒体：([^\n]+?) / 旧選考状況：'),case when source='line' then 'LINE' when source='legacy' then '旧アプリ（媒体未設定）' else '手動登録' end)=v_name) then raise exception 'MASTER_IN_USE';end if;
  end if;
 end loop;
 for v_name in select j->>'name' from jsonb_array_elements(v_old.jobs) j loop
  if not exists(select 1 from jsonb_array_elements(p_jobs) j where j->>'name'=v_name) and not coalesce(v_kind='job' and v_from=v_name,false) then
   if exists(select 1 from public.applicants a where department=p_department and coalesce(nullif(a.desired_job,''),a.intake_state->'answers'->>'role','職種相談中')=v_name) then raise exception 'MASTER_IN_USE';end if;
  end if;
 end loop;
 if v_kind='media' then
  update public.applicants a set recruitment_media=v_to,updated_at=clock_timestamp() where department=p_department and coalesce(nullif(a.recruitment_media,''),substring(a.admin_note from '旧媒体：([^\n]+?) / 旧選考状況：'),case when source='line' then 'LINE' when source='legacy' then '旧アプリ（媒体未設定）' else '手動登録' end)=v_from;
 elsif v_kind='job' then
  update public.applicants a set desired_job=v_to,updated_at=clock_timestamp() where department=p_department and coalesce(nullif(a.desired_job,''),a.intake_state->'answers'->>'role','職種相談中')=v_from;
 end if;
 update public.recruiting_catalogs set media=p_media,jobs=p_jobs,updated_at=clock_timestamp() where department=p_department returning * into v_old;
 return to_jsonb(v_old);
end;$$;
revoke all on function public.recruiting_save_catalog(text,timestamptz,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.recruiting_save_catalog(text,timestamptz,jsonb,jsonb,jsonb) to authenticated;
create or replace function public.recruiting_archive_applicant(p_id uuid,p_expected_updated_at timestamptz,p_archive boolean)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_row public.applicants;v_role text;
begin
 select department into v_role from public.staff_profiles where user_id=auth.uid();if v_role is null then raise exception 'STAFF_REQUIRED';end if;
 select * into v_row from public.applicants where id=p_id for update;
 if not found then raise exception 'APPLICANT_NOT_FOUND';end if;
 if v_role<>'admin' and v_role<>v_row.department then raise exception 'DEPARTMENT_FORBIDDEN';end if;
 if v_row.line_user_id is not null or v_row.source='line' then raise exception 'LINE_APPLICANT_KEEP';end if;
 if p_archive is null then raise exception 'INVALID_PAYLOAD';end if;
 if p_expected_updated_at is null or v_row.updated_at<>p_expected_updated_at then raise exception 'EDIT_CONFLICT';end if;
 update public.applicants set archived_at=case when p_archive then clock_timestamp() else null end,updated_at=clock_timestamp() where id=p_id returning * into v_row;
 insert into public.messages(applicant_id,direction,channel,body) values(p_id,'internal','admin',case when p_archive then '応募者を保管' else '応募者を一覧へ戻す' end||' / 担当ID：'||auth.uid()::text);
 return jsonb_build_object('result','saved');
end;$$;
revoke all on function public.recruiting_archive_applicant(uuid,timestamptz,boolean) from public,anon;
grant execute on function public.recruiting_archive_applicant(uuid,timestamptz,boolean) to authenticated;
commit;
