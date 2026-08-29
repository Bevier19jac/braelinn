const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
(async()=>{await new Promise(r=>srv.listen(8955,r));
 const b=await chromium.launch();
 const B='http://localhost:8955/';

 // ---------- PLAYER (no PIN, never unlocked) ----------
 const pc=await b.newContext({viewport:{width:390,height:844}});
 await pc.route('**/gstatic.com/**',r=>r.abort());
 const pl=await pc.newPage(); const errs=[]; pl.on('pageerror',e=>errs.push(e.message));

 console.log('\n== 1. PLAYER RSVPs ON "TONIGHT" ==');
 // wipe any leftover night first, from the game page where Game exists
 // /* The Table now bounces anyone not signed in to the sign-in screen, so seed an identity before the first load. */
 await pl.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await pl.evaluate(()=>{try{localStorage.setItem('bpl_me','Nate')}catch(e){}});
 await pl.goto(B+'game.html',{waitUntil:'networkidle'}); await pl.waitForTimeout(600);
 await pl.evaluate(async()=>{ try{localStorage.clear();sessionStorage.clear();localStorage.setItem('bpl_me','Nate')}catch(e){}; await Game.resetNight(); });
 await pl.goto(B+'index.html',{waitUntil:'networkidle'}); await pl.waitForTimeout(900);
 /* Syd signs in and taps her own button -- the roster list is gone. */
 await pl.evaluate(()=>{try{localStorage.removeItem('bpl_me')}catch(e){}});
 await pl.reload({waitUntil:'networkidle'}); await pl.waitForTimeout(900);
 await pl.click('.si-row[data-n="Syd"]'); await pl.waitForTimeout(700);
 await pl.click('#myRsvp .mychip.in'); await pl.waitForTimeout(600);
 say('Syd RSVP is', await pl.locator('#myRsvp .mychip.on').innerText());

 console.log('\n== 2. GAME NIGHT: CAN THE PLAYER CHECK THEMSELVES IN? ==');
 await pl.goto(B+'game.html',{waitUntil:'networkidle'}); await pl.waitForTimeout(900);
 await pl.evaluate(()=>localStorage.setItem('bpl_me','Syd'));
 await pl.reload({waitUntil:'networkidle'}); await pl.waitForTimeout(900);
 say('sees Master Control button', await pl.locator('#btnMaster').isVisible());
 say('sees a check-in control', await pl.locator('#checkinList').count()>0 && await pl.locator('#checkinList').isVisible());
 say('what the player actually sees', (await pl.locator('.wrap').innerText()).replace(/\s+/g,' ').slice(0,220));
 say('blank_page', (await pl.locator('.wrap').innerText()).trim()==='');

 // ---------- HOST ----------
 console.log('\n== 3. HOST CHECKS PEOPLE IN AND DRAWS SEATS ==');
 const hc=await b.newContext({viewport:{width:390,height:844}});
 await hc.route('**/gstatic.com/**',r=>r.abort());
 const ho=await hc.newPage();
 await ho.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await ho.evaluate(()=>{try{localStorage.setItem('bpl_me','Jacob')}catch(e){}});
 await ho.goto(B+'game.html',{waitUntil:'networkidle'});
 await ho.evaluate(async()=>{ sessionStorage.setItem('bpl_admin_ok','1'); localStorage.setItem('bpl_me','Nate');
   await Game.start();
   for(const n of ['Nate','Jacob','Aaron','Tod','Syd','Guy','Tim','Drew','Steele','Philo','Erik V','Zak']) await Game.checkIn(n,{});
   await Game.drawSeats(2); await Game.setStatus('running'); await Game.timerStart(); });
 await ho.waitForTimeout(1100);
 say('host drew tables', await ho.locator('.felt-tabs button').count());

 console.log('\n== 4. PLAYER SEES THEIR TABLE ==');
 // local mode is per-browser, so drive the same page for the player view
 await pl.evaluate(async()=>{ sessionStorage.setItem('bpl_admin_ok','1');
   await Game.start();
   for(const n of ['Nate','Jacob','Aaron','Tod','Syd','Guy','Tim','Drew','Steele','Philo','Erik V','Zak']) await Game.checkIn(n,{});
   await Game.drawSeats(2); await Game.setStatus('running'); await Game.timerStart();
   Admin.lock(); sessionStorage.removeItem('bpl_admin_ok'); });
 await pl.reload({waitUntil:'networkidle'}); await pl.waitForTimeout(1300);
 say('table visible to player', await pl.locator('.bseat').count()>0);
 say('their own seat highlighted', await pl.locator('.bseat.mine').count()===1);
 const mine = await pl.locator('.felt-tabs button.on').innerText();
 say('opens on', mine);

 console.log('\n== 5. PLAYER UPDATES ONLY THEIR OWN STACK ==');
 const editable = await pl.evaluate(()=>[...document.querySelectorAll('.bseat')]
   .filter(e=>e.hasAttribute('data-stack')).map(e=>e.querySelector('.bs-nm').textContent.trim()));
 say('rows the player can tap', editable);
 await pl.locator('.bseat.mine').click(); await pl.waitForTimeout(500);
 await pl.fill('#ssChips','12750');
 await pl.locator('.stacksheet [data-save]').click(); await pl.waitForTimeout(900);
 say('their seat now reads', (await pl.locator('.bseat.mine .bs-st').innerText()).replace(/\n/g,' '));

 console.log('\n== 6. CAN THE PLAYER LOOK AT THE OTHER TABLE? ==');
 const tabs = await pl.locator('.felt-tabs button').allInnerTexts();
 say('table picker offers', tabs);
 const t1 = await pl.locator('.bseat .bs-nm').allInnerTexts();
 const cur = await pl.evaluate(()=>[...document.querySelectorAll('.felt-tabs button')].findIndex(x=>x.classList.contains('on')));
 await pl.locator('.felt-tabs button').nth(cur===0?1:0).click(); await pl.waitForTimeout(700);
 const t2 = await pl.locator('.bseat .bs-nm').allInnerTexts();
 say('other table shows', t2);
 say('different from their own', JSON.stringify(t1)!==JSON.stringify(t2));
 const canEditThere = await pl.evaluate(()=>[...document.querySelectorAll('.bseat')].filter(e=>e.hasAttribute('data-stack')).length);
 say('can they edit anyone there', canEditThere>0);
 say('player page errors', errs.length?errs:'none');
 await b.close();srv.close();})();
