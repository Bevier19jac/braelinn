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
(async()=>{await new Promise(r=>srv.listen(8941,r));
 const b=await chromium.launch();
 /* The cases come FROM the calendar in data.js. Typing dates in here meant
    every new game night broke this test and taught nobody anything. */
 const dates = require('fs').readFileSync(__dirname+'/data.js','utf8')
   .split('schedule: [')[1].split(/^  \]/m)[0]
   .replace(/\/\*[\s\S]*?\*\//g, '')     // the commented-out examples are not the calendar
   .match(/date:\s*"(\d{4}-\d{2}-\d{2})"/g)
   .map(m=>m.match(/\d{4}-\d{2}-\d{2}/)[0])
   .filter((d,i,a)=>a.indexOf(d)===i).sort();
 const first = dates[0], last = dates[dates.length-1];
 const shift = (iso, days) => {
   const [y,m,d] = iso.split('-').map(Number);
   const dt = new Date(y, m-1, d+days);
   return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
 };
 console.log('  calendar:', dates.join(', '));
 for (const [label, iso, expectRsvp] of [
   ['the day before the first', shift(first,-1)+'T12:00:00', true ],
   ['first game day, morning',  first+'T09:00:00',           true ],
   ['last game day, morning',   last+'T09:00:00',            true ],
   ['the day after the last',   shift(last,1)+'T09:00:00',   false],
   ['two weeks after the last', shift(last,14)+'T09:00:00',  false],
   ['a year after the last',    shift(last,365)+'T09:00:00', false]
 ]) {
   const c=await b.newContext({viewport:{width:390,height:844}});
   await c.route('**/gstatic.com/**',r=>r.abort());
   await c.addInitScript(`{
     const F=Date, T=new F('${iso}').getTime();
     class D extends F { constructor(...a){ super(...(a.length?a:[T])); } static now(){ return T; } }
     Date=D;
   }`);
   const p=await c.newPage();
   await p.goto('http://localhost:8941/index.html',{waitUntil:'networkidle'});
   await p.evaluate(()=>{try{localStorage.setItem('bpl_me','Aaron')}catch(e){}});
   await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(700);
   const st = await p.evaluate(()=>({
     rsvp: !!document.querySelector('#rsvp') && !document.querySelector('#rsvp').hidden,
     none: !document.getElementById('noneSec').hidden,
     shownDate: (document.getElementById('hcWhen')||{}).textContent||'',
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
