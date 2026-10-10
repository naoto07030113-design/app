import type {Applicant} from './recruiting-admin';
import {mediaOf,jobOf} from './recruiting-portal';
export type Department='therapy'|'welfare';
export type Master={department:Department;media:string[];jobs:{name:string;open:boolean}[];updated_at?:string};
export function defaultMaster(department:Department,demo=false):Master{return {department,media:['LINE','ベイネット','ハローワーク','engage','Timee','紹介','不明'],jobs:(department==='therapy'?['施術','受付','訪問マッサージ','その他']:['生活支援・夜間見守り','世話人','介護・送迎','夜勤専従','調理','看護師','機能訓練指導員','サービス管理責任者','介護','その他']).map(name=>({name,open:demo&&name!=='その他'}))};}
export function validateMaster(master:Master){for(const values of [master.media,master.jobs.map(j=>j.name)])if(!values.length||values.length>100||values.some(n=>!n.trim()||n.length>200)||new Set(values).size!==values.length)throw new Error('名称は重複しない200文字以内、1〜100件で設定してください。');}
export function renameRows(rows:Applicant[],department:Department,kind:'media'|'job',oldName:string,newName:string){return rows.map(r=>r.department===department&&(kind==='media'?mediaOf(r):jobOf(r))===oldName?{...r,[kind==='media'?'recruitment_media':'desired_job']:newName,updated_at:new Date().toISOString()}:r);}
