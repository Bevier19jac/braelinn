/* HUNT III — seating, the clock, and the felt under conditions a real room
   produces: latecomers after the draw, consolidating down to heads-up, a
   reinstated player who was never seated, and two hosts acting at once. */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
(async()=>{await new Promise(r=>srv.listen(8999,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8999/';
 const setup = (names, tables) => p.evaluate(async([N,T])=>{
   await DB.set('results', null); await DB.set('config/money', null);
   await Game.resetNight(); await Game.start();
   for (const n of N) await Game.checkIn(n,{});
   await Game.drawSeats(T); await Game.setStatus('running'); await Game.timerStart();
 }, [names, tables]);
 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>localStorage.setItem('bpl_me','Nate'));
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 await p.evaluate(()=>sessionStorage.setItem('bpl_admin_ok','1'));
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(800);

 const F12 = ['Nate','Jacob','Aaron','Tod','Syd','Guy','Tim','Drew','Steele','Philo','Erik V','Zak'];

 console.log('\n== 1. A LATECOMER AFTER THE SEATS ARE DRAWN ==');
 await setup(F12, 2);
 const late = await p.evaluate(async()=>{
   await Game.checkIn('Matt M', {late:true});
   const n = await Game.seatLatecomer('Matt M');
   const s = Game.state().seats;
   return { seated: n, order: s.order.length, field: Game.fieldSize(),
            everyoneSeated: Game.entrants().every(x=>s.order.indexOf(x)!==-1),
            dupes: s.order.length !== new Set(s.order).size };
 });
 say('after a latecomer', late);
 ok('they get a seat', late.order===13 && late.field===13, late);
 ok('and nobody is seated twice', !late.dupes);
 ok('everyone in the field has a seat', late.everyoneSeated);
 const places = await p.evaluate(async()=>{
   const a = Game.active(); for (let i=0;i<a.length-1;i++) await Game.confirmOut(a[a.length-1-i], null, a[0]);
   const rec = await Game.finalize();
   return { field: rec.field, places: rec.finish.map(r=>r.place).sort((x,y)=>x-y) };
 });
 ok('places still run 1..N with the late entry', places.field===13 &&
    places.places.every((v,i)=>v===i+1), places);

 console.log('\n== 2. CONSOLIDATING ALL THE WAY DOWN TO HEADS-UP ==');
 await setup(F12, 3);
 const down = await p.evaluate(async()=>{
   const steps = [];
   while (Game.active().length > 2) {
     if (Game.shouldConsolidate()) {
       const want = Game.idealTables();
       await Game.consolidate(want);
       const s = Game.state().seats;
       const sizes = UI.tables(s.order, s.tables).map(t=>t.length);
       steps.push({ alive: Game.active().length, tables: s.tables, sizes: sizes,
                    seated: s.order.length });
     }
     await Game.confirmOut(Game.active()[0], null, Game.active()[1]);
   }
   const s = Game.state().seats;
   return { steps, finalTables: s.tables, finalSeated: s.order.length, alive: Game.active().length };
 });
 say('consolidation steps', down.steps);
 ok('it walked down to one table', down.finalTables===1, down.finalTables);
 ok('every step seated exactly the survivors',
    down.steps.every(s=>s.seated===s.alive), down.steps);
 ok('and no table was ever over nine-handed',
    down.steps.every(s=>Math.max.apply(null,s.sizes)<=9), down.steps);
 const hu = await p.evaluate(()=>Game.consolidate(1).then(()=>'ok').catch(e=>e.message));
 ok('heads-up can still be redrawn', hu==='ok', hu);

 console.log('\n== 3. A REINSTATED PLAYER WHO WAS BUSTED BEFORE A REDRAW ==');
 await setup(F12, 2);
 const rein = await p.evaluate(async()=>{
   await Game.confirmOut('Zak', null, 'Nate');
   await Game.consolidate(1);                    // Zak is out, so not reseated
   const beforeSeats = Game.state().seats.order.indexOf('Zak');
   await Game.reinstate('Zak');                  // ...and now he's back
   const s = Game.state().seats;
   return { seatedWhileOut: beforeSeats, backIn: Game.active().indexOf('Zak')!==-1,
            hasSeat: s.order.indexOf('Zak')!==-1, seated: s.order.length,
            alive: Game.active().length };
 });
 say('reinstated after a redraw', rein);
 ok('a busted player is not reseated', rein.seatedWhileOut===-1);
 ok('and reinstating puts them back in the field', rein.backIn);
 const orphan = rein.alive > rein.seated;
 ok('a reinstated player is not left without a seat', !orphan,
    {alive: rein.alive, seated: rein.seated});

 console.log('\n== 4. THE CLOCK, PUSHED AROUND ==');
 await setup(F12, 2);
 const clock = await p.evaluate(async()=>{
   const out = {};
   await Game.timerGoto(-5);  out.belowZero = Game.clock().index;
   await Game.timerGoto(0);
   await Game.timerPause();   out.pausedTwice = await Game.timerPause().then(()=>'ok').catch(e=>e.message);
   await Game.timerResume();  await Game.timerResume();
   out.afterDoubleResume = Game.clock().index;
   await Game.timerNudge(-99999999);
   out.afterHugeRewind = { index: Game.clock().index, bb: Game.currentBB() };
   await Game.timerReset();   out.afterReset = Game.clock().index;
   return out;
 });
 say('clock', clock);
 ok('it cannot go below level 1', clock.belowZero===0, clock.belowZero);
 ok('a huge rewind does not break it', clock.afterHugeRewind.index>=0 && clock.afterHugeRewind.bb>0, clock.afterHugeRewind);
 ok('and reset returns to the start', clock.afterReset===0);

 console.log('\n== 5. TWO HOSTS DRAWING SEATS AT THE SAME MOMENT ==');
 await setup(F12, 1);
 const race = await p.evaluate(async()=>{
   const a = Game.drawSeats(2), b = Game.drawSeats(3);
   await Promise.allSettled([a,b]);
   const s = Game.state().seats;
   return { tables: s.tables, seated: s.order.length,
            dupes: s.order.length !== new Set(s.order).size,
            everyone: Game.entrants().every(x=>s.order.indexOf(x)!==-1) };
 });
 say('after a race', race);
 ok('one draw wins cleanly', (race.tables===2||race.tables===3), race.tables);
 ok('nobody is seated twice', !race.dupes);
 ok('and nobody is left off', race.everyone);

 console.log('\n== 6. NOTHING THREW ==');
 ok('no page errors', errs.length===0, errs.slice(0,4));
 console.log('\n'+(fails.length?'FAILED: '+fails.join(', '):'ALL PASSED — nothing found'));
 await b.close(); srv.close(); process.exit(fails.length?1:0);
})();
