/* A player, from their own seat, doing the two things they own: taking their
   top-up and saying they're out. Both must reach the host and neither may
   record a finishing place on its own. */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
const openMine = async p => { await p.locator('.bseat.mine').click(); await p.waitForTimeout(500); };
(async()=>{await new Promise(r=>srv.listen(8981,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8981/';
 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{try{localStorage.setItem('bpl_me','Nate')}catch(e){}});
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 await p.evaluate(async()=>{
   try{localStorage.clear();sessionStorage.clear()}catch(e){}
   sessionStorage.setItem('bpl_admin_ok','1');
   await DB.set('results', null);
   await Game.resetNight(); await Game.start();
   for (const n of ['Nate','Jacob','Aaron','Tod','Syd','Guy']) await Game.checkIn(n,{});
   await Game.drawSeats(1); await Game.setStatus('running'); await Game.timerStart();
   localStorage.setItem('bpl_me','Syd'); Admin.lock(); sessionStorage.removeItem('bpl_admin_ok');
 });
 await p.waitForTimeout(600);
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1400);

 console.log('\n== A PLAYER OPENS THEIR OWN SEAT ==');
 ok('no_master_control', await p.locator('#btnMaster').isVisible()===false);
 await openMine(p);
 ok('sheet_is_theirs', (await p.locator('.stacksheet h3').innerText()).includes('Syd'));
 ok('their_money_shown', await p.locator('#ssMoney').count()===1);
 ok('bust_button_offered', await p.locator('#ssBust [data-imout]').count()===1);
 say('money block', (await p.locator('#ssMoney').innerText()).replace(/\n+/g,' | '));

 console.log('\n== THEY TAKE THEIR OWN TOP-UP ==');
 await p.click('#ssMoney [data-rebuy]'); await p.waitForTimeout(300);
 await p.locator('.sheet [data-yes]').click(); await p.waitForTimeout(900);
 ok('rebuy_recorded', await p.evaluate(()=>Game.state().players.Syd.rebuys)===1);
 ok('marked_as_self_claimed', await p.evaluate(()=>Game.selfClaimed('Syd')));
 ok('it_hits_the_pot', await p.evaluate(()=>Game.pot().gross)===210, await p.evaluate(()=>Game.pot().gross));
 await openMine(p);
 say('money block now', (await p.locator('#ssMoney').innerText()).replace(/\n+/g,' | '));
 ok('cannot_take_a_second', await p.locator('#ssMoney [data-rebuy]').count()===0);

 console.log('\n== THEY SAY THEY ARE OUT ==');
 await p.click('#ssBust [data-imout]'); await p.waitForTimeout(300);
 await p.locator('.sheet [data-yes]').click(); await p.waitForTimeout(900);
 const rep = await p.evaluate(()=>Game.pendingReports().map(r=>r.name+':'+r.type));
 say('reports', rep);
 ok('report_sent', rep.includes('Syd:out'));
 ok('still_active_until_confirmed', await p.evaluate(()=>Game.active().indexOf('Syd')!==-1));
 ok('no_place_recorded', await p.evaluate(()=>Game.placeOf('Syd'))===null,
    await p.evaluate(()=>Game.placeOf('Syd')));
 await openMine(p);
 ok('sheet_says_waiting', (await p.locator('#ssBust').innerText()).toLowerCase().includes('waiting'));
 await p.keyboard.press('Escape'); await p.waitForTimeout(300);

 console.log('\n== THE HOST SEES IT AND CONFIRMS ==');
 await p.evaluate(()=>{sessionStorage.setItem('bpl_admin_ok','1');});
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
 const q = await p.locator('#queue').innerText();
 say('queue', q.replace(/\n+/g,' | ').slice(0,160));
 ok('queue_shows_the_report', q.includes('Syd'));
 await p.evaluate(()=>{const r=Game.pendingReports().find(x=>x.name==='Syd');return Game.confirmOut('Syd', r&&r.id);});
 await p.waitForTimeout(700);
 ok('now_out', await p.evaluate(()=>Game.active().indexOf('Syd')===-1));
 ok('place_recorded', typeof (await p.evaluate(()=>Game.placeOf('Syd')))==='number');
 ok('report_cleared', await p.evaluate(()=>Game.pendingReports().length)===0);

 console.log('\n== AND THEIR TOP-UP IS IN THE FINAL RECORD ==');
 const rec = await p.evaluate(async()=>{
   const a = Game.active(); for (let i=0;i<a.length-1;i++) await Game.confirmOut(a[a.length-1-i]);
   return Game.finalize();
 });
 const syd = rec.finish.find(r=>r.name==='Syd');
 say('Syd row', syd);
 ok('rebuy_on_the_record', syd.rebuys===1);
 ok('gross_includes_it', rec.gross===210, rec.gross);

 ok('no_page_errors', errs.length===0, errs.slice(0,3));
 console.log('\n'+(fails.length?'FAILED: '+fails.join(', '):'ALL PASSED'));
 await b.close(); srv.close(); process.exit(fails.length?1:0);
})();
