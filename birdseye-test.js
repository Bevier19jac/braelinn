const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+JSON.stringify(v));
(async()=>{
 await new Promise(r=>srv.listen(8921,r));
 const b=await chromium.launch();
 const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8921/game.html',{waitUntil:'networkidle'});
 await p.waitForTimeout(700);
 await p.evaluate(async()=>{
   sessionStorage.setItem('bpl_admin_ok','1'); localStorage.setItem('bpl_me','Jacob');
   await Game.resetNight(); await Game.start();
   for(const n of ['Nate','Jacob','Aaron','Tod','Syd','Guy','Tim','Drew','Steele']) await Game.checkIn(n,{});
   await Game.addRebuy('Tod'); await Game.drawSeats(1);
   await Game.setStatus('running'); await Game.timerStart();
   const st={Nate:11800,Jacob:9350,Aaron:4200,Tod:13100,Syd:7600,Guy:5900,Tim:8250,Drew:5800,Steele:7000};
   for(const n in st) await Game.setStack(n,st[n],n);
   await Game.confirmOut('Guy');
   Admin.lock();
 });
 await p.waitForTimeout(900);

 console.log('\n== OPEN BIRD\'S EYE ==');
 say('table_button_exists', await p.locator('[data-birdseye]').count());
 await p.locator('[data-birdseye="0"]').click();
 await p.waitForTimeout(500);
 say('opened', await p.locator('.birdsheet').count()>0);
 say('seats_rendered', await p.locator('.bseat').count());
 say('my_seat_marked', await p.locator('.bseat.mine').count());
 say('busted_seat_marked', await p.locator('.bseat.dead').count());

 console.log('\n== SEATS SIT ON AN OVAL, NOT ON TOP OF EACH OTHER ==');
 const pos = await p.evaluate(()=>[...document.querySelectorAll('.bseat')].map(e=>{
   const r=e.getBoundingClientRect(); return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)};}));
 let minD=1e9;
 for(let i=0;i<pos.length;i++)for(let j=i+1;j<pos.length;j++){
   const d=Math.hypot(pos[i].x-pos[j].x,pos[i].y-pos[j].y); if(d<minD)minD=d;}
 say('closest_two_seats_px', Math.round(minD));
 say('no_overlap', minD>40);
 const xs=pos.map(q=>q.x), ys=pos.map(q=>q.y);
 say('spread', {w:Math.max(...xs)-Math.min(...xs), h:Math.max(...ys)-Math.min(...ys)});

 console.log('\n== ONLY MY SEAT IS TAPPABLE (host locked) ==');
 const tappable = await p.evaluate(()=>[...document.querySelectorAll('.bseat')]
   .map(e=>({n:e.querySelector('.bs-nm').textContent, tap:e.hasAttribute('data-stack')})));
 say('tappable', tappable.filter(t=>t.tap).map(t=>t.n));
 say('only_me', tappable.filter(t=>t.tap).length===1 && tappable.find(t=>t.tap).n==='Jacob');

 console.log('\n== TAP MY SEAT -> STACK SHEET -> LIVE UPDATE ==');
 await p.locator('.bseat.mine').click();
 await p.waitForTimeout(400);
 say('stack_sheet_open', await p.locator('.stacksheet').count()>0);
 await p.fill('#ssChips','22222');
 await p.locator('.stacksheet [data-save]').click();
 await p.waitForTimeout(800);
 say('birdseye_still_open', await p.locator('.birdsheet').count()>0);
 say('my_seat_updated_live', (await p.locator('.bseat.mine .bs-st').innerText()).trim());

 console.log('\n== CLOSE CLEANS UP (no zombie repaints) ==');
 const before = await p.evaluate(()=>Game.state()._subs.length);
 await p.locator('.bird-head [data-no]').click();
 await p.waitForTimeout(300);
 const after = await p.evaluate(()=>Game.state()._subs.length);
 say('subscribers_before_after', {before, after});
 say('unsubscribed_on_close', after < before);
 say('sheet_gone', await p.locator('.birdsheet').count()===0);
 // prove no throw after close when state changes
 await p.evaluate(async()=>{ sessionStorage.setItem('bpl_admin_ok','1'); await Game.setStack('Nate', 4321,'Nate'); });
 await p.waitForTimeout(400);
 say('no_errors_after_close', errs.length?errs:'none');

 console.log('\n== HOST CAN TAP ANYONE ==');
 await p.evaluate(()=>{sessionStorage.setItem('bpl_admin_ok','1');window.dispatchEvent(new Event('bpl:adminchange'));});
 await p.waitForTimeout(400);
 await p.locator('[data-birdseye="0"]').click();
 await p.waitForTimeout(400);
 const hostTap = await p.evaluate(()=>[...document.querySelectorAll('.bseat')].filter(e=>e.hasAttribute('data-stack')).length);
 say('tappable_seats_as_host', hostTap);
 say('all_living_tappable', hostTap===8);

 await p.screenshot({path: __dirname + '/birdseye.png'});
 say('page_errors', errs.length?errs:'none');
 await b.close(); srv.close(); console.log('\nDONE');
})();
