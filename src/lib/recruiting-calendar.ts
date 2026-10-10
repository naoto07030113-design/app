import {localDate,type Applicant} from './recruiting-admin';
export type CalendarField='appointment_date'|'contact_date';
export function parseDay(key:string){const [y,m,d]=key.split('-').map(Number);return new Date(y,m-1,d);}
export function addDays(day:Date,n:number){return new Date(day.getFullYear(),day.getMonth(),day.getDate()+n);}
export function calendarDays(key:string,mode:'month'|'week'){const day=parseDay(key),first=mode==='month'?new Date(day.getFullYear(),day.getMonth(),1):day,start=addDays(first,-first.getDay());return Array.from({length:mode==='month'?Math.ceil((first.getDay()+new Date(first.getFullYear(),first.getMonth()+1,0).getDate())/7)*7:7},(_,i)=>localDate(addDays(start,i)));}
export function shiftPeriod(key:string,mode:'month'|'week',n:number){const day=parseDay(key);return localDate(mode==='month'?new Date(day.getFullYear(),day.getMonth()+n,1):addDays(day,n*7));}
export function rowsForDay(rows:Applicant[],key:string,field:CalendarField){return rows.filter(r=>r[field]===key).slice().sort((a,b)=>(a.display_name||'').localeCompare(b.display_name||'','ja'));}
export function validDay(key:string){return /^\d{4}-\d{2}-\d{2}$/.test(key)&&localDate(parseDay(key))===key;}

export function eventsForDay(rows:Applicant[],key:string,field:CalendarField|'both'){return (field==='both'?['appointment_date','contact_date'] as CalendarField[]:[field]).flatMap(kind=>rowsForDay(rows,key,kind).map(row=>({row,kind})));}
