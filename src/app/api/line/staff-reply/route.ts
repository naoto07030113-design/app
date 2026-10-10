import {getSupabaseAdmin} from '@/lib/supabase-admin';
import {processStaffReply,pushStaffText,validateStaffReply,type Reservation} from '@/lib/line-staff-send';
export const runtime='nodejs';
export const maxDuration=30;
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return json({error:'ORIGIN_FORBIDDEN'},403);
 const bearer=request.headers.get('authorization');
 if(!bearer?.startsWith('Bearer ')||bearer.length>10000)return json({error:'AUTH_REQUIRED'},401);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'INVALID_BODY'},400);
 let admin:ReturnType<typeof getSupabaseAdmin>;
 try{admin=getSupabaseAdmin();}catch{return json({error:'NOT_CONFIGURED'},503);}
 try{
 const {data:{user},error:authError}=await admin.auth.getUser(bearer.slice(7));
 if(authError||!user)return json({error:'AUTH_REQUIRED'},401);
 const raw=await request.text();if(raw.length>25000)return json({error:'INVALID_BODY'},400);
 let value:unknown;try{value=JSON.parse(raw);}catch{return json({error:'INVALID_BODY'},400);}
 const input=validateStaffReply(value);if(!input)return json({error:'INVALID_BODY'},400);
 const result=await processStaffReply(input,user.id,{
 reserve:async(id,applicantId,actorId,text)=>{const {data,error}=await admin.rpc('recruiting_reserve_staff_reply',{p_id:id,p_applicant_id:applicantId,p_actor_id:actorId,p_body:text});if(error)throw error;return data as Reservation;},
 finish:async(id,state,code,lineRequestId)=>{const {error}=await admin.rpc('recruiting_finish_staff_reply',{p_id:id,p_state:state,p_error_code:code,p_line_request_id:lineRequestId});if(error)throw error;},
 },pushStaffText);
 return json(result);
 }catch(e){
 const code=String((e as Error).message);
 if(/STAFF_REQUIRED|APPLICANT_FORBIDDEN/.test(code))return json({error:'FORBIDDEN'},403);
 if(/LINE_NOT_LINKED/.test(code))return json({error:'LINE_NOT_LINKED'},409);
 if(/REQUEST_MISMATCH/.test(code))return json({error:'REQUEST_MISMATCH'},409);
 if(/INVALID_TEXT/.test(code))return json({error:'INVALID_BODY'},400);
 return json({error:'SEND_UNAVAILABLE'},503);
 }
}
