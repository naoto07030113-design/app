import { readFile, writeFile } from 'node:fs/promises';
const args = new Set(process.argv.slice(2));
if (!args.has('--prepare') && !args.has('--publish')) {
  console.log('Use --prepare to create draft menus, or --publish to also set the default menu.');
  process.exit(0);
}
const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is required. Never put its value in command arguments.');
const root = new URL('../rich-menu/', import.meta.url);
async function api(path, { method = 'GET', body, image = false } = {}) {
  const response = await fetch(`https://${image ? 'api-data' : 'api'}.line.me/v2/bot${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': image ? 'image/jpeg' : 'application/json' } : {}) },
    ...(body ? { body: image ? body : JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    if (response.status === 404 && method === 'GET') return null;
    let detail = '';
    if (path === '/message/validate/reply') {
      const error = await response.json().catch(() => ({}));
      detail = JSON.stringify({ message: error.message, details: error.details }).slice(0, 2000);
    }
    throw new Error(`LINE API ${method} ${path}: HTTP ${response.status} ${detail}`);
  }
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (path === "/richmenu/batch") data.requestId = response.headers.get("x-line-request-id");
  return data;
}
const bot = await api('/info');
if (bot.basicId !== '@814gpyea') throw new Error('Wrong LINE account; expected the recruiting account @814gpyea. No changes made.');
const messages = JSON.parse(await readFile(new URL('message-validation.json', root), 'utf8'));
for (let i = 0; i < messages.length; i += 5) await api('/message/validate/reply', { method: 'POST', body: { messages: messages.slice(i, i + 5) } });
const oldDefault = await api('/user/all/richmenu');
const existing = await api('/richmenu/list');
const aliases = await api('/richmenu/alias/list');
let saved = null;
try { saved = JSON.parse(await readFile(new URL('installation-result.json', root), 'utf8')); } catch {}
const previousDefault = saved && saved.menus?.recruiting && saved.menus.recruiting === oldDefault?.richMenuId ? saved.previousDefault : oldDefault?.richMenuId ?? null;
const result = { previousDefault, menus: {} };
for (const name of ['recruiting', 'company']) {
  const definition = JSON.parse(await readFile(new URL(`${name}.json`, root), 'utf8'));
  const alias = `ito-${name}-large-20261008`;
  await api('/richmenu/validate', { method: 'POST', body: definition });
  let menu = existing.richmenus.find(m => m.name === definition.name);
  const oldAlias = aliases.aliases.find(a => a.richMenuAliasId === alias);
  if (menu && (JSON.stringify(menu.areas) !== JSON.stringify(definition.areas) || JSON.stringify(menu.size) !== JSON.stringify(definition.size))) {
    throw new Error(`An existing menu has the same name but different settings: ${name}. Refusing to replace it.`);
  }
  if (oldAlias && (!menu || oldAlias.richMenuId !== menu.richMenuId)) throw new Error(`Alias ${alias} belongs to another menu. Refusing to replace it.`);
  const id = menu?.richMenuId ?? (await api('/richmenu', { method: 'POST', body: definition })).richMenuId;
  if (!id) throw new Error('LINE did not return a menu ID.');
  if (!menu) await api(`/richmenu/${id}/content`, { method: 'POST', body: await readFile(new URL(`${name}.jpg`, root)), image: true });
  if (!oldAlias) await api('/richmenu/alias', { method: 'POST', body: { richMenuAliasId: alias, richMenuId: id } });
  result.menus[name] = id;
}
// Keep the rollback reference locally. This file contains menu IDs only, never tokens.
await writeFile(new URL('installation-result.json', root), JSON.stringify(result, null, 2));
if (args.has('--publish')) {
  await api(`/user/all/richmenu/${result.menus.recruiting}`, { method: 'POST' });
  // Redirect only the two aliases owned by our previous recruiting menus.
  const previousMenus = { recruiting: 'richmenu-a484858a82d1cbcec6cb5196d938f296', company: 'richmenu-8f851944eca6f0de560ef223f2f89300' };
  for (const name of ['recruiting', 'company']) {
    const alias = aliases.aliases.find(a => a.richMenuAliasId === `ito-${name}-20261008`);
    if (alias && alias.richMenuId === previousMenus[name]) await api(`/richmenu/alias/${alias.richMenuAliasId}`, { method: 'POST', body: { richMenuId: result.menus[name] } });
  }
  const operations = Object.entries(previousMenus).filter(([name, id]) => existing.richmenus.some(m => m.richMenuId === id && m.name === `ito-recruiting-${name}-20261008`)).map(([name, id]) => ({ type: 'link', from: id, to: result.menus[name] }));
  if (operations.length) {
    const body = { operations, resumeRequestKey: 'ito-menu-large-20261008' };
    await api('/richmenu/validate/batch', { method: 'POST', body });
    const accepted = await api('/richmenu/batch', { method: 'POST', body });
    if (!accepted.requestId) throw new Error('LINE did not return a batch request ID.');
    result.migrationRequestId = accepted.requestId;
    result.migration = await api(`/richmenu/progress/batch?requestId=${encodeURIComponent(accepted.requestId)}`);
    if (result.migration?.phase === 'failed') throw new Error('Rich-menu migration failed; retry with the same resumeRequestKey.');
  }
  const actual = await api('/user/all/richmenu');
  if (actual?.richMenuId !== result.menus.recruiting) throw new Error('Default menu verification failed.');
}
await writeFile(new URL('installation-result.json', root), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ migrationRequestId: result.migrationRequestId, migration: result.migration, published: args.has('--publish'), previousDefault: result.previousDefault, menus: result.menus }));
