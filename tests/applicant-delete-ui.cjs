const {chromium}=require('/Users/wase8/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({headless:true,channel:'chrome'}),p=await b.newPage({viewport:{width:1280,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:8777');await p.getByRole('button',{name:/全社管理者/}).click();await p.getByRole('button',{name:'サンプルデータで画面を見る'}).click();
 await p.getByRole('navigation').getByRole('button',{name:'応募者一覧',exact:true}).click();await p.getByRole('button',{name:'サンプル・院応募者',exact:true}).click();
 await p.getByRole('tab',{name:'管理',exact:true}).click();await p.getByRole('button',{name:'完全削除の確認へ進む'}).click();const input=p.getByLabel(/確認のため/),remove=p.getByRole('button',{name:'応募者と関連記録を完全削除する',exact:true});
 assert.equal(await remove.isEnabled(),false);await input.fill('違う名前');assert.equal(await remove.isEnabled(),false);
 await input.fill('サンプル・院応募者');await input.press('Enter');await p.getByRole('dialog').waitFor();assert.equal(await remove.isEnabled(),true);
 for(const width of [1280,768,375]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const box=await remove.boundingBox();assert.ok(box.height>=44);}
 await p.getByRole('region',{name:'応募者を完全削除する',exact:true}).screenshot({path:'../../outputs/採用統合アプリ/完全削除の確認画面.png'});
 await remove.click();await p.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await p.getByRole('button',{name:'サンプル・院応募者',exact:true}).count(),0);
 await p.reload();await p.getByRole('button',{name:'サンプルデータで画面を見る'}).click();
 async function nav(name){const menu=p.getByRole('button',{name:'メニューを切り替える'});if(await menu.isVisible())await menu.click();await p.getByRole('navigation').getByRole('button',{name,exact:true}).click();}
 await nav('応募者一覧');assert.equal(await p.getByRole('button',{name:'サンプル・院応募者',exact:true}).count(),0);
 await p.getByRole('button',{name:'ログアウト'}).click();await p.getByRole('button',{name:/GH部門/}).click();await p.getByRole('button',{name:'サンプルデータで画面を見る'}).click();await nav('応募者一覧');await p.getByRole('button',{name:'サンプル・GH応募者',exact:true}).click();assert.equal(await p.getByRole('button',{name:'完全削除の確認へ進む'}).count(),0);
 assert.deepEqual(errors,[]);await b.close();console.log('PASS delete UI: typed confirmation, Enter prevented, demo LINE applicant deleted, reload persistence, staff hidden, 3 widths, no page errors.');
})().catch(e=>{console.error(e);process.exit(1)});
