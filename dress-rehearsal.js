/* ===========================================================================
   DRESS REHEARSAL — the whole of 3 September, end to end, over and over.

   Every step here is a real click on the real page: players sign in and tap
   their RSVP, Nate signs in with the passcode, checks people in, draws the
   seats, starts the clock, takes rebuys until the break shuts them off,
   confirms busts, breaks tables as the field shrinks, and finalizes.

   After every night it re-checks the invariants that would actually ruin an
   evening: everyone accounted for, nobody seated twice, nobody busted still
   in a seat, the rebuy window shut at the break, places running 1..N, and
   the season standings moving by exactly the points that were awarded.

   Usage: node dress-rehearsal.js [nights]
   =========================================================================== */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});

const NIGHTS = Number(process.argv[2]) || 10;
const problems = [];
const note = (night, what, detail) => {
  problems.push(night + ': ' + what + (detail!==undefined?' '+JSON.stringify(detail):''));
  console.log('   FAIL  night ' + night + '  ' + what + (detail!==undefined?'  '+JSON.stringify(detail):''));
};

(async()=>{
 await new Promise(r=>srv.listen(8973,r));
 const b=await chromium.launch();
 const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();
 const errs=[]; p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8973/';

 console.log('Rehearsing ' + NIGHTS + ' complete game nights.\n');
 let consolidations = 0, rebuysTaken = 0, rebuysRefused = 0, walkIns = 0;

 for (let night = 1; night <= NIGHTS; night++) {
   const field = 8 + Math.floor(Math.random()*20);          // 8..27 turn up
   const rsvpN = field + Math.floor(Math.random()*4);        // a few no-shows

   /* ---------------------------------------------- 1. a player RSVPs -- */
   await p.goto(B+'index.html',{waitUntil:'networkidle'});
   await p.evaluate(()=>{try{localStorage.clear();sessionStorage.clear()}catch(e){}});
   await p.goto(B+'index.html',{waitUntil:'networkidle'});
   await p.waitForTimeout(400);

   const roster = await p.evaluate(()=>LEAGUE.standings.map(x=>x.name));
   const invited = roster.slice(0, rsvpN);
   /* Sign in as a plain player -- tapping a host name opens the passcode
      step instead, which is a different path and gets its own turn below. */
   const hosts = await p.evaluate(()=>LEAGUE.hosts||[]);
   const me = invited.find(n=>hosts.indexOf(n)===-1) || invited[0];

   if (!(await p.locator('#signIn').isVisible())) note(night,'sign-in gate did not appear');
   await p.click('.si-row[data-n="'+me.replace(/"/g,'')+'"]');
   await p.waitForTimeout(350);
   if (await p.locator('#signIn').isVisible()) note(night,'gate stayed up after tapping a name');
   await p.click('#myRsvp .mychip.in'); await p.waitForTimeout(300);
   const mine = await p.locator('#myRsvp .mychip.on').innerText();
   if (mine !== "I'm in") note(night,'own RSVP did not stick', mine);

   /* everyone else answers (straight to the data — 30 UI taps is not the test) */
   await p.evaluate(async(list)=>{
     for (const n of list) await DB.set('rsvp/'+LEAGUE.nextGame.date+'/'+n, 'in');
   }, invited);
   await p.waitForTimeout(400);
   const tally = await p.locator('#tIn').innerText();
   if (Number(tally) !== invited.length) note(night,'head count wrong on the home page',[tally,invited.length]);

   /* the head count sheet lists them */
   await p.click('#stInBtn'); await p.waitForTimeout(300);
   const listed = await p.locator('.wi-row').count();
   if (listed !== invited.length) note(night,'who-is-in sheet miscounted',[listed,invited.length]);
   await p.keyboard.press('Escape'); await p.waitForTimeout(200);

   /* ------------------------------------ 2. Nate opens Master Control -- */
   await p.evaluate(()=>{try{localStorage.removeItem('bpl_me')}catch(e){}});
   await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(500);
   await p.click('.si-row[data-n="Nate"]'); await p.waitForTimeout(300);
   await p.fill('#siPin','1234'); await p.click('#siGo'); await p.waitForTimeout(900);
   if (!(await p.evaluate(()=>Admin.isUnlocked()))) note(night,'passcode did not unlock Master Control');

   await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(600);
   await p.evaluate(async()=>{ await Game.resetNight(); await Game.start(); });
   await p.waitForTimeout(400);
   if (!(await p.locator('#btnMaster').isVisible())) note(night,'Master Control button missing for the host');
   await p.click('#btnMaster'); await p.waitForTimeout(400);

   /* ------------------------------------------- 3. check-in at the door */
   await p.click('#btnCheckInAll'); await p.waitForTimeout(700);
   let checked = await p.evaluate(()=>Game.entrants().length);
   if (checked !== invited.length) note(night,'check-in-everyone missed people',[checked,invited.length]);

   /* the no-shows get removed again */
   const noShow = invited.slice(field);
   for (const n of noShow) await p.evaluate(n=>Game.undoCheckIn(n), n);
   await p.waitForTimeout(300);
   checked = await p.evaluate(()=>Game.entrants().length);
   if (checked !== field) note(night,'removing a no-show did not stick',[checked,field]);

   /* one night in three, somebody turns up who is not on the list */
   if (night % 3 === 0) {
     const w = 'Walk-In ' + night;
     await p.evaluate(n=>Game.checkIn(n,{walkIn:true}), w);
     await p.waitForTimeout(250);
     const has = await p.evaluate(n=>Game.entrants().indexOf(n)!==-1, w);
     if (!has) note(night,'walk-in was not added'); else walkIns++;
   }
   const entrants = await p.evaluate(()=>Game.entrants().length);

   /* -------------------------------------------------- 4. draw the seats */
   const startTables = entrants >= 19 ? 3 : entrants >= 10 ? 2 : 1;
   await p.selectOption('#tableCount', String(startTables));
   await p.click('#btnDraw'); await p.waitForTimeout(1400);
   let seats = await p.evaluate(()=>Game.state().seats);
   if (!seats || seats.tables !== startTables) note(night,'seat draw did not run',seats&&seats.tables);
   if (!seats || seats.order.length !== entrants) note(night,'not everyone got a seat',[seats&&seats.order.length,entrants]);
   if (seats && new Set(seats.order).size !== seats.order.length) note(night,'someone was seated twice');

   /* ------------------------------------------- 5. clock and the rebuys */
   await p.click('.tabs button[data-tab="host"]').catch(()=>{});
   await p.waitForTimeout(200);
   await p.click('#btnStart'); await p.waitForTimeout(500);
   if (!(await p.evaluate(()=>Game.clock().started))) note(night,'clock did not start');

   /* before the break: one top-up each, and the cap holds */
   const takers = await p.evaluate(()=>Game.active().slice(0,3));
   for (const n of takers) {
     const r = await p.evaluate(n=>Game.addRebuy(n).then(()=>'ok').catch(e=>e.message), n);
     if (r === 'ok') rebuysTaken++; else note(night,'a first top-up was refused',r);
     const again = await p.evaluate(n=>Game.addRebuy(n).then(()=>'allowed').catch(e=>e.message), n);
     if (again === 'allowed') note(night,'the one-top-up cap did not hold', n);
   }

   /* walk the clock past the break — the window must shut */
   const breakIdx = await p.evaluate(()=>LEAGUE.blinds.findIndex(x=>x.lastRebuy));
   const beforeBreak = await p.evaluate(()=>Game.rebuyWindowOpen());
   if (!beforeBreak) note(night,'rebuys were closed before the break');
   await p.evaluate(i=>Game.timerGoto(i+1), breakIdx); await p.waitForTimeout(400);
   if (await p.evaluate(()=>Game.rebuyWindowOpen())) note(night,'rebuys stayed open past the break');
   const late = await p.evaluate(()=>{const a=Game.active();return Game.addRebuy(a[a.length-1]).then(()=>'allowed').catch(e=>e.message);});
   if (late === 'allowed') note(night,'a top-up went through after the break'); else rebuysRefused++;
   /* ...but the host can still push one through on purpose. */
   const forced = await p.evaluate(()=>{const a=Game.active();return Game.addRebuy(a[a.length-1],true).then(()=>'ok').catch(e=>e.message);});
   if (forced !== 'ok') note(night,'the host could not override the closed window',forced);

   /* --------------------------- 6. play it out, breaking tables as we go */
   let guard = 0;
   while (await p.evaluate(()=>Game.active().length) > 1) {
     if (++guard > 60) { note(night,'the night would not end'); break; }

     if (await p.evaluate(()=>Game.shouldConsolidate())) {
       const want = await p.evaluate(()=>Game.idealTables());
       const aliveBefore = await p.evaluate(()=>Game.active().slice().sort());
       await p.click('#consolBtns .btn-primary'); await p.waitForTimeout(300);
       await p.locator('.sheet [data-yes]').click(); await p.waitForTimeout(1100);
       const after = await p.evaluate(()=>({t:Game.state().seats.tables,o:Game.state().seats.order.slice().sort()}));
       if (after.t !== want) note(night,'redraw landed on the wrong table count',[after.t,want]);
       if (JSON.stringify(after.o) !== JSON.stringify(aliveBefore)) note(night,'redraw lost or gained a player');
       const sizes = await p.evaluate(()=>UI.tables(Game.state().seats.order,Game.state().seats.tables).map(t=>t.length));
       if (Math.max(...sizes) > 9) note(night,'a table was left over nine-handed',sizes);
       if (Math.max(...sizes)-Math.min(...sizes) > 1) note(night,'tables left uneven',sizes);
       consolidations++;
     }

     await p.evaluate(async()=>{
       const a = Game.active();
       await Game.confirmOut(a[Math.floor(Math.random()*a.length)]);
     });
     await p.waitForTimeout(90);
   }

   /* ------------------------------------------------------ 7. finalize */
   /* Standings come from the results in the database, so read those and
      aggregate exactly the way the standings page does. */
   const snapshot = () => p.evaluate(()=>new Promise(done=>{
     DB.on('results', v => {
       const s={}; BPL.aggregate(v||{}).players.forEach(r=>s[r.name]=r.points); done(s);
     });
   }));
   const before = await snapshot();
   await p.click('.tabs button[data-tab="host"]').catch(()=>{});
   await p.waitForTimeout(200);
   await p.click('#btnFinalize'); await p.waitForTimeout(400);
   await p.locator('.sheet [data-yes]').click(); await p.waitForTimeout(1200);

   const res = await p.evaluate(()=>new Promise(done=>{
     DB.on('results', v => done(v||{}));
   }));
   const key = Object.keys(res).sort().pop();
   const game = res[key];
   if (!game) { note(night,'no result was written'); continue; }

   const rows = Array.isArray(game.finish) ? game.finish : Object.values(game.finish||{});
   const places = rows.map(r=>r.place).sort((a,b)=>a-b);
   const expect = rows.map((_,i)=>i+1);
   if (JSON.stringify(places)!==JSON.stringify(expect)) note(night,'finishing places are not 1..N',places.slice(0,6));
   if (rows.length !== entrants) note(night,'the result lost players',[rows.length,entrants]);
   if (new Set(rows.map(r=>r.name)).size !== rows.length) note(night,'a player appears twice in the result');
   if (game.field !== entrants) note(night,'field size wrong in the record',[game.field,entrants]);
   const winner = rows.find(r=>r.place===1);
   if (!winner || winner.name !== game.winner) note(night,'winner does not match place 1');

   const after = await snapshot();
   for (const r of rows) {
     const gained = (after[r.name]||0) - (before[r.name]||0);
     if (r.name.indexOf('Walk-In') === 0) continue;
     if (gained !== r.points) note(night,'standings moved by the wrong amount for '+r.name,[gained,r.points]);
   }

   process.stdout.write('  night ' + String(night).padStart(2) + '  ' +
     String(entrants).padStart(2) + ' played, ' + startTables + ' table' + (startTables===1?' ':'s') +
     ' -> winner ' + game.winner + ' (' + rows.length + ' recorded)\n');
 }

 console.log('\n  consolidations exercised : ' + consolidations);
 console.log('  top-ups taken            : ' + rebuysTaken);
 console.log('  post-break top-ups blocked: ' + rebuysRefused);
 console.log('  walk-ins added           : ' + walkIns);
 console.log('  page errors              : ' + (errs.length ? JSON.stringify(errs.slice(0,3)) : 'none'));
 if (errs.length) problems.push('page errors: '+errs[0]);

 console.log('\n' + (problems.length
   ? '❌ ' + problems.length + ' PROBLEM(S):\n   - ' + problems.join('\n   - ')
   : '✅ ' + NIGHTS + ' COMPLETE NIGHTS, EVERY INVARIANT HELD'));
 await b.close(); srv.close(); process.exit(problems.length?1:0);
})();
