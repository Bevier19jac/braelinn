const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
(async()=>{await new Promise(r=>srv.listen(8947,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8947/';

 console.log('\n== REPRODUCE THE LIVE BUG: seats drawn, NOBODY checked in ==');
 // /* The Table now bounces anyone not signed in to the sign-in screen, so seed an identity before the first load. */
 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{try{localStorage.setItem('bpl_me','Nate')}catch(e){}});
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 await p.evaluate(async()=>{ try{localStorage.clear();sessionStorage.clear();localStorage.setItem('bpl_me','Nate')}catch(e){}
   await Game.resetNight(); await Game.start();
   // exactly what was sitting in the live database
   await DB.set('live/'+LEAGUE.nextGame.date+'/seats',
     {tables:1, order:["Phil T","Drew","Tod","Matt T","Joe C","Tim","Syd"], drawnAt:Date.now()});
   await DB.set('live/'+LEAGUE.nextGame.date+'/timer',
     {running:false,paused:false,startedAt:Date.now(),elapsedBefore:0});
   localStorage.setItem('bpl_me','Jacob');   // a phone that already knows you
 });
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1000);
 ok('table_tab_shows_no_names', await p.locator('.bseat').count()===0, await p.locator('.bseat').count());
 ok('game_night_not_triggered', await p.locator('#nightSec').isVisible()===false);

 await p.goto(B+'index.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1000);
 ok('home_seat_section_shows_no_names', (await p.locator('#seatOut').innerText()).indexOf('Phil T')===-1,
    (await p.locator('#seatOut').innerText()).slice(0,80));
 ok('where_do_i_sit_hidden', await p.locator('#btnWhereSit').isVisible()===false);
 ok('rsvp_still_usable', await p.locator('.rsvp-row').count()>0);
 ok('live_banner_hidden', await p.locator('#liveCard').isVisible()===false);

 console.log('\n== ONCE PEOPLE ARE ACTUALLY CHECKED IN, IT WORKS NORMALLY ==');
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 await p.evaluate(async()=>{ sessionStorage.setItem('bpl_admin_ok','1');
   for(const n of ["Phil T","Drew","Tod","Matt T","Joe C","Tim","Syd"]) await Game.checkIn(n,{}); });
 await p.waitForTimeout(1100);
 ok('now_the_table_appears', await p.locator('.bseat').count()===7, await p.locator('.bseat').count());
 ok('no_page_errors', errs.length===0, errs);
 await b.close();srv.close();
 console.log(fails.length? '\n'+fails.length+' FAILED: '+fails.join(', ') : '\nPASSED — a stale seat draw shows nobody');
 process.exit(fails.length?1:0);
})();
