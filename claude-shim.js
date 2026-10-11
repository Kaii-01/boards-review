/* Lets the app run outside the Claude artifact by providing the same window.claude.use(...) API
   (db, user, downloads, sample) on top of Supabase. Does nothing inside the Claude artifact. */
(function(){
'use strict';
if(window.claude||!window.REE_CONFIG)return;
var C=window.REE_CONFIG;
window.__reeWeb=true;
var sb=null,session=null,profile=null,readyRes,ready=new Promise(function(r){readyRes=r});
var caches={},listeners=[],chan=null,wasSub=false;

/* ---------- sign-in screen ---------- */
function css(){
  var s=document.createElement('style');
  s.textContent='#reeAuth{position:fixed;inset:0;z-index:99999;background:#14110d;color:#f4efe6;display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}'+
  '#reeAuth .box{width:100%;max-width:400px;background:#201d17;border:1px solid #3a352b;border-radius:24px;padding:28px;display:flex;flex-direction:column;gap:14px}'+
  '#reeAuth h1{margin:0;font-size:28px;letter-spacing:-.5px}#reeAuth p{margin:0;color:#b8ae9a;font-size:14px;line-height:1.45}'+
  '#reeAuth label{font-size:13px;color:#b8ae9a;display:block;margin-bottom:5px}'+
  '#reeAuth input{width:100%;box-sizing:border-box;background:#14110d;border:1px solid #3a352b;border-radius:12px;color:#f4efe6;padding:12px 14px;font-size:16px}'+
  '#reeAuth button{border:0;border-radius:999px;padding:13px 20px;font-size:16px;font-weight:700;cursor:pointer;background:#c8f53a;color:#14110d}'+
  '#reeAuth button.alt{background:transparent;color:#c8f53a;font-weight:600}#reeAuth .err{color:#ff8a6b;font-size:14px;min-height:18px}'+
  '#reeAuth .logo{width:44px;height:44px;border-radius:14px;background:#c8f53a;color:#14110d;font-weight:800;font-size:22px;display:flex;align-items:center;justify-content:center}';
  document.head.appendChild(s);
}
function authScreen(){
  return new Promise(function(done){
    css();
    var mode='in',wrap=document.createElement('div');wrap.id='reeAuth';
    function draw(msg,isErr){
      wrap.innerHTML='';
      var b=document.createElement('div');b.className='box';
      b.innerHTML='<div class="logo">R</div><h1>Operation REE 2027</h1><p>'+(mode==='in'?'Sign in to your club account.':'Create your account. The owner will let you in after you sign up.')+'</p>';
      var f=document.createElement('form');f.style.cssText='display:flex;flex-direction:column;gap:12px';
      function fld(l,t,n,ac){var d=document.createElement('div');d.innerHTML='<label>'+l+'</label>';var i=document.createElement('input');i.type=t;i.name=n;i.autocomplete=ac;i.required=true;d.appendChild(i);f.appendChild(d);return i}
      var nameI=mode==='up'?fld('Your name (ENGR. is added for you)','text','name','name'):null;
      var em=fld('Email','email','email','email'),pw=fld('Password (6+ characters)','password','pw',mode==='in'?'current-password':'new-password');
      var er=document.createElement('div');er.className='err';er.textContent=msg||'';if(!isErr&&msg)er.style.color='#c8f53a';f.appendChild(er);
      var go=document.createElement('button');go.type='submit';go.textContent=mode==='in'?'Sign in':'Create account';f.appendChild(go);
      f.onsubmit=function(ev){ev.preventDefault();go.disabled=true;er.textContent='';
        var p=mode==='in'?sb.auth.signInWithPassword({email:em.value.trim(),password:pw.value})
          :sb.auth.signUp({email:em.value.trim(),password:pw.value,options:{data:{name:(nameI.value||'').trim().replace(/^engr\.?\s*/i,'')}}});
        p.then(function(r){
          if(r.error){go.disabled=false;er.textContent=r.error.message;return}
          if(r.data&&r.data.session){wrap.remove();done(r.data.session)}
          else{go.disabled=false;draw('Check your email to confirm your account, then sign in.',false);mode='in'}
        }).catch(function(e){go.disabled=false;er.textContent=String(e&&e.message||e)});
      };
      b.appendChild(f);
      var alt=document.createElement('button');alt.type='button';alt.className='alt';alt.textContent=mode==='in'?'New here? Create an account':'I already have an account';
      alt.onclick=function(){mode=mode==='in'?'up':'in';draw()};b.appendChild(alt);wrap.appendChild(b);
    }
    draw();document.body.appendChild(wrap);
  });
}

/* ---------- start ---------- */
function loadScript(src){return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){rej(new Error('Could not load '+src))};document.head.appendChild(s)})}
async function start(){
  try{
    if(!C.SUPABASE_URL||/PASTE_/.test(C.SUPABASE_URL))throw new Error('Supabase is not set up yet. Fill in config.js.');
    if(!window.supabase)await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js');
    sb=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});
    var r=await sb.auth.getSession();session=r.data&&r.data.session;
    if(!session)session=await authScreen();
    var p=await sb.from('profiles').select('name,is_owner').eq('id',session.user.id).maybeSingle();
    profile=(p&&p.data)||{name:(session.user.user_metadata&&session.user.user_metadata.name)||'',is_owner:false};
    window.__reeAuth={email:session.user.email,signOut:function(){return sb.auth.signOut().then(function(){location.reload()})}};
    openChannel();
    readyRes(true);
  }catch(e){
    var d=document.createElement('div');d.id='reeAuth';d.innerHTML='<div class="box"><h1>Setup needed</h1><p>'+String(e.message||e)+'</p></div>';css();document.body.appendChild(d);
    readyRes(false);
  }
}

/* ---------- db ---------- */
function fail(error){
  var e=new Error(error.message||'failed');
  var msg=(error.message||'')+' '+(error.code||'');
  e.code=(/42501|row-level|policy/i.test(msg))?'invalid_argument':(/23514|docs_size|too large/i.test(msg))?'quota_exceeded':'unavailable';
  return e;
}
function clone(x){return x==null?x:JSON.parse(JSON.stringify(x))}
function docSnap(id,data){return{id:id,exists:data!==undefined&&data!==null,data:function(){return clone(data)},metadata:{}}}
function matches(l,row){
  if(!l.wh)return true;
  var v=row.data?row.data[l.wh[0]]:undefined;
  return l.wh[1]==='=='?v===l.wh[2]:true;
}
function emit(l){
  try{
    if(l.kind==='doc'){var r=l.rows[l.id];l.cb(docSnap(l.id,r))}
    else{
      var arr=Object.keys(l.rows).map(function(k){return{id:k,data:l.rows[k]}}).filter(function(r){return matches(l,r)});
      if(l.ob){var f=l.ob[0],dir=l.ob[1]==='desc'?-1:1;arr.sort(function(a,b){var x=a.data[f],y=b.data[f];return x===y?0:(x>y?1:-1)*dir})}
      if(l.lim)arr=arr.slice(0,l.lim);
      l.cb({docs:arr.map(function(r){return{id:r.id,data:function(){return clone(r.data)}}}),empty:!arr.length});
    }
  }catch(e){if(window.console)console.error(e)}
}
async function fetchAll(l){
  var q;
  if(l.kind==='doc'){
    q=await sb.from('docs').select('data').eq('path',l.path).maybeSingle();
    if(q.error){if(l.err)l.err(fail(q.error));return}
    l.rows={};if(q.data)l.rows[l.id]=q.data.data;
  }else{
    var b=sb.from('docs').select('id,data').eq('coll',l.coll);
    if(l.wh&&l.wh[1]==='==')b=b.eq('data->>'+l.wh[0],String(l.wh[2]));
    if(l.ob)b=b.order('data->'+l.ob[0],{ascending:l.ob[1]!=='desc'});
    if(l.lim)b=b.limit(l.lim);
    q=await b;
    if(q.error){if(l.err)l.err(fail(q.error));return}
    l.rows={};(q.data||[]).forEach(function(r){l.rows[r.id]=r.data});
  }
  emit(l);
}
function onChange(p){
  var row=p.new&&p.new.path?p.new:p.old;if(!row||!row.path)return;
  var coll=row.path.split('/')[0],id=row.path.slice(coll.length+1);
  listeners.slice().forEach(function(l){
    if(l.kind==='doc'?l.path!==row.path:l.coll!==coll)return;
    if(p.eventType==='DELETE'){delete l.rows[id];if(l.lim)return fetchAll(l)}
    else if(p.new&&p.new.data!==undefined)l.rows[id]=p.new.data;
    else return fetchAll(l);
    emit(l);
  });
}
function openChannel(){
  chan=sb.channel('docs-live').on('postgres_changes',{event:'*',schema:'public',table:'docs'},onChange)
    .subscribe(function(st){
      if(st==='SUBSCRIBED'){if(wasSub)listeners.slice().forEach(fetchAll);wasSub=true}
    });
}
function listen(l){
  l.rows={};listeners.push(l);fetchAll(l);
  return function(){var i=listeners.indexOf(l);if(i>=0)listeners.splice(i,1)};
}
function query(coll,wh,ob,lim){
  return{
    where:function(f,op,v){return query(coll,[f,op,v],ob,lim)},
    orderBy:function(f,d){return query(coll,wh,[f,d||'asc'],lim)},
    limit:function(n){return query(coll,wh,ob,n)},
    onSnapshot:function(cb,err){return listen({kind:'coll',coll:coll,wh:wh,ob:ob,lim:lim,cb:cb,err:err})},
    get:function(){return new Promise(function(res,rej){var u=listen({kind:'coll',coll:coll,wh:wh,ob:ob,lim:lim,cb:function(s){u();res(s)},err:function(e){u();rej(e)}})})}
  };
}
var db={
  collection:function(c){return query(c,null,null,0)},
  doc:function(path){
    var coll=path.split('/')[0],id=path.slice(coll.length+1);
    return{
      get:async function(){var q=await sb.from('docs').select('data').eq('path',path).maybeSingle();if(q.error)throw fail(q.error);return docSnap(id,q.data?q.data.data:undefined)},
      set:async function(data){var q=await sb.from('docs').upsert({path:path,data:clone(data),updated_at:new Date().toISOString()},{onConflict:'path'});if(q.error)throw fail(q.error)},
      update:async function(patch){var cur=await this.get();var d=Object.assign({},cur.exists?cur.data():{},patch);return this.set(d)},
      delete:async function(){var q=await sb.from('docs').delete().eq('path',path);if(q.error)throw fail(q.error)},
      onSnapshot:function(cb,err){return listen({kind:'doc',path:path,id:id,cb:cb,err:err})}
    };
  }
};

/* ---------- user / downloads / sample ---------- */
var user={
  id:async function(){return session.user.id},
  isOwner:async function(){return !!(profile&&profile.is_owner)},
  canEdit:async function(){return !!(profile&&profile.is_owner)},
  can:async function(){return true},
  me:async function(){return{id:session.user.id,name:(profile&&profile.name)||''}},
  profiles:async function(ids){
    var out={};ids=(ids||[]).filter(Boolean);
    if(!ids.length)return out;
    var q=await sb.from('profiles').select('id,name').in('id',ids);
    (q.data||[]).forEach(function(r){out[r.id]={id:r.id,name:r.name||''}});
    return out;
  }
};
var downloads={save:async function(o){
  var blob=new Blob([o.data],{type:/\.html$/i.test(o.filename)?'text/html':'application/octet-stream'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=o.filename;document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1500);
}};
function makeSample(){
  var f=async function(input,opts){
    opts=opts||{};
    var tok=(await sb.auth.getSession()).data.session.access_token;
    var r=await fetch('/api/sample',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+tok},body:JSON.stringify({prompt:typeof input==='string'?input:JSON.stringify(input)}),signal:opts.signal});
    var j=await r.json().catch(function(){return{}});
    if(!r.ok){var e=new Error(j.error||'AI request failed');e.code=r.status===403||r.status===401?'not_granted':'error';throw e}
    return{text:j.text||'',truncated:false};
  };
  f.json=async function(input,opts){
    var t=(await f(input,opts)).text.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
    var i=t.search(/[\[{]/),j=Math.max(t.lastIndexOf(']'),t.lastIndexOf('}'));
    return JSON.parse(t.slice(i,j+1));
  };
  f.limits=async function(){return{images:null}};
  return f;
}
var caps={user:user,db:db,downloads:downloads};
window.claude={use:async function(name){
  var ok=await ready;if(!ok)return null;
  if(name==='sample')return C.AI_ENABLED?makeSample():null;
  return caps[name]||null;
}};
if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();
