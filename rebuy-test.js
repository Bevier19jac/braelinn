const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
const openMine = async p => { await p.locator('.bseat.mine').click(); await p.waitForTimeout(450); };
(async()=>{await new Promise(r=>srv.listen(8957,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8957/';
 // /* The Table now bounces anyone not signed in to the sign-in screen, so seed an identity before the first load. */
 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{try{localStorage.setItem('bpl_me','Nate')}catch(e){}});
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 await p.evaluate(async()=>{ try{localStorage.clear();sessionStorage.clear();localStorage.setItem('bpl_me','Nate')}catch(e){}
   sessionStorage.setItem('bpl_admin_ok','1');
   await Game.resetNight(); await Game.start();
   for(const n of ['Nate','Jacob','Aaron','Tod','Syd','Guy']) await Game.checkIn(n,{});
   await Game.drawSeats(1); await Game.setStatus('running'); await Game.timerStart();
   localStorage.setItem('bpl_me','Syd'); Admin.lock(); sessionStorage.removeItem('bpl_admin_ok'); });
 await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(1200);

 console.log('\n== PLAYER SEES THEIR OWN MONEY ==');
 await openMine(p);
 say('their money box', (await p.locator('#ssMoney').innerText()).replace(/\n+/g,' | '));
 ok('shows_what_theyre_in_for', (await p.locator('#ssMoney').innerText()).includes('$30'));
 ok('top_up_button_offered', await p.locator('[data-rebuy]').count()===1);

 console.log('\n== THEY TAKE THE TOP-UP ==');
 await p.click('[data-rebuy]'); await p.waitForTimeout(400);
 await p.evaluate(()=>{const y=[...document.querySelectorAll('.sheet-wrap button')].find(b=>/Yes, I paid/i.test(b.textContent)); if(y)y.click();});
 await p.waitForTimeout(900);
 const after = await p.evaluate(()=>{const pl=Game.state().players['Syd'];
   return {rebuys:pl.rebuys, by:pl.rebuyBy, at:!!pl.rebuyAt, self:Game.selfClaimed('Syd'), pot:Game.pot()};});
 say('stored', {rebuys:after.rebuys, claimedBy:after.by, self:after.self});
 ok('rebuy_counted_immediately', after.rebuys===1);
 ok('records_who_claimed_it', after.by==='Syd' && after.at);
 ok('pot_went_up', after.pot.gross===7*30, after.pot.gross);
 ok('seat_shows_it', (await p.locator('.bseat.mine .bs-nm').innerText()).includes('+1r'));

 console.log('\n== THEY CANNOT TAKE A SECOND ==');
 await openMine(p);
 say('money box now', (await p.locator('#ssMoney').innerText()).replace(/\n+/g,' | '));
 ok('button_gone', await p.locator('[data-rebuy]').count()===0);
 const blocked = await p.evaluate(()=>Game.claimRebuy('Syd').then(()=>null,e=>e.message));
 ok('engine_refuses_a_second', /already used/i.test(blocked||''), blocked);
 await p.keyboard.press('Escape'); await p.waitForTimeout(300);

 console.log('\n== NATE SEES IT WAS SELF-REPORTED ==');
 await p.evaluate(()=>{sessionStorage.setItem('bpl_admin_ok','1');window.dispatchEvent(new Event('bpl:adminchange'));});
 await p.waitForTimeout(500); await p.click('#btnMaster'); await p.waitForTimeout(600);
 const tracker = await p.evaluate(()=>[...document.querySelectorAll('#rebuyList .trk-row')]
   .map(r=>r.querySelector('.nm').textContent.trim()+' '+r.querySelector('.pl').innerText.replace(/\n/g,' ')));
 say('tracker', tracker.join('  |  '));
 ok('marks_self_reported', tracker.some(t=>/Syd.*said so/i.test(t)), tracker.filter(t=>t.startsWith('Syd')));
 ok('host_added_not_marked', !tracker.some(t=>/Nate.*said so/i.test(t)));

 console.log('\n== HOST CAN TAKE IT BACK ==');
 await p.evaluate(()=>{const b=[...document.querySelectorAll('#rebuyList button[data-rb-]')].find(x=>x.getAttribute('data-rb-')==='Syd'); b.click();});
 await p.waitForTimeout(900);
 ok('undone', await p.evaluate(()=>(Game.state().players['Syd'].rebuys||0))===0);

 console.log('\n== WINDOW CLOSES AT THE BREAK ==');
 const win = await p.evaluate(()=>{
   const before = Game.rebuyWindowOpen();
   const brk = LEAGUE.blinds.findIndex(b=>b.lastRebuy);
   return {open_at_start: before, breakIndex: brk, levelsBeforeBreak: brk};
 });
 say('window', win);
 ok('open_at_start', win.open_at_start);
 const late = await p.evaluate(async()=>{
   sessionStorage.setItem('bpl_admin_ok','1');
   await Game.timerGoto(LEAGUE.blinds.findIndex(b=>b.lastRebuy)+1);   // past the break
   return {open: Game.rebuyWindowOpen(), err: await Game.claimRebuy('Guy').then(()=>null,e=>e.message)};
 });
 say('after the break', late);
 ok('closed_after_break', late.open===false && /closed/i.test(late.err||''), late);

 ok('no_page_errors', errs.length===0, errs);
 await b.close();srv.close();
 console.log(fails.length? '\n'+fails.length+' FAILED: '+fails.join(', ') : '\nALL PASSED');
 process.exit(fails.length?1:0);
})();
