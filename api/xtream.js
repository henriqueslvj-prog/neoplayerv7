const UA = 'Mozilla/5.0 NeoPlayer/3.0';
function setCors(res){res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');}
function normalizeServer(v){let s=String(v||'').trim();if(!/^https?:\/\//i.test(s))s='http://'+s;return s.replace(/\/+$/,'');}
function safeTarget(v){const u=new URL(normalizeServer(v));if(!['http:','https:'].includes(u.protocol))throw new Error('Servidor inválido.');const h=u.hostname.toLowerCase();if(['localhost','127.0.0.1','0.0.0.0','::1'].includes(h)||h.endsWith('.local')||h.endsWith('.internal'))throw new Error('Destino não permitido.');return u;}
export default async function handler(req,res){setCors(res);if(req.method==='OPTIONS')return res.status(204).end();
 const body=req.method==='POST'?(typeof req.body==='string'?JSON.parse(req.body||'{}'):req.body||{}):req.query||{};
 try{
  const server=safeTarget(body.server), username=String(body.username||''), password=String(body.password||''), action=String(body.action||'');
  if(!username||!password||!action)return res.status(400).json({error:'Servidor, usuário, senha e ação são obrigatórios.'});
  const allowed=new Set(['get_live_categories','get_vod_categories','get_series_categories','get_live_streams','get_vod_streams','get_series','get_series_info','player_api']);
  if(!allowed.has(action))return res.status(400).json({error:'Ação não suportada.'});
  const q=new URLSearchParams({username,password,action});
  for(const k of ['category_id','series_id','vod_id'])if(body[k]!=null)q.set(k,String(body[k]));
  const target=new URL('/player_api.php',server);target.search=q;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);
  try{
   const upstream=await fetch(target,{headers:{'User-Agent':UA,'Accept':'application/json,*/*'},redirect:'follow',signal:controller.signal,cache:'no-store'});
   if(!upstream.ok)return res.status(502).json({error:`Servidor Xtream respondeu HTTP ${upstream.status}.`});
   const data=await upstream.json();
   res.setHeader('Cache-Control','no-store');
   return res.status(200).json(data);
  }finally{clearTimeout(timer)}
 }catch(e){if(e?.name==='AbortError')return res.status(504).json({error:'O servidor Xtream demorou para responder.'});return res.status(502).json({error:e?.message||'Falha ao consultar o servidor Xtream.'});}
}
