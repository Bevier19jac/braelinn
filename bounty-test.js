/* The bounty over a run of nights, through the real page: it appears only
   after a game is in the books, stacks on back-to-back wins, comes off the
   pot, blocks finalizing until it's credited, and lands in the record. */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
(async()=>{await new Promise(r=>srv.listen(8979,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8979/';
 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{try{localStorage.clear();sessionStorage.clear();localStorage.setItem('bpl_me','Nate')}catch(e){}});
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 await p.evaluate(()=>{sessionStorage.setItem('bpl_admin_ok','1');});
 await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(900);
 await p.evaluate(()=>DB.set('results', null));
 await p.waitForTimeout(400);

 const FIELD = ['Nate','Jacob','Aaron','Tod','Syd','Guy','Tim','Drew','Steele','Philo'];

 /* Play a night where `winner` wins. killer !== null means that player takes
    the bounty. Returns the written record. */
 const night = (date, winner, killer) => p.evaluate(async ([date, winner, killer, FIELD]) => {
   window.__date = date;
   LEAGUE.schedule.push({date:date,label:'Sim',type:'regular',completed:false,note:''});
   LEAGUE.nextGame.date = date;
   location.hash = '';
   return null;
 }, [date, winner, killer, FIELD]);

 /* Simpler and more honest: drive real games at the app's real GAME_ID by
    writing finalized records the same shape finalize() writes, then check
    what the app derives from them. The last night is played for real. */
 const fakeGame = (date, winner) => p.evaluate(async ([date, winner]) => {
   await DB.set('results/'+date, {
     gameId:date, date:date, season:7, label:'Sim', type:'regular', field:10,
     buyinAmount:30, rebuyAmount:30, rebuys:0, gross:300, kittyPct:0, kitty:0,
     pot:300, bounty:0, bountyOn:null, bountyStreak:0, bountyWonBy:null,
     winner:winner, finalizedAt:Date.now(),
     finish:[{place:1,name:winner,points:3000,rebuys:0,late:false,winnings:300,bounty:0,itm:true}]
   });
 }, [date, winner]);

 console.log('\n== NO HISTORY, NO BOUNTY ==');
 ok('nothing to defend yet', await p.evaluate(()=>Game.bountyTarget())===null);
 let m = await p.evaluate(()=>Game.pot());
 ok('pot has no bounty line', m.bounty===0, m);
 ok('card is hidden', await p.locator('#bountyCard').isVisible()===false);

 console.log('\n== NATE WINS ONE: $20 ON HIS HEAD ==');
 await fakeGame('2026-08-01','Nate'); await p.waitForTimeout(600);
 let t = await p.evaluate(()=>Game.bountyTarget());
 say('target', t);
 ok('twenty_on_nate', t && t.name==='Nate' && t.amount===20, t);

 console.log('\n== NATE WINS AGAIN: IT STACKS TO $40 ==');
 await fakeGame('2026-08-15','Nate'); await p.waitForTimeout(600);
 t = await p.evaluate(()=>Game.bountyTarget());
 ok('forty_on_nate', t && t.amount===40 && t.streak===2, t);

 console.log('\n== IT COMES OFF TONIGHT\'S POT ==');
 await p.evaluate(async(F)=>{
   await Game.resetNight(); await Game.start();
   for (const n of F) await Game.checkIn(n,{});
   await Game.drawSeats(1); await Game.setStatus('running'); await Game.timerStart();
 }, FIELD);
 await p.waitForTimeout(700);
 m = await p.evaluate(()=>Game.pot());
 say('pot', m);
 ok('gross_is_ten_buyins', m.gross===300, m.gross);
 ok('bounty_off_the_top', m.bounty===40 && m.net===260, {bounty:m.bounty, net:m.net});
 const table = await p.evaluate(()=>BPL.payoutTable(Game.pot().net, Game.fieldSize(), Game.splits(Game.fieldSize())));
 say('payouts', table);
 ok('payouts_all_tens', table.every(a=>a%10===0), table);
 ok('payouts_sum_to_pot', table.reduce((a,x)=>a+x,0)===m.net, table);

 console.log('\n== MASTER CONTROL SHOWS IT ==');
 await p.click('#btnMaster'); await p.waitForTimeout(500);
 const money = p.locator('.tabs button[data-tab="money"]');
 if (await money.count()) { await money.click(); await p.waitForTimeout(500); }
 ok('bounty_card_visible', await p.locator('#bountyCard').isVisible());
 say('card', (await p.locator('#bountyCard').innerText()).replace(/\n+/g,' | '));
 say('money flow', (await p.locator('#moneyFlow').innerText()).replace(/\n+/g,' | '));
 ok('flow_shows_bounty', (await p.locator('#moneyFlow').innerText()).includes('Bounty on Nate'));
 ok('flow_shows_playing_for', (await p.locator('#moneyFlow').innerText()).includes('$260'));

 console.log('\n== HE BUSTS: THE APP ASKS WHO GOT HIM ==');
 await p.evaluate(()=>Game.confirmOut('Nate')); await p.waitForTimeout(700);
 ok('queue_chases_it', (await p.locator('#queue').innerText()).includes('who takes the $40'),
    (await p.locator('#queue').innerText()).split('\n').slice(0,3));
 const blocked = await p.evaluate(async()=>{
   const a = Game.active(); for (let i=0;i<a.length-1;i++) await Game.confirmOut(a[a.length-1-i]);
   return Game.finalize().then(()=>'allowed').catch(e=>e.message);
 });
 ok('cannot_finalize_uncredited', /bounty on Nate/.test(blocked), blocked);

 console.log('\n== CREDIT IT AND FINALIZE ==');
 await p.evaluate(()=>Game.claimBounty('Syd')); await p.waitForTimeout(600);
 ok('claim_recorded', await p.evaluate(()=>Game.bountyClaimed()));
 const rec = await p.evaluate(()=>Game.finalize());
 say('record money', {gross:rec.gross, kitty:rec.kitty, bounty:rec.bounty, pot:rec.pot,
                      on:rec.bountyOn, streak:rec.bountyStreak, wonBy:rec.bountyWonBy});
 ok('bounty_in_the_record', rec.bounty===40 && rec.bountyOn==='Nate' && rec.bountyWonBy==='Syd', rec.bountyWonBy);
 const syd = rec.finish.find(r=>r.name==='Syd');
 say('Syd row', syd);
 ok('syd_credited', syd.bounty===40);
 ok('syd_winnings_include_it', syd.winnings >= 40);
 const paid = rec.finish.filter(r=>r.itm);
 ok('itm_rows_got_the_bonus', paid.every(r=>r.points % 300 === 100), paid.map(r=>r.name+':'+r.points));
 ok('non_itm_rows_did_not', rec.finish.filter(r=>!r.itm).every(r=>r.points % 300 === 0));
 const total = rec.finish.reduce((a,r)=>a+(r.winnings||0),0);
 ok('all_money_accounted_for', total === rec.pot + rec.bounty, {paidOut:total, pot:rec.pot, bounty:rec.bounty});

 console.log('\n== AND THE STREAK RESET ==');
 await p.waitForTimeout(600);
 const after = await p.evaluate(()=>BPL.bountyOn(Game.state().results));
 say('next bounty', after);
 ok('rides_on_the_new_winner', after.name===rec.winner && after.amount===20, after);

 console.log('\n== IF THE CHAMPION WINS OUTRIGHT THEY KEEP THEIR OWN BOUNTY ==');
 /* Nobody knocked them out, so there is nowhere else for it to go -- and
    finalize must not block forever waiting for a knockout that never came. */
 {
   const c2 = await b.newContext({viewport:{width:390,height:844}});
   await c2.route('**/gstatic.com/**',r=>r.abort());
   const q = await c2.newPage();
   await q.goto(B+'index.html',{waitUntil:'domcontentloaded'});
   await q.evaluate(()=>{try{localStorage.setItem('bpl_me','Nate')}catch(e){}});
   await q.goto(B+'game.html',{waitUntil:'networkidle'});
   await q.evaluate(()=>{sessionStorage.setItem('bpl_admin_ok','1')});
   await q.goto(B+'game.html',{waitUntil:'networkidle'}); await q.waitForTimeout(900);
   const out = await q.evaluate(async(F)=>{
     await DB.set('results', null);
     const d='2026-07-01';
     await DB.set('results/'+d, {gameId:d,date:d,season:7,label:'Prior',type:'regular',field:10,
       buyinAmount:30,rebuyAmount:30,rebuys:0,gross:300,kittyPct:0,kitty:0,pot:300,
       bounty:0,bountyOn:null,bountyStreak:0,bountyWonBy:null,winner:'Tod',finalizedAt:Date.now(),
       finish:[{place:1,name:'Tod',points:3000,rebuys:0,late:false,winnings:300,bounty:0,itm:true}]});
     await new Promise(r=>setTimeout(r,500));
     await Game.resetNight(); await Game.start();
     for (const n of F) await Game.checkIn(n,{});
     await Game.drawSeats(1); await Game.setStatus('running'); await Game.timerStart();
     await new Promise(r=>setTimeout(r,400));
     /* Bust everyone except Tod -- the champion runs the table. */
     for (const n of Game.active().filter(x=>x!=='Tod')) await Game.confirmOut(n);
     const pot = Game.pot();
     const rec = await Game.finalize();
     return {pot:pot, rec:rec};
   }, FIELD);
   say('pot', {bounty:out.pot.bounty, on:out.pot.bountyOn, net:out.pot.net});
   ok('bounty_was_charged', out.pot.bounty===20, out.pot.bounty);
   ok('finalize_not_blocked', !!out.rec);
   ok('champion_won_the_night', out.rec.winner==='Tod');
   ok('champion_keeps_it', out.rec.bountyWonBy==='Tod', out.rec.bountyWonBy);
   const tod = out.rec.finish.find(r=>r.name==='Tod');
   ok('credited_on_his_row', tod.bounty===20, tod);
   const handed = out.rec.finish.reduce((a,r)=>a+(r.winnings||0),0);
   ok('money_balances', handed === out.rec.pot + out.rec.bounty, {handed, pot:out.rec.pot, bounty:out.rec.bounty});
   await c2.close();
 }

 console.log('\n== IT SHOWS ON THE RESULTS PAGE ==');
 await p.goto(B+'results.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1000);
 const txt = await p.locator('#gamesList').innerText();
 ok('results_show_kitty_line', txt.includes('Collected'), txt.split('\n').slice(0,8));
 ok('results_show_bounty_line', txt.includes('Bounty on Nate'));
 ok('results_show_who_took_it', txt.includes('Syd took it') || txt.includes('took it'), txt.split('\n').slice(0,10));
 say('top card', txt.split('\n').slice(0,10).join(' | '));

 console.log('\n== A CHAMPION WHO DOESN\'T TURN UP COSTS THE ROOM NOTHING ==');
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(900);
 await p.evaluate(async(F)=>{
   await Game.resetNight(); await Game.start();
   /* Everyone but the defending champion. Ask the GAME for the target --
      BPL.bountyOn without a date would answer about the wrong night. */
   const champ = Game.bountyTarget().name;
   for (const n of F.filter(x=>x!==champ)) await Game.checkIn(n,{});
   await Game.drawSeats(1); await Game.setStatus('running'); await Game.timerStart();
 }, FIELD);
 await p.waitForTimeout(800);
 const m2 = await p.evaluate(()=>Game.pot());
 say('pot with the champ absent', m2);
 ok('nothing_taken_off_the_pot', m2.bounty===0 && m2.net===m2.gross-m2.kitty, m2);
 ok('and_finalizing_is_not_blocked', await p.evaluate(async()=>{
   const a=Game.active(); for(let i=0;i<a.length-1;i++) await Game.confirmOut(a[a.length-1-i]);
   return Game.finalize().then(()=>true).catch(()=>false);
 }));
 await p.waitForTimeout(500);

 ok('no_page_errors', errs.length===0, errs.slice(0,3));
 console.log('\n'+(fails.length?'FAILED: '+fails.join(', '):'ALL PASSED'));
 await b.close(); srv.close(); process.exit(fails.length?1:0);
})();
