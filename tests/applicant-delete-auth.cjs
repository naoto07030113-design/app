const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
let role='admin',calls=0,actor='',rpcError=null;
const admin={auth:{getUser:async t=>({data:{user:t==='valid'?{id:'verified-admin'}:null},error:null})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{department:role},error:null})})})}),rpc:async(n,p)=>{calls++;actor=p.p_actor_id;return {data:{result:'deleted'},error:rpcError}}};
const ctx={exports:{},Request,Response,URL,AbortSignal,require:()=>({getSupabaseAdmin:()=>admin})};vm.createContext(ctx);vm.runInContext(ts.transpileModule(fs.readFileSync('src/app/api/applicants/delete/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);
const input={applicantId:'33333333-3333-4333-8333-333333333333',expectedUpdatedAt:'2026-10-12T00:00:00Z',confirmation:'テスト応募者'};
const req=(v=input,t='valid',origin='https://local.test')=>new Request('https://local.test/api/applicants/delete',{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json',origin},body:JSON.stringify(v)});
(async()=>{
 assert.equal((await ctx.exports.POST(req(input,'invalid'))).status,401);
 assert.equal((await ctx.exports.POST(req(input,'valid','https://evil.test'))).status,403);
 for(role of ['therapy','welfare','unknown'])assert.equal((await ctx.exports.POST(req())).status,403);
 role='admin';for(const v of [{...input,actorId:'forged'},null,{...input,applicantId:'*'},{...input,expectedUpdatedAt:'bad'}])assert.equal((await ctx.exports.POST(req(v))).status,400);
 assert.equal(calls,0);assert.equal((await ctx.exports.POST(req())).status,200);assert.equal(actor,'verified-admin');
 for(const code of ['EDIT_CONFLICT','REPLY_PENDING','CONFIRMATION_MISMATCH','APPLICANT_NOT_FOUND']){rpcError=Error(code);const response=await ctx.exports.POST(req());assert.equal(response.status,409);assert.equal((await response.json()).error,code);}
 console.log('PASS delete API: invalid auth, origin, department roles, forged actor, body validation, verified actor, conflicts. Mock only.');
})().catch(e=>{console.error(e);process.exit(1)});
