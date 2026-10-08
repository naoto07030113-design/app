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
    throw new Error(`LINE API ${method} ${path}: HTTP ${response.status}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}
const bot = await api('/info');
if (bot.basicId !== '@814gpyea') throw new Error('Wrong LINE account; expected the recruiting account @814gpyea. No changes made.');
const oldDefault = await api('/user/all/richmenu');
const existing = await api('/richmenu/list');
const aliases = await api('/richmenu/alias/list');
let saved = null;
try { saved = JSON.parse(await readFile(new URL('installation-result.json', root), 'utf8')); } catch {}
const previousDefault = saved && saved.menus?.recruiting && saved.menus.recruiting === oldDefault?.richMenuId ? saved.previousDefault : oldDefault?.richMenuId ?? null;
const result = { previousDefault, menus: {} };
for (const name of ['recruiting', 'company']) {
  const definition = JSON.parse(await readFile(new URL(`${name}.json`, root), 'utf8'));
  const alias = `ito-${name}-20261008`;
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
  const actual = await api('/user/all/richmenu');
  if (actual?.richMenuId !== result.menus.recruiting) throw new Error('Default menu verification failed.');
}
console.log(JSON.stringify({ published: args.has('--publish'), previousDefault: result.previousDefault, menus: result.menus }));
