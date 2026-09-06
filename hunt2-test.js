/* ===========================================================================
   HUNT II — the player's phone, and the pages everyone else looks at.
   Aimed at what a real room does: a stale phone, someone opening a page
   mid-night, a name with punctuation in it, and the season pages when the
   data is thin, weird, or hostile.
   =========================================================================== */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
(async()=>{await new Promise(r=>srv.listen(8997,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8997/';
 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>localStorage.setItem('bpl_me','Nate'));
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 await p.evaluate(()=>sessionStorage.setItem('bpl_admin_ok','1'));
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(800);

 console.log('\n== 1. A PHONE THAT REMEMBERS SOMEBODY NO LONGER ON THE ROSTER ==');
 await p.evaluate(async()=>{
   await DB.set('results', null); await Game.resetNight(); await Game.start();
 });
 await p.evaluate(()=>localStorage.setItem('bpl_me','A Guy Who Left The League'));
 await p.goto(B+'index.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1000);
 ok('the home page still loads', await p.locator('#myRsvp').count()===1);
 say('the card says', (await p.locator('#myRsvp').innerText()).replace(/\n+/g,' | ').slice(0,90));
 ok('and offers a way out', await p.locator('#btnNotMe').count()===1 || await p.locator('#btnSignIn').count()===1);
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1000);
 ok('and the table does not break', await p.locator('.wrap').count()===1);
 ok('nothing threw', errs.length===0, errs.slice(0,2));

 console.log('\n== 2. A NAME WITH PUNCTUATION AND AN APOSTROPHE ==');
 const odd = "O'Brien \"Tank\" <b>";
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(600);
 await p.evaluate(async(n)=>{
   sessionStorage.setItem('bpl_admin_ok','1');
   await Game.resetNight(); await Game.start();
   for (const x of ['Nate','Jacob','Aaron']) await Game.checkIn(x,{});
   await Game.checkIn(n,{walkIn:true});
   await Game.drawSeats(1); await Game.setStatus('running');
   await Game.claimHighHand(n, 'quads', 'quad <script>alert(1)</script>');
   await Game.confirmOut('Aaron', null, n);
 }, odd);
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
 ok('a hostile name is checked in', await p.evaluate(n=>Game.entrants().indexOf(n)!==-1, odd));
 ok('and does not execute anything', errs.length===0, errs.slice(0,2));
 const html = await p.evaluate(()=>document.body.innerHTML);
 ok('no raw script tag reached the page', html.indexOf('<script>alert') === -1);
 ok('the felt still renders', await p.locator('.bseat').count()>0, await p.locator('.bseat').count());
 const rec2 = await p.evaluate(async()=>{
   const a=Game.active(); for(let i=0;i<a.length-1;i++) await Game.confirmOut(a[a.length-1-i], null, a[0]);
   return Game.finalize();
 });
 ok('and the night finalizes', !!rec2);
 await p.goto(B+'results.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1000);
 ok('results renders it safely', (await p.locator('#gamesList').innerText()).includes("O'Brien"));
 ok('still nothing threw', errs.length===0, errs.slice(0,2));

 console.log('\n== 3. STANDINGS AND PLAYERS ON A HALF-BROKEN RESULTS FEED ==');
 await p.goto(B+'standings.html',{waitUntil:'networkidle'}); await p.waitForTimeout(600);
 await p.evaluate(async()=>{
   await DB.set('results', null);
   await DB.set('results/GOOD', {gameId:'GOOD',date:'2026-09-03',season:7,label:'x',type:'regular',
     field:4,buyinAmount:30,rebuyAmount:30,rebuys:0,gross:120,kittyPct:0,kitty:0,pot:120,winner:'Nate',
     finalizedAt:1, highHand:{name:'Nate',cat:'royal',at:1},
     finish:[{place:1,name:'Nate',points:1300,winnings:120,itm:true},
             {place:2,name:'Jacob',points:900,winnings:0,itm:false,outBy:'Nate'},
             {place:3,name:'Aaron',points:600,winnings:0,itm:false,outBy:'Nate'},
             {place:4,name:'Tod',points:300,winnings:0,itm:false,outBy:'Jacob'}]});
   /* Junk of every shape the database could plausibly contain. */
   await DB.set('results/JUNK1', 'a string');
   await DB.set('results/JUNK2', {gameId:'JUNK2'});
   await DB.set('results/JUNK3', {gameId:'J3',date:'2026-09-04',finalizedAt:2,winner:'Ghost',finish:[]});
   await DB.set('results/JUNK4', {gameId:'J4',date:'2026-09-05',finalizedAt:3,winner:'Ghost',
     finish:[{place:1,name:'Ghost',points:99999,winnings:0}], highHand:{name:'Ghost',cat:'not-a-hand',at:1}});
 });
 await p.waitForTimeout(1200);
 const board = await p.evaluate(()=>new Promise(done=>DB.on('results', v=>done({
   agg: BPL.aggregate(v||{}).players.filter(x=>x.events).map(x=>x.name+':'+x.points),
   hh: BPL.highHand(v||{}), ko: BPL.knockoutBoard(v||{}), news: BPL.newsLine(v||{})
 }))));
 say('standings from a junky feed', board.agg);
 ok('junk never reaches the standings', board.agg.every(x=>x.indexOf('Ghost')===-1), board.agg);
 ok('the real game still counts', board.agg.some(x=>x.indexOf('Nate:1300')===0), board.agg);
 say('high hand', board.hh);
 ok('an unknown hand category cannot win it', board.hh && board.hh.cat==='royal', board.hh);
 say('knockouts', board.ko);
 ok('and knockouts come only from real games', board.ko.every(r=>r.name!=='Ghost'), board.ko);
 say('news', board.news && board.news.text);
 ok('the news names a real winner', board.news && board.news.text.indexOf('Ghost')===-1, board.news);
 ok('standings page survived', await p.locator('#tbody tr').count()>0);
 await p.goto(B+'players.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1000);
 ok('players page survived', await p.locator('.rcard').count()>0);
 ok('nothing threw on either', errs.length===0, errs.slice(0,3));

 console.log('\n== 4. A PLAYER OPENS EVERY PAGE MID-NIGHT WITH NO ADMIN ==');
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(600);
 await p.evaluate(async()=>{
   sessionStorage.setItem('bpl_admin_ok','1');
   await Game.resetNight(); await Game.start();
   for (const x of ['Nate','Jacob','Aaron','Tod','Syd','Guy']) await Game.checkIn(x,{});
   await Game.drawSeats(2); await Game.setStatus('running'); await Game.timerStart();
   await Game.confirmOut('Guy', null, 'Syd');
   localStorage.setItem('bpl_me','Tod'); Admin.lock(); sessionStorage.removeItem('bpl_admin_ok');
 });
 for (const page of ['index.html','game.html','standings.html','schedule.html','results.html','players.html']) {
   await p.goto(B+page,{waitUntil:'networkidle'}); await p.waitForTimeout(700);
   const shown = await p.locator('.wrap').innerText();
   ok(page + ' renders', shown.trim().length > 40, shown.slice(0,40));
 }
 ok('no master control anywhere', await p.locator('#btnMaster').isVisible()===false);
 ok('and nothing threw across all six', errs.length===0, errs.slice(0,3));

 console.log('\n== 5. THE CLOCK RUNS PAST THE END OF THE BLIND STRUCTURE ==');
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(600);
 const clock = await p.evaluate(async()=>{
   sessionStorage.setItem('bpl_admin_ok','1');
   const last = LEAGUE.blinds.length;
   await Game.timerGoto(last + 5);
   const c = Game.clock();
   return { index: c.index, level: c.level && c.level.level, bb: Game.currentBB(), open: Game.rebuyWindowOpen() };
 });
 say('past the last level', clock);
 ok('it clamps rather than falling off the end', clock.index < 99 && clock.bb > 0, clock);
 ok('and rebuys stay closed', clock.open===false);

 console.log('\n== 6. NOTHING THREW ==');
 ok('no page errors at all', errs.length===0, errs.slice(0,4));
 console.log('\n'+(fails.length?'FAILED: '+fails.join(', '):'ALL PASSED — nothing found'));
 await b.close(); srv.close(); process.exit(fails.length?1:0);
})();
