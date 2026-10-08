const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');
const cache = {};
function load(file) {
  if(cache[file]) return cache[file];
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name === "./recruiting-content" ? load("recruiting-content.ts") : require(name), Buffer, process });
  cache[file] = module.exports;
  return module.exports;
}
const { initialState, advanceIntake, promptFor, readState, departmentOf } = load('recruiting-flow.ts');
const { buildLineTextMessage, buildLineMessage, verifyLineSignature } = load('line.ts');
let checks = 0;
function check(fn) { fn(); checks++; }
const next = (s, text) => advanceIntake(readState(JSON.parse(JSON.stringify(s))), text);
check(() => {
  let s = initialState();
  for (const input of ['グループホームで働きたい','生活支援・夜間見守り','パートを希望','副業を希望','22〜翌5時','週1回程度','資格なし','1か月以内','まず見学したい']) {
    const before = JSON.stringify(s);
    const r = next(s,input);
    assert.equal(JSON.stringify(s),before);
    s = r.state;
    assert.notEqual(JSON.stringify(s),before,input);
  }
  assert.equal(departmentOf(s),'welfare');
  assert.match(promptFor(s).text,/22〜翌5時/);
  assert.match(promptFor(s).text,/副業を希望/);
  const done = next(s,'この内容で確認を依頼');
  assert.equal(done.handoff,true);
  assert.equal(done.state.mode,'human');
  assert.equal(next(done.state,'追加の相談です').state.mode,'human');
});
check(() => {
  const s = next(initialState(),'1').state;
  const info = next(s,'会社・職場情報');
  assert.equal(JSON.stringify(info.state),JSON.stringify(s));
  assert.match(info.reply.text,/https:\/\/ito-chiryoin.com\//);
  assert.match(next(info.state,'採用相談を再開').reply.text,/仕事内容/);
  assert.equal(next(s,'前の質問に戻る').state.answers.work,undefined);
});
check(() => {
  const invalid = next(initialState(),'給与100万円保証して');
  assert.equal(Object.keys(invalid.state.answers).length,0);
  assert.match(invalid.reply.text,/選択肢/);
  assert.equal(next(initialState(),'１').state.answers.work,'院での施術・受付');
  assert.equal(next(initialState(),'この内容で確認を依頼').handoff,false);
  assert.equal(next(initialState(),'担当者に相談').state.screen,'consult-topic');
  assert.equal(next(initialState(),'相談して決めたい').handoff,true);
});
check(() => {
  for (const work of ['グループホーム','デイサービス・介護','院での施術・受付','訪問マッサージ']) {
    const s = next(initialState(),work).state;
    for (const role of promptFor(s).choices.filter(c=>!['前の質問に戻る','担当者に相談','会社・職場情報'].includes(c.text))) {
      let branch = next(s,role.text).state;
      let turns = 0;
      while (!promptFor(branch).choices.some(c=>c.text==='この内容で確認を依頼') && turns++ < 15) {
        const p = promptFor(branch);
        const m = buildLineTextMessage(p);
        assert.ok(m.quickReply.items.length<=13);
        for (const i of m.quickReply.items) assert.ok(i.action.label.length<=20);
        branch = next(branch,p.choices[0].text).state;
      }
      assert.ok(turns<15,`${work}/${role.text}`);
      assert.equal(Boolean(branch.answers.drive),work==='訪問マッサージ'||role.text==='送迎');
      assert.equal(next(branch,'最初から').state.answers.work,undefined);
    }
  }
});
check(() => {
  process.env.LINE_CHANNEL_SECRET = 'test-secret-only';
  assert.equal(verifyLineSignature('{}','short'),false);
  const sig = require('node:crypto').createHmac('sha256','test-secret-only').update('{}').digest('base64');
  assert.equal(verifyLineSignature('{}',sig),true);
  assert.equal(buildLineTextMessage('test').text,'test');
});
check(() => {
  const roots = ['お仕事を探す','働き方を選ぶ','見学・応募','担当者に相談','採用相談を再開','会社・職場情報'];
  const responses = roots.map(input=>next(initialState(),input).reply.text);
  assert.equal(new Set(responses).size,roots.length);
  const info = next(initialState(),'仕事紹介：グループホーム');
  assert.match(info.reply.text,/見守り/);
  assert.equal(info.state.answers.work,undefined);
  const interested = next(info.state,'仕事を希望：グループホーム');
  assert.equal(interested.state.answers.work,'グループホーム');
  assert.equal(interested.state.entry,'work');
  const working = next(initialState(),'働き方：パート');
  assert.equal(working.state.answers.employment,'パートを希望');
  assert.match(working.reply.text,/副業/);
  const afterSideJob = next(working.state,'副業ではない');
  assert.match(afterSideJob.reply.text,/勤務回数/);
  const visit = next(initialState(),'見学する仕事：グループホーム');
  let v = next(visit.state,'生活支援・夜間見守り');
  assert.match(v.reply.text,/見学の候補/);
  v = next(v.state,'平日の日中');
  assert.match(v.reply.text,/見学日時/);
  assert.equal(v.state.answers.next,'まず見学したい');
  assert.equal(next(v.state,'この内容で確認を依頼').handoff,true);
  const apply = next(initialState(),'応募の希望を入力');
  assert.equal(apply.state.answers.next,'応募を進めたい');
  assert.equal(apply.state.entry,'apply');
});
check(() => {
  let s = next(initialState(),'担当者に相談').state;
  s = next(s,'給与・待遇を相談').state;
  assert.equal(readState(JSON.parse(JSON.stringify(s))).screen,'consult-note');
  const sent = next(s,'副業の条件を知りたいです');
  assert.equal(sent.handoff,true);
  assert.equal(sent.state.answers.consultNote,'副業の条件を知りたいです');
  assert.match(sent.reply.text,/副業の条件/);
  const browsing = next(s,'私たちについて');
  assert.equal(browsing.state.screen,'consult-note');
  assert.equal(browsing.state.answers.consultNote,undefined);
  assert.ok(browsing.reply.choices.some(c=>c.uri));
  assert.equal(next(s,'a'.repeat(1501)).handoff,false);
});
check(() => {
  const commands = ['お仕事を探す','働き方を選ぶ','見学・応募','担当者に相談','会社・職場情報','私たちについて','院・事業を知る','仕事内容','よくある質問','FAQ：給与・休日・待遇','FAQ：見学の流れ','職場：本院','職場：長浦','職場：SANRI','職場：訪問'];
  const messages=[];
  for(const cmd of commands) {
    const r=next(initialState(),cmd).reply;
    const message=buildLineMessage(r);
    assert.equal(message.type,'flex');
    assert.equal(message.contents.size,'giga');
    for(const b of message.contents.footer.contents) {
      assert.equal(b.height,'md');
      assert.ok(b.action.label.length<=40);
      assert.ok(b.action.type==='uri' ? b.action.uri.startsWith('https://') : b.action.text);
    }
    assert.ok(Buffer.byteLength(JSON.stringify(message))<30000);
    messages.push(message);
  }
  fs.writeFileSync(path.join(__dirname,'../rich-menu/message-validation.json'),JSON.stringify(messages,null,2));
});
check(() => {
  const expected=['院での施術・受付','訪問マッサージ','グループホーム','デイサービス・介護'];
  for(const cmd of ['採用相談を再開','見学の希望を入力','応募の希望を入力']) assert.deepEqual(Array.from(next(initialState(),cmd).reply.choices.slice(0,4),c=>c.text),expected);
  for(const cmd of ['お仕事を探す','仕事内容']) assert.deepEqual(Array.from(next(initialState(),cmd).reply.choices.slice(0,4),c=>c.label),expected);
  expected.forEach((name,i)=>{const s=next(initialState(),String(i+1)).state;assert.equal(s.answers.work,name);assert.equal(departmentOf(s),i<2?'therapy':'welfare');});
  const clinic=next(initialState(),'1').state;assert.equal(promptFor(clinic).choices[0].text,'施術');
  assert.match(promptFor(next(initialState(),'3').state).text,/生活支援/);
  assert.match(promptFor(next(initialState(),'4').state).text,/介護/);
});
console.log(`${checks} recruiting flow test groups passed`);
