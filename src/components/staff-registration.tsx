'use client';
import {createClient} from '@supabase/supabase-js';
import {useMemo,useState,type FormEvent} from 'react';
export default function StaffRegistration({url,anonKey}:{url:string;anonKey:string}){
 const client=useMemo(()=>url&&anonKey?createClient(url,anonKey):null,[url,anonKey]);
 const [recovery,setRecovery]=useState(false),[name,setName]=useState(''),[email,setEmail]=useState(''),[department,setDepartment]=useState('therapy'),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 async function submit(event:FormEvent){event.preventDefault();if(busy||!client)return;setError('');setMessage('');
  if(!recovery&&(password.length<12||password!==confirmation)){setError('12文字以上のパスワードを入力し、確認用と一致させてください。');return;}
  setBusy(true);try{
   const redirect=`${window.location.origin}/auth/setup`;
   if(recovery){const {error:e}=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:redirect});if(e)throw e;setMessage('登録済みの場合、パスワード設定メールを送信しました。最新のメールをご確認ください。');}
   else{const {error:e}=await client.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:redirect,data:{display_name:name.trim(),requested_department:department}}});if(e)throw e;setPassword('');setConfirmation('');setMessage('登録を受け付けました。確認メールのリンクを開き、管理者へ部門の利用承認を依頼してください。登録だけでは応募者情報を閲覧できません。');}
  }catch{setError('受け付けできませんでした。入力内容をご確認ください。すでに招待済みの方は「パスワード設定メール」をご利用ください。短時間に送った場合は少し時間を空けてお試しください。');}finally{setBusy(false);}
 }
 return <main className="login"><div className="brand">ITO 採用管理<small>スタッフアカウント</small></div><h1>{recovery?'パスワード設定メール':'スタッフ新規登録'}</h1><p>{recovery?'招待メールを受け取った方・パスワードを忘れた方はこちら。':'メール確認後、管理者が部門と権限を設定します。'}</p><form onSubmit={submit}>
 {!recovery&&<><label>お名前<input required maxLength={100} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label><label>所属部門<select value={department} onChange={e=>setDepartment(e.target.value)}><option value="therapy">療術部門</option><option value="welfare">GH部門</option></select></label></>}
 <label>メールアドレス<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
 {!recovery&&<><label>パスワード（12文字以上）<input required type="password" minLength={12} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label>パスワードをもう一度<input required type="password" minLength={12} autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label></>}
 <button className="primary" disabled={busy||!client}>{busy?'受け付けています…':recovery?'設定メールを送る':'新規登録する'}</button></form>
 {message&&<p className="banner" role="status">{message}</p>}{error&&<p className="banner error" role="alert">{error}</p>}
 <div className="section"><button disabled={busy} onClick={()=>{setRecovery(!recovery);setPassword('');setConfirmation('');setMessage('');setError('');}}>{recovery?'新規登録へ戻る':'パスワード設定メールを受け取る'}</button><p><a href="/">ログイン画面へ戻る</a></p></div></main>;
}
