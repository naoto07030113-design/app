const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!token) throw new Error('LINE token is not configured');
async function get(path) {
 const r = await fetch('https://api.line.me/v2/bot'+path,{headers:{Authorization:'Bearer '+token}});
 if (!r.ok) throw new Error('LINE verification HTTP '+r.status);
 return r.json();
}
const bot=await get('/info');
if(bot.basicId!=='@814gpyea')throw new Error('Wrong LINE account');
const menu=await get('/user/all/richmenu');
if(menu.richMenuId!=='richmenu-2b5b963461911d1418f0bfc5bfd1cf73')throw new Error('Wrong default menu');
const progress=await get('/richmenu/progress/batch?requestId=316d00d4-7ee5-439d-9cbe-1606107c0bcd');
if(progress.phase!=='succeeded')throw new Error('Menu migration phase: '+progress.phase);
console.log(JSON.stringify({verified:true,defaultMenu:menu.richMenuId,migration:progress}));
