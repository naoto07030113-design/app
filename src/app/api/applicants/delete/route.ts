import {getSupabaseAdmin} from '@/lib/supabase-admin';
export const runtime='nodejs';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return json({error:'ORIGIN_FORBIDDEN'},403);
 const bearer=request.headers.get('authorization');
 if(!bearer?.startsWith('Bearer ')||bearer.length>10000)return json({error:'AUTH_REQUIRED'},401);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'INVALID_BODY'},400);
 try{
  const admin=getSupabaseAdmin();
  const {data:{user},error:authError}=await admin.auth.getUser(bearer.slice(7));
  if(authError||!user)return json({error:'AUTH_REQUIRED'},401);
  const {data:staff,error:staffError}=await admin.from('staff_profiles').select('department').eq('user_id',user.id).single();
  if(staffError||staff?.department!=='admin')return json({error:'FORBIDDEN'},403);
  const raw=await request.text();if(raw.length>3000)return json({error:'INVALID_BODY'},400);
  let v:Record<string,unknown>;try{v=JSON.parse(raw);}catch{return json({error:'INVALID_BODY'},400);}
  if(!v||Array.isArray(v)||typeof v!=='object'||Object.keys(v).some(k=>!['applicantId','expectedUpdatedAt','confirmation'].includes(k)))return json({error:'INVALID_BODY'},400);
  if(typeof v.applicantId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.applicantId)||typeof v.expectedUpdatedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(v.expectedUpdatedAt)||!Number.isFinite(Date.parse(v.expectedUpdatedAt))||typeof v.confirmation!=='string'||!v.confirmation||v.confirmation.length>200)return json({error:'INVALID_BODY'},400);
  const {data,error}=await admin.rpc('recruiting_delete_applicant',{p_id:v.applicantId,p_actor_id:user.id,p_expected_updated_at:v.expectedUpdatedAt,p_confirmation:v.confirmation});
  if(error)throw error;
  if(data?.result!=='deleted')throw new Error('DELETE_UNAVAILABLE');
  return json({result:'deleted'});
 }catch(e){
  const message=String((e as Error).message);
  const code=['EDIT_CONFLICT','REPLY_PENDING','CONFIRMATION_MISMATCH','APPLICANT_NOT_FOUND','FORBIDDEN'].find(c=>message.includes(c));
  return json({error:code||'DELETE_UNAVAILABLE'},code==='FORBIDDEN'?403:code?409:503);
 }
}
