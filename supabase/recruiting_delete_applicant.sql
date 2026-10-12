begin;
create or replace function public.recruiting_delete_applicant(p_id uuid,p_actor_id uuid,p_expected_updated_at timestamptz,p_confirmation text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.applicants;
begin
 if not exists(select 1 from public.staff_profiles where user_id=p_actor_id and department='admin') then raise exception 'FORBIDDEN';end if;
 select * into a from public.applicants where id=p_id for update;
 if not found then raise exception 'APPLICANT_NOT_FOUND';end if;
 if p_expected_updated_at is null or a.updated_at is distinct from p_expected_updated_at then raise exception 'EDIT_CONFLICT';end if;
 if p_confirmation is distinct from (case when nullif(btrim(a.display_name),'') is null then '完全削除' else a.display_name end) then raise exception 'CONFIRMATION_MISMATCH';end if;
 if exists(select 1 from public.recruiting_outbox where applicant_id=a.id and state in ('sending','unknown')) then raise exception 'REPLY_PENDING';end if;
 delete from public.messages where applicant_id=a.id;
 delete from public.recruiting_events where applicant_id=a.id;
 delete from public.recruiting_outbox where applicant_id=a.id;
 delete from public.applicants where id=a.id;
 return jsonb_build_object('result','deleted');
end;$$;
revoke all on function public.recruiting_delete_applicant(uuid,uuid,timestamptz,text) from public,anon,authenticated;
grant execute on function public.recruiting_delete_applicant(uuid,uuid,timestamptz,text) to service_role;
commit;
