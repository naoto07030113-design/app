export const CONTACT_ASK='ご相談ありがとうございます。\n担当者からのお返事は、どの方法がよいですか？\n電話・メール・LINEから選んでください。電話やメールを選んだ方には、続けて連絡先をお聞きします。';
export const CONTACT_CHOICES=[{label:'電話で連絡してほしい',text:'連絡希望：電話'},{label:'メールで連絡してほしい',text:'連絡希望：メール'},{label:'LINEで連絡してほしい',text:'連絡希望：LINE'}];
export function staffMessage(text:string){return {type:'text',text,...(text===CONTACT_ASK?{quickReply:{items:CONTACT_CHOICES.map(choice=>({type:'action',action:{type:'message',label:choice.label,text:choice.text}}))}}:{})};}
