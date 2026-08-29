const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+JSON.stringify(v));
(async()=>{await new Promise(r=>srv.listen(8931,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8931/game.html',{waitUntil:'networkidle'});
 await p.evaluate(()=>{try{localStorage.clear();sessionStorage.clear();}catch(e){}});
 await p.goto('http://localhost:8931/game.html',{waitUntil:'networkidle'});
 await p.waitForTimeout(700);
 await p.evaluate(async()=>{
   localStorage.setItem('bpl_me','Jacob'); sessionStorage.setItem('bpl_admin_ok','1');
   await Game.resetNight(); await Game.start();
   for(const n of ['Nate','Jacob','Aaron']) await Game.checkIn(n,{});
 });
 await p.waitForTimeout(700);

 console.log('\n== ADD A PLAYER WHO IS NOT ON THE ROSTER ==');
 await p.evaluate(()=>{window.dispatchEvent(new Event('bpl:adminchange'));});
 await p.waitForTimeout(400);
 await p.click('#btnMaster'); await p.waitForTimeout(500);
 p.once('dialog', d => d.accept("Walk-In Dave"));
 await p.click('#btnAddPlayer'); await p.waitForTimeout(500);
 say('walkin_option_offered', await p.locator('.pickrow').first().innerText().then(t=>t.replace(/\n/g,' ')));
 await p.locator('.pickrow').first().click();
 await p.waitForTimeout(900);
 const st = await p.evaluate(()=>({
   entrants: Game.entrants(),
   onRoster: LEAGUE.standings.some(x=>x.name==='Walk-In Dave'),
   checkedIn: !!Game.state().players['Walk-In Dave'],
   pot: Game.pot()
 }));
 say('entrants', st.entrants);
 say('was_on_roster', st.onRoster);
 say('checked_in_anyway', st.checkedIn);
 say('pot_counts_them', st.pot.entries===4 && st.pot.gross===120);

 console.log('\n== THEY CAN BE SEATED AND SCORED ==');
 await p.evaluate(async()=>{
   await Game.drawSeats(1); await Game.setStatus('running'); await Game.timerStart();
   await Game.confirmOut('Aaron'); await Game.confirmOut('Nate'); await Game.confirmOut('Jacob');
 });
 await p.waitForTimeout(800);
 const seat = await p.evaluate(()=>document.querySelectorAll('.bseat').length);
 say('seated_on_felt', seat===4);
 const rec = await p.evaluate(()=>Game.finalize().then(r=>r,e=>({error:e.message})));
 say('winner', rec.winner);
 say('finish', (rec.finish||[]).map(r=>r.place+':'+r.name+'='+r.points));
 const agg = await p.evaluate(r=>{const a=BPL.aggregate({[r.gameId]:r});
   const d=a.players.find(x=>x.name==='Walk-In Dave');return {inStandings:!!d,pts:d&&d.points,wins:d&&d.wins};}, rec);
 say('in_standings', agg);
 say('page_errors', errs.length?errs:'none');
 await b.close();srv.close();})();
