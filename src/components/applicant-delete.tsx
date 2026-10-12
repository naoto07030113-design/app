'use client';
import {useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Applicant} from '@/lib/recruiting-admin';

export default function ApplicantDelete({applicant,client,demo,disabled,onBusy,onDeleteDemo,onDeleted}:{applicant:Applicant;client:SupabaseClient|null;demo:boolean;disabled:boolean;onBusy:(busy:boolean)=>void;onDeleteDemo:()=>void;onDeleted:()=>void}){
 const [confirm,setConfirm]=useState(false),[text,setText]=useState(''),[error,setError]=useState(''),[sending,setSending]=useState(false);
 const lock=useRef(false);
 const expected=applicant.display_name?.trim()?applicant.display_name:'完全削除';
 async function remove(){
  if(lock.current||disabled||text!==expected)return;
  lock.current=true;setSending(true);onBusy(true);setError('');
  try{
   if(demo)onDeleteDemo();
   else{
    const session=await client?.auth.getSession();const token=session?.data.session?.access_token;
    if(!token)throw new Error('AUTH_REQUIRED');
    const response=await fetch('/api/applicants/delete',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({applicantId:applicant.id,expectedUpdatedAt:applicant.updated_at,confirmation:text}),signal:AbortSignal.timeout(20000)});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'DELETE_UNAVAILABLE');
    if(result.result!=='deleted')throw new Error('DELETE_UNAVAILABLE');
   }
   onDeleted();
  }catch(e){
   const code=String((e as Error).message);
   setError(code==='FORBIDDEN'?'完全削除は全社管理者のみ操作できます。':code==='AUTH_REQUIRED'?'ログインし直してから操作してください。':code==='EDIT_CONFLICT'?'応募者が更新されています。詳細を閉じ、一覧を更新してから内容を確認してください。':code==='REPLY_PENDING'?'LINE返信が送信中、または送信結果の確認待ちです。結果を確認してから削除してください。':code==='CONFIRMATION_MISMATCH'?'表示されている確認文字を、そのまま入力してください。':code==='APPLICANT_NOT_FOUND'?'この応募者はすでに削除されています。詳細を閉じて一覧を更新してください。':'削除結果を確認できませんでした。詳細を閉じ、一覧を更新して応募者が残っているか確認してください。');
  }finally{lock.current=false;setSending(false);onBusy(false);}
 }
 return <section className="section" aria-labelledby="delete-title"><h3 id="delete-title">応募者を完全削除する</h3><p>応募者情報、会話履歴、社内記録、LINE送信記録を削除します。削除後は、このシステムから復元できません。</p>{applicant.source==='line'&&<p className="muted">LINE側のトークは削除されません。同じ方からLINEが届くと、新しい応募者として登録されます。</p>}{!confirm?<button type="button" className="quiet-danger" disabled={disabled} onClick={()=>{setConfirm(true);setText('');setError('');}}>完全削除の確認へ進む</button>:<div role="group" aria-label="応募者の完全削除の確認"><p>削除対象：<strong>{applicant.display_name||'氏名未取得の応募者'}</strong><br/>応募者ID：{applicant.id}</p><label>確認のため「{expected}」を入力してください<input autoComplete="off" value={text} maxLength={200} disabled={disabled||sending} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}}/></label>{error&&<p className="banner error" role="alert">{error}</p>}<div className="actions"><button type="button" disabled={disabled||sending} onClick={()=>{setConfirm(false);setText('');setError('');}}>削除を取り消す</button><button type="button" className="quiet-danger" disabled={disabled||sending||text!==expected} onClick={()=>void remove()}>{sending?'削除しています…':'応募者と関連記録を完全削除する'}</button></div></div>}</section>;
}
