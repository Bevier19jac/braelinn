/* OUT IS OUT — the 15 Sep bug, reproduced and fixed.

   Jacob tapped "I'm out" at 10:31:35. Nate marked Pettis out at 10:31:51.
   Nate confirmed Jacob at 10:32:26. The record had Jacob outlasting a man
   he had already finished behind, because the finishing place was stamped
   at CONFIRMATION time instead of at the moment he said he was out. */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};

(async()=>{await new Promise(r=>srv.listen(8995,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8995/';

 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>localStorage.setItem('bpl_me','Nate'));
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 await p.evaluate(()=>sessionStorage.setItem('bpl_admin_ok','1'));
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(900);

 const F = ['Nate','Jacob','Chris P','Philo','Tod','Syd','Guy','Steele'];
 const setup = names => p.evaluate(async N=>{
   await DB.set('results', null); await DB.set('config/money', null);
   await Game.resetNight(); await Game.start();
   for (const n of N) await Game.checkIn(n,{});
   await Game.drawSeats(1); await Game.setStatus('running'); await Game.timerStart();
 }, names);

 console.log('\n== 1. THE NIGHT OF 15 SEPTEMBER, REPLAYED ==');
 await setup(F);
 const night = await p.evaluate(async()=>{
   /* Jacob taps "I'm out" and names who got him. */
   await Game.selfOut('Jacob', 'Philo');
   const jacobAt = Game.state().players['Jacob'].bustAt;
   /* Sixteen seconds later the host marks Pettis out from master control. */
   await new Promise(r=>setTimeout(r, 40));
   await Game.confirmOut('Chris P', null, null);
   const pettisAt = Game.state().players['Chris P'].bustAt;
   return {
     jacobAt, pettisAt,
     jacobOut: Game.state().players['Jacob'].status,
     jacobPlace: Game.placeOf('Jacob'),
     pettisPlace: Game.placeOf('Chris P'),
     outBy: Game.outBy('Jacob'),
     queue: Game.pendingReports().length
   };
 });
 say('places', {jacob: night.jacobPlace, pettis: night.pettisPlace});
 ok('the tap alone puts him out — no host needed', night.jacobOut==='out', night.jacobOut);
 ok('and it is stamped when HE said it, before Pettis',
    night.jacobAt < night.pettisAt, {jacob: night.jacobAt, pettis: night.pettisAt});
 ok('so he finishes BEHIND the man who outlasted him',
    night.jacobPlace > night.pettisPlace, {jacob: night.jacobPlace, pettis: night.pettisPlace});
 ok('his killer is credited from his own answer', night.outBy==='Philo', night.outBy);
 ok('and nothing is left in the host queue', night.queue===0, night.queue);

 console.log('\n== 2. A CONFIRMED REPORT USES THE REPORT TIME, NOT THE CONFIRM TIME ==');
 await setup(F);
 const legacy = await p.evaluate(async()=>{
   /* An old-style report, still possible if one is sitting in the queue. */
   const id = await Game.report('Jacob', 'out', 'Philo');
   const reportedAt = Game.pendingReports().find(r=>r.id===id).at;
   await new Promise(r=>setTimeout(r, 60));
   await Game.confirmOut('Chris P', null, null);           // host does someone else first
   await new Promise(r=>setTimeout(r, 60));
   await Game.confirmOut('Jacob', id, null);               // ...and gets to Jacob late
   const ps = Game.state().players;
   return { reportedAt, jacobAt: ps['Jacob'].bustAt, pettisAt: ps['Chris P'].bustAt,
            jacobPlace: Game.placeOf('Jacob'), pettisPlace: Game.placeOf('Chris P'),
            outBy: Game.outBy('Jacob'), queue: Game.pendingReports().length };
 });
 say('report vs confirm', {reported: legacy.reportedAt, stamped: legacy.jacobAt});
 ok('the stamp is the moment he reported', legacy.jacobAt===legacy.reportedAt, legacy);
 ok('so a slow host still cannot reorder the table',
    legacy.jacobPlace > legacy.pettisPlace, {jacob: legacy.jacobPlace, pettis: legacy.pettisPlace});
 ok('the report is cleared', legacy.queue===0, legacy.queue);

 console.log('\n== 3. A MIS-TAP IS STILL CHEAP ==');
 await setup(F);
 const oops = await p.evaluate(async()=>{
   await Game.selfOut('Jacob', 'Philo');
   const wasOut = Game.state().players['Jacob'].status;
   await Game.reinstate('Jacob');
   const s = Game.state();
   return { wasOut, backIn: Game.active().indexOf('Jacob')!==-1,
            bustAt: s.players['Jacob'].bustAt || null,
            outBy: Game.outBy('Jacob'),
            hasSeat: s.seats.order.indexOf('Jacob')!==-1,
            alive: Game.active().length, seated: s.seats.order.length };
 });
 say('after reinstate', oops);
 ok('one tap puts him back in', oops.backIn && !oops.bustAt, oops);
 ok('the killer credit is wiped too', !oops.outBy, oops.outBy);
 ok('and he still has a seat', oops.hasSeat && oops.alive===oops.seated, oops);

 console.log('\n== 4. MASTER CONTROL CAN ENTER A HIGH HAND FOR ANYBODY ==');
 await setup(F);
 const hh = await p.evaluate(async()=>{
   /* Erik V is not on his phone. The host enters it for him. */
   await Game.claimHighHand('Tod', 'flush', 'ace high', true);
   const first = Game.highHand();
   /* A better one, entered by the host, overrides. */
   await Game.claimHighHand('Syd', 'quads', 'quad 10s, ace kicker', true);
   const second = Game.highHand();
   /* And the host can overrule DOWNWARD -- he was told wrong the first time. */
   await Game.claimHighHand('Guy', 'straight', 'wheel', true);
   const third = Game.highHand();
   const err = await Game.claimHighHand('Tod', 'pair', '', false).then(()=>null, e=>e.message);
   return { first, second, third, playerBlocked: err };
 });
 say('host entries', {first: hh.first.name+'/'+hh.first.cat,
                      second: hh.second.name+'/'+hh.second.cat,
                      third: hh.third.name+'/'+hh.third.cat});
 ok('the host can enter one for a player who never opened the app',
    hh.first.name==='Tod' && hh.first.cat==='flush', hh.first);
 ok('a better hand replaces it', hh.second.cat==='quads' && hh.second.name==='Syd', hh.second);
 ok('the note comes through', hh.second.note==='quad 10s, ace kicker', hh.second.note);
 ok('the host can also correct it downward', hh.third.cat==='straight', hh.third);
 ok('but a PLAYER still cannot claim over a better hand', !!hh.playerBlocked, hh.playerBlocked);

 const panel = await p.evaluate(()=>{
   const c = document.getElementById('hhCard');
   return { exists: !!c, hidden: c ? c.hidden : null,
            hasButton: !!(c && c.querySelector('#btnHhSet')),
            text: c ? c.innerText.replace(/\s+/g,' ').slice(0,90) : '' };
 });
 say('master control panel', panel);
 ok('the panel is on the page for the host', panel.exists && !panel.hidden, panel);
 ok('with a button to enter one', panel.hasButton, panel);

 console.log('\n== 5. THE WHOLE NIGHT STILL FINALIZES ==');
 const fin = await p.evaluate(async()=>{
   const a = Game.active();
   for (let i=a.length-1; i>0; i--) await Game.confirmOut(a[i], null, a[0]);
   const rec = await Game.finalize();
   return { field: rec.field, winner: rec.winner,
            places: rec.finish.map(r=>r.place).sort((x,y)=>x-y),
            high: rec.highHand && rec.highHand.name };
 });
 ok('places run 1..N', fin.places.every((v,i)=>v===i+1) && fin.field===8, fin);
 ok('and the high hand is baked into the record', !!fin.high, fin.high);

 console.log('\n== 6. NOTHING THREW ==');
 ok('no page errors', errs.length===0, errs);

 console.log(fails.length ? '\n' + fails.length + ' FAILED:\n  ' + fails.join('\n  ')
                          : '\nALL PASSED');
 await b.close(); srv.close(); process.exit(fails.length?1:0);
})();
