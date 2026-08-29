const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
(async()=>{await new Promise(r=>srv.listen(8953,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 // /* The Table now bounces anyone not signed in to the sign-in screen, so seed an identity before the first load. */
 await p.goto('http://localhost:8953/index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{try{localStorage.setItem('bpl_me','Nate')}catch(e){}});
 await p.goto('http://localhost:8953/game.html',{waitUntil:'networkidle'});
 await p.evaluate(async()=>{ sessionStorage.setItem('bpl_admin_ok','1'); localStorage.setItem('bpl_me','Jacob');
   await Game.resetNight(); await Game.start();
   await DB.set('rsvp/'+LEAGUE.nextGame.date+'/Nate','in');
   await DB.set('rsvp/'+LEAGUE.nextGame.date+'/Aaron','in');
   for(const n of ['Nate','Jacob','Aaron']) await Game.checkIn(n,{});
 });
 await p.waitForTimeout(900);
 await p.evaluate(()=>window.dispatchEvent(new Event('bpl:adminchange')));
 await p.waitForTimeout(400);
 await p.click('#btnMaster'); await p.waitForTimeout(500);

 say('entrants_before', await p.evaluate(()=>Game.entrants()));
 const before = await p.evaluate(()=>[...document.querySelectorAll('#checkinList .trk-row')]
   .map(r=>r.innerText.replace(/\s+/g,' ').trim()));
 say('list_before', before);

 // click Remove on Nate
 await p.evaluate(()=>{ const b=[...document.querySelectorAll('#checkinList button[data-uncheck]')]
   .find(x=>x.dataset.uncheck==='Nate'); b.click(); });
 await p.waitForTimeout(400);
 // confirm dialog
 const conf = await p.locator('.sheet [data-yes], .sheet button').allInnerTexts().catch(()=>[]);
 say('confirm_buttons', conf);
 await p.evaluate(()=>{ const y=document.querySelector('.sheet-wrap [data-yes]')
   || [...document.querySelectorAll('.sheet-wrap button')].find(b=>/remove/i.test(b.textContent));
   if(y) y.click(); });
 await p.waitForTimeout(900);

 say('entrants_after', await p.evaluate(()=>Game.entrants()));
 say('DB_still_has_Nate', await p.evaluate(()=>!!Game.state().players['Nate']));
 const after = await p.evaluate(()=>[...document.querySelectorAll('#checkinList .trk-row')]
   .map(r=>r.innerText.replace(/\s+/g,' ').trim()));
 say('list_after', after);
 const groups = await p.evaluate(()=>[...document.querySelectorAll('#checkinList .ci-head')]
   .map(h=>h.querySelector('b').textContent+' = '+h.querySelector('span').textContent));
 say('groups_after', groups);
 const toast = await p.evaluate(()=>{const t=document.querySelector('.toast');return t?t.textContent:''});
 say('toast_said', toast);
 // now remove somebody who did NOT rsvp -- they should vanish entirely
 await p.evaluate(()=>{ const b=[...document.querySelectorAll('#checkinList button[data-uncheck]')]
   .find(x=>x.dataset.uncheck==='Jacob'); b.click(); });
 await p.waitForTimeout(400);
 await p.evaluate(()=>{ const y=[...document.querySelectorAll('.sheet-wrap button')].find(b=>/remove/i.test(b.textContent)); if(y)y.click(); });
 await p.waitForTimeout(900);
 say('jacob_gone_entirely', await p.evaluate(()=>
   !document.getElementById('checkinList').innerText.includes('Jacob')));
 say('toast2_said', await p.evaluate(()=>{const t=document.querySelector('.toast');return t?t.textContent:''}));
 say('page_errors', errs.length?errs:'none');
 await b.close();srv.close();})();
