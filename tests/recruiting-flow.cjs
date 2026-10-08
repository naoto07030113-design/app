const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const path = require('node:path');
function load(file) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require, Buffer, process });
  return module.exports;
}
const { initialState, advanceIntake, promptFor, readState, departmentOf } = load('recruiting-flow.ts');
const { buildLineTextMessage, verifyLineSignature } = load('line.ts');
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
  assert.equal(next(initialState(),'１').state.answers.work,'グループホーム');
  assert.equal(next(initialState(),'この内容で確認を依頼').handoff,false);
  assert.equal(next(initialState(),'担当者に相談').handoff,true);
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
console.log(`${checks} recruiting flow test groups passed`);
