import type {Applicant,StaffDepartment} from './recruiting-admin';
export const PORTALS=[{id:'therapy' as const,title:'療術部門',description:'治療院・訪問マッサージの採用管理'},{id:'welfare' as const,title:'GH部門',description:'ぷらねっと・福祉の採用管理'},{id:'admin' as const,title:'全社管理者',description:'両部門と部門未選択の応募を管理'}];
export function portalAllowed(role:string,portal:StaffDepartment){return role==='admin'||role===portal;}
export function portalScope(role:StaffDepartment,portal:StaffDepartment):StaffDepartment{return role==='admin'?portal:role;}
export function permittedRows(rows:Applicant[],role:StaffDepartment){return rows.filter(r=>role==='admin'||r.department===role);}
export function mediaOf(row:Applicant){return row.recruitment_media||(/旧媒体：([^\n]+?) \/ 旧選考状況：/.exec(row.admin_note??'')?.[1])||(row.source==='line'?'LINE':row.source==='legacy'?'旧アプリ（媒体未設定）':'手動登録');}
export function jobOf(row:Applicant){return row.desired_job||row.intake_state?.answers?.role||'職種相談中';}
export function tally(rows:Applicant[],get:(r:Applicant)=>string){const map=new Map<string,number>();for(const row of rows){const key=get(row);map.set(key,(map.get(key)??0)+1);}return [...map].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ja'));}
