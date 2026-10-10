import {staffMessage} from "./recruiting-contact";
export type SendResult = { status: 'accepted'|'failed'|'unknown'|'in_progress'|'pending_other'|'expired'; requestId: string; code?: string };
export type Reservation = { result: 'send'|SendResult['status']; id: string; target?: string; body?: string; error_code?: string; retry?: boolean };
export type SendStore = { reserve(id:string,applicantId:string,actorId:string,text:string):Promise<Reservation>; finish(id:string,state:'accepted'|'failed'|'unknown',code:string|null,lineRequestId:string|null):Promise<void> };
export type PushResult = {state:'accepted'|'failed'|'unknown';code:string|null;lineRequestId:string|null};
export function validateStaffReply(value:unknown):{requestId:string;applicantId:string;text:string}|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const v=value as Record<string,unknown>;
 if(Object.keys(v).some(k=>!['requestId','applicantId','text'].includes(k)))return null;
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(typeof v.requestId!=='string'||!uuid.test(v.requestId)||typeof v.applicantId!=='string'||!uuid.test(v.applicantId)||typeof v.text!=='string'||!v.text.trim()||v.text.length>5000)return null;
 return {requestId:v.requestId.toLowerCase(),applicantId:v.applicantId.toLowerCase(),text:v.text};
}
export async function processStaffReply(input:{requestId:string;applicantId:string;text:string},actorId:string,store:SendStore,push:(target:string,text:string,key:string)=>Promise<PushResult>):Promise<SendResult>{
 const reservation=await store.reserve(input.requestId,input.applicantId,actorId,input.text);
 if(reservation.result!=='send')return {status:reservation.result,requestId:reservation.id,...(reservation.error_code?{code:reservation.error_code}:{})};
 if(!reservation.target||!reservation.body)throw new Error('INVALID_RESERVATION');
 let result:PushResult;
 try{result=await push(reservation.target,reservation.body,input.requestId);}catch{result={state:'unknown',code:'NETWORK_UNKNOWN',lineRequestId:null};}
 if(reservation.retry&&result.state==='failed')result={state:'unknown',code:'RETRY_NOT_CONFIRMED',lineRequestId:result.lineRequestId};
 try{await store.finish(input.requestId,result.state,result.code,result.lineRequestId);}catch{return {status:'unknown',requestId:input.requestId,code:'RECORD_PENDING'};}
 return {status:result.state,requestId:input.requestId,...(result.code?{code:result.code}:{})};
}
export async function pushStaffText(target:string,text:string,key:string):Promise<PushResult>{
 const token=process.env.LINE_CHANNEL_ACCESS_TOKEN;
 if(!token)return {state:'failed',code:'LINE_NOT_CONFIGURED',lineRequestId:null};
 const headers={Authorization:`Bearer ${token}`};
 try{
 const responses=await Promise.all(['info','quota','quota/consumption'].map(path=>fetch(path==='info'?'https://api.line.me/v2/bot/info':`https://api.line.me/v2/bot/message/${path}`,{headers,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)})));
 if(responses.some(r=>!r.ok))return {state:'failed',code:'PREFLIGHT_FAILED',lineRequestId:null};
 const [bot,quota,usage]=await Promise.all(responses.map(r=>r.json()));
 if(bot.basicId!=='@814gpyea')return {state:'failed',code:'CHANNEL_MISMATCH',lineRequestId:null};
 if(quota.type!=='limited'||typeof quota.value!=='number'||typeof usage.totalUsage!=='number')return {state:'failed',code:'QUOTA_UNVERIFIED',lineRequestId:null};
 if(usage.totalUsage>=quota.value)return {state:'failed',code:'QUOTA_EXHAUSTED',lineRequestId:null};
 }catch{return {state:'failed',code:'PREFLIGHT_FAILED',lineRequestId:null};}
 try{
 const response=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',headers:{...headers,'Content-Type':'application/json','X-Line-Retry-Key':key},body:JSON.stringify({to:target,messages:[staffMessage(text)]}),redirect:'error',signal:AbortSignal.timeout(10000)});
 const acceptedId=response.headers.get('x-line-accepted-request-id'),requestId=response.headers.get('x-line-request-id');
 if(response.ok||(response.status===409&&acceptedId))return {state:'accepted',code:null,lineRequestId:acceptedId||requestId};
 if(response.status>=400&&response.status<500&&response.status!==409)return {state:'failed',code:response.status===429?'LINE_LIMIT':`LINE_HTTP_${response.status}`,lineRequestId:requestId};
 return {state:'unknown',code:`LINE_HTTP_${response.status}`,lineRequestId:requestId};
 }catch{return {state:'unknown',code:'NETWORK_UNKNOWN',lineRequestId:null};}
}
