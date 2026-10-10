'use client';

import {createClient} from '@supabase/supabase-js';
import {useEffect, useMemo, useState, type FormEvent} from 'react';

export default function AccountSetup({url,anonKey}:{url:string;anonKey:string}) {
  const client=useMemo(()=>url&&anonKey?createClient(url,anonKey):null,[url,anonKey]);
  const [ready,setReady]=useState(false);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;
    if(!client){setError('接続設定を確認できません。管理者へお知らせください。');return;}
    void client.auth.getUser().then(({data,error:authError})=>{
      if(!active)return;
      if(authError||!data.user){setError('招待メールのリンクから開いてください。期限が切れた場合は再招待を依頼してください。');return;}
      setEmail(data.user.email??'');setReady(true);
    }).catch(()=>{if(active)setError('接続できませんでした。もう一度開いてください。');});
    return()=>{active=false;};
  },[client]);
  async function save(event:FormEvent){
    event.preventDefault();if(!client||busy||!ready)return;
    if(password.length<12){setError('パスワードは12文字以上で設定してください。');return;}
    if(password!==confirmation){setError('確認用パスワードが一致していません。');return;}
    setBusy(true);setError('');
    try{
      const {error:saveError}=await client.auth.updateUser({password});
      if(saveError){setError('設定できませんでした。パスワードの条件や招待リンクの期限をご確認ください。');return;}
      setPassword('');setConfirmation('');setDone(true);
    }catch{setError('接続できませんでした。再度お試しください。');}finally{setBusy(false);}
  }
  return <main style={{minHeight:'100dvh',display:'grid',placeItems:'center',padding:24,background:'#e8f5f1'}}><section style={{width:'100%',maxWidth:460,background:'white',padding:28,borderRadius:24,boxShadow:'0 12px 40px #193e351a'}}>
    <p>ITO 採用管理</p><h1>{done?'ログインの準備ができました':'はじめてのログイン設定'}</h1>
    {done?<><p>次回からメールアドレスと設定したパスワードでログインできます。</p><a href="/" className="primary" style={{display:'inline-flex',minHeight:44,alignItems:'center'}}>採用管理を開く</a></>:<><p>招待されたアカウント：{email||'確認中'}</p><p>パスワードはこの画面でご自身で設定してください。</p><form onSubmit={save}>
      <label style={{display:'block',marginBottom:16}}>新しいパスワード<input style={{width:'100%',minHeight:44,marginTop:8}} type="password" autoComplete="new-password" minLength={12} required disabled={!ready||busy} value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <label style={{display:'block',marginBottom:16}}>パスワードをもう一度<input style={{width:'100%',minHeight:44,marginTop:8}} type="password" autoComplete="new-password" minLength={12} required disabled={!ready||busy} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
      <button className="primary" style={{minHeight:44}} disabled={!ready||busy}>{busy?'設定しています…':'パスワードを設定する'}</button>
    </form></>}{error&&<p role="alert" style={{color:'#a22525'}}>{error}</p>}
  </section></main>;
}
