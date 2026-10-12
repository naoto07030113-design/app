const {chromium}=require('/Users/wase8/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const b=await chromium.launch({headless:true,channel:'chrome'}),p=await b.newPage({viewport:{width:1440,height:1050}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.APP_URL||'http://127.0.0.1:8777');
 async function enter(role){await p.getByRole('button',{name:new RegExp(role)}).click();await p.getByRole('button',{name:'サンプルデータで画面を見る'}).click();}
 async function nav(name){if(await p.getByRole('button',{name:'メニューを切り替える'}).isVisible())await p.getByRole('button',{name:'メニューを切り替える'}).click();await p.getByRole('navigation',{name:'採用管理',exact:true}).getByRole('button',{name,exact:true}).click();}
 async function width(w){await p.setViewportSize({width:w,height:950});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${w}`);}
 async function filters(){const el=p.locator('.filters-panel');if(!await el.getAttribute('open')){if(!await el.evaluate(n=>n.open))await el.locator('summary').click();}}
 await enter('全社管理者');
 await p.screenshot({path:'../../outputs/採用統合アプリ/UI刷新-ホームPC.png',fullPage:true});
 assert.equal(await p.locator('.search-and-filters').count(),0);
 await p.locator('.metric').filter({hasText:'見学・面接中'}).click();assert.equal(await p.locator('tbody tr').count(),1);await filters();assert.equal(await p.getByLabel('選考状況',{exact:true}).inputValue(),'visit');
 await nav('採用ホーム');await p.locator('.metric').filter({has:p.getByText('選考中',{exact:true})}).click();assert.equal(await p.locator('tbody tr').count(),4);
 await nav('採用ホーム');await p.locator('.metric').filter({hasText:'登録応募者'}).click();assert.equal(await p.locator('tbody tr').count(),5);
 await filters();await p.getByLabel('応募媒体で絞り込む').selectOption('engage');assert.equal(await p.locator('tbody tr').count(),1);await p.getByRole('button',{name:'絞り込みを解除する'}).click();
 await p.getByRole('button',{name:'サンプル・院応募者',exact:true}).click();
 const dlg=p.getByRole('dialog');assert.equal(await dlg.getByRole('tab').count(),3);await dlg.getByLabel('進行メモ（社内用）').fill('未保存の編集テスト');
 await dlg.getByRole('tab',{name:'連絡・LINE'}).click();await dlg.getByLabel('LINEの返信内容').fill('未送信の返信テスト');await dlg.getByRole('tab',{name:'応募情報',exact:true}).click();assert.equal(await dlg.getByLabel('進行メモ（社内用）').inputValue(),'未保存の編集テスト');await dlg.getByRole('tab',{name:'連絡・LINE'}).click();assert.equal(await dlg.getByLabel('LINEの返信内容').inputValue(),'未送信の返信テスト');
 await dlg.getByRole('tab',{name:'応募情報',exact:true}).click();await p.keyboard.press('ArrowRight');assert.equal(await dlg.getByRole('tab',{name:'連絡・LINE'}).getAttribute('aria-selected'),'true');
 await p.keyboard.press('Escape');await p.getByRole('button',{name:'編集を続ける'}).click();assert.equal(await dlg.isVisible(),true);
 await dlg.getByRole('tab',{name:'応募情報',exact:true}).click();await width(375);await p.screenshot({path:'../../outputs/採用統合アプリ/UI刷新-応募者詳細スマホ.png'});
 for(const w of [375,768,1440]){await width(w);const rect=await dlg.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=w);assert.ok((await dlg.locator('button:visible').evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().height))).every(h=>h>=43.9));const footer=await dlg.locator('.dialog-foot').boundingBox();assert.ok(footer.y+footer.height<=950);}
 await p.keyboard.press('Escape');await p.getByRole('button',{name:'変更を破棄して閉じる'}).click();await dlg.waitFor({state:'hidden'});
 for(const w of [375,768,1440]){await width(w);for(const name of ['応募者一覧','応募者ボード','採用カレンダー','求人・職種','媒体・職種の設定','採用ホーム']){await nav(name);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' overflow '+w);if(name==='応募者一覧'&&w===375){assert.equal(await p.locator('.mobile-applicant-card:visible').count(),5);assert.equal(await p.locator('.desktop-applicant-table').isVisible(),false);await p.getByLabel('モバイルの並べ替え').selectOption('display_name');await p.getByRole('button',{name:'並べ替えの方向を変更する'}).click();await p.screenshot({path:'../../outputs/採用統合アプリ/UI刷新-応募者一覧スマホ.png',fullPage:true});}if(w===1440&&name==='応募者ボード')await p.screenshot({path:'../../outputs/採用統合アプリ/UI刷新-ボードPC.png',fullPage:true});if(w===1440&&name==='媒体・職種の設定')await p.screenshot({path:'../../outputs/採用統合アプリ/UI刷新-設定PC.png',fullPage:true});}if(w===375)await p.screenshot({path:'../../outputs/採用統合アプリ/UI刷新-ホームスマホ.png',fullPage:true});}
 // Staff scope, exports, access restrictions and actual text entry survive the new layout.
 for(const [role,total,forbidden] of [['療術部門',2,'サンプル・GH応募者'],['GH部門',3,'サンプル・院応募者']]){await p.getByRole('button',{name:'ログアウト'}).click();await enter(role);await nav('応募者一覧');assert.equal(await p.locator('tbody tr').count(),total);assert.equal(await p.getByRole('button',{name:forbidden,exact:true}).count(),0);const dl=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'CSVを出力する'}).click()]);assert.ok(!fs.readFileSync(await dl[0].path(),'utf8').includes(forbidden));await p.locator('tbody button').first().click();await dlg.getByRole('tab',{name:'管理',exact:true}).click();assert.equal(await p.getByRole('button',{name:'完全削除の確認へ進む'}).count(),0);await p.keyboard.press('Escape');}
 assert.deepEqual(errors,[]);await b.close();console.log('PASS UI refresh: 3 widths x 6 views, metric drilldown, collapsed filters, stable tabs/drafts, keyboard, unsaved close, fixed footer, mobile sort, department scopes, CSV, admin restrictions.');
})().catch(e=>{console.error(e);process.exit(1);});
