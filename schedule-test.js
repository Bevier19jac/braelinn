const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+JSON.stringify(v));
const fails=[];
const ok=(k,c,d)=>{ console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):'')); if(!c) fails.push(k); };
(async()=>{await new Promise(r=>srv.listen(8933,r));
 const b=await chromium.launch();
 for (const [label, iso, expectRsvp] of [
   ['the day before',      '2026-09-02T12:00:00', true ],
   ['game day, morning',   '2026-09-03T09:00:00', true ],
   ['the day after',       '2026-09-04T09:00:00', false],
   ['two weeks later',     '2026-09-17T09:00:00', false],
   ['December',            '2026-12-01T09:00:00', false]
 ]) {
   const c=await b.newContext({viewport:{width:390,height:844}});
   await c.route('**/gstatic.com/**',r=>r.abort());
   await c.addInitScript(`{
     const F=Date, T=new F('${iso}').getTime();
     class D extends F { constructor(...a){ super(...(a.length?a:[T])); } static now(){ return T; } }
     Date=D;
   }`);
   const p=await c.newPage();
   await p.goto('http://localhost:8933/index.html',{waitUntil:'networkidle'});
   await p.evaluate(()=>{try{localStorage.setItem('bpl_me','Aaron')}catch(e){}});
   await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(700);
   const st = await p.evaluate(()=>({
     rsvp: !document.getElementById('preSec').hidden,
     none: !document.getElementById('noneSec').hidden,
     shownDate: (document.getElementById('rsvpDate')||{}).textContent||'',
     noneMsg: (document.getElementById('noneBody')||{}).textContent||''
   }));
   console.log('\n-- ' + label + ' --');
   ok('shows_rsvp', st.rsvp===expectRsvp, st.rsvp);
   ok('shows_nothing_scheduled', st.none===!expectRsvp, st.none);
   if (st.rsvp) say('advertises', st.shownDate);
   if (st.none) say('says', st.noneMsg);
   ok('never_advertises_a_past_date', !(st.rsvp && !expectRsvp));
   await c.close();
 }
 await b.close();srv.close();
 console.log(fails.length? '\n'+fails.length+' FAILED: '+[...new Set(fails)].join(', ') : '\nPASSED — a past date is never shown as the next game');
 process.exit(fails.length?1:0);
})();
