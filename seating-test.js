const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
(async()=>{await new Promise(r=>srv.listen(8945,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8945/';
 // /* The Table now bounces anyone not signed in to the sign-in screen, so seed an identity before the first load. */
 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{try{localStorage.setItem('bpl_me','Nate')}catch(e){}});
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 await p.evaluate(async()=>{try{localStorage.clear();sessionStorage.clear();localStorage.setItem('bpl_me','Nate')}catch(e){}; await Game.resetNight?.();});
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(800);

 console.log('\n== BEFORE ANY SEAT DRAW: NO NAMES ANYWHERE ==');
 await p.evaluate(async()=>{ localStorage.setItem('bpl_me','Jacob'); sessionStorage.setItem('bpl_admin_ok','1');
   await Game.resetNight(); await Game.start(); });
 await p.waitForTimeout(900);
 ok('no_seats_shown', await p.locator('.bseat').count()===0, await p.locator('.bseat').count());
 ok('table_section_hidden', await p.locator('#nightSec').isVisible()===false);

 console.log('\n== HOST CHECKS PEOPLE IN — STILL NO TABLE ==');
 await p.evaluate(async()=>{ for(const n of ['Nate','Jacob','Aaron','Tod','Syd','Guy','Tim','Drew']) await Game.checkIn(n,{}); });
 await p.waitForTimeout(900);
 ok('checked_in', await p.evaluate(()=>Game.entrants().length)===8);
 ok('still_no_seats_shown', await p.locator('.bseat').count()===0, await p.locator('.bseat').count());
 ok('table_still_hidden', await p.locator('#nightSec').isVisible()===false);

 console.log('\n== NATE PICKS TABLES AND DRAWS — NOW IT APPEARS ==');
 await p.evaluate(async()=>{ await Game.drawSeats(2); });
 await p.waitForTimeout(1100);
 ok('table_appears', await p.locator('#nightSec').isVisible());
 ok('seats_now_populated', await p.locator('.bseat').count()===4, await p.locator('.bseat').count());
 ok('picker_matches_table_count', await p.locator('.felt-tabs button').count()===2);

 console.log('\n== HOST CLEARS THE DRAW — BACK TO EMPTY ==');
 await p.evaluate(async()=>{ await Game.clearSeats(); });
 await p.waitForTimeout(900);
 ok('seats_gone_again', await p.locator('.bseat').count()===0, await p.locator('.bseat').count());
 ok('table_hidden_again', await p.locator('#nightSec').isVisible()===false);

 ok('no_page_errors', errs.length===0, errs);
 await b.close();srv.close();
 console.log(fails.length? '\n'+fails.length+' FAILED: '+fails.join(', ') : '\nPASSED — the table is empty until Nate draws seats');
 process.exit(fails.length?1:0);
})();
