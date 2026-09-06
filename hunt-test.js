/* ===========================================================================
   HUNT — deliberately nasty things a real night can do, aimed at the newest
   surfaces: the door and the money, the high hand, the payout plan when the
   field moves under it, and knockouts through reinstatement.
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
(async()=>{await new Promise(r=>srv.listen(8993,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8993/';
 const reset = async (field) => p.evaluate(async(F)=>{
   await DB.set('results', null); await DB.set('config/money', null);
   await Game.resetNight(); await Game.start();
   for (const n of F) await Game.checkIn(n,{});
 }, field);
 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{try{localStorage.setItem('bpl_me','Nate')}catch(e){}});
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 await p.evaluate(()=>{sessionStorage.setItem('bpl_admin_ok','1')});
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(900);

 console.log('\n== 1. THE HOST REMOVES SOMEBODY WHO ALREADY PAID ==');
 await reset(['Nate','Jacob','Aaron','Tod','Syd','Guy']);
 await p.evaluate(async()=>{ await Game.settle('Guy','Guy'); await Game.undoCheckIn('Guy'); });
 await p.waitForTimeout(400);
 let m = await p.evaluate(()=>({pot:Game.pot(), col:Game.collected(), owes:Game.unpaid()}));
 say('after removing a payer', {gross:m.pot.gross, paid:m.col.paid, charged:m.col.charged});
 ok('their money leaves with them', m.col.paid===0, m.col.paid);
 ok('and so does their buy-in', m.col.charged===150 && m.pot.gross===150, [m.col.charged, m.pot.gross]);

 console.log('\n== 2. A TOP-UP AFTER PAYING RE-OPENS THE DEBT ==');
 await reset(['Nate','Jacob','Aaron','Tod','Syd','Guy']);
 await p.evaluate(async()=>{ await Game.settle('Syd','Syd'); await Game.addRebuy('Syd'); });
 await p.waitForTimeout(400);
 ok('owes the top-up', await p.evaluate(()=>Game.owes('Syd'))===30);
 await p.evaluate(()=>Game.removeRebuy('Syd')); await p.waitForTimeout(300);
 const over = await p.evaluate(()=>({owes:Game.owes('Syd'), paid:Game.paid('Syd'), charged:Game.charged('Syd')}));
 say('after the host takes the top-up back', over);
 ok('an overpayment never shows as a debt', over.owes===0, over);

 console.log('\n== 3. THE PLAN IS SET FOR A BIG FIELD, THEN SIX TURN UP ==');
 await reset(['Nate','Jacob','Aaron','Tod','Syd','Guy']);
 await p.evaluate(async()=>{ await Game.setPrizePlan(80, 4); });   // legal at 6 x $30 = $180
 await p.waitForTimeout(400);
 let plan = await p.evaluate(()=>Game.payouts(Game.pot().net, Game.fieldSize()));
 say('6 players, pay 4', plan.table);
 ok('four places', plan.table.length===4);
 /* now three of them leave */
 await p.evaluate(async()=>{ for (const n of ['Tod','Syd','Guy']) await Game.undoCheckIn(n); });
 await p.waitForTimeout(400);
 plan = await p.evaluate(()=>Game.payouts(Game.pot().net, Game.fieldSize()));
 say('3 players, still "pay 4"', plan.table || plan.error);
 ok('never more places than players', !plan.table || plan.table.length<=3, plan.table);
 if (plan.table) {
   const net = await p.evaluate(()=>Game.pot().net);
   ok('and still sums to the pot', plan.table.reduce((a,x)=>a+x,0)===net, [plan.table, net]);
 }

 console.log('\n== 4. A PLAN THAT CANNOT PAY BLOCKS THE NIGHT — LOUDLY ==');
 await reset(['Nate','Jacob','Aaron','Tod','Syd','Guy']);
 await p.evaluate(async()=>{ await Game.setPrizePlan(120, 3); });  // legal at 6 x $30 = $180
 await p.evaluate(async()=>{ for (const n of ['Tod','Syd','Guy']) await Game.undoCheckIn(n); });
 await p.waitForTimeout(600);
 const bad = await p.evaluate(()=>Game.payouts(Game.pot().net, Game.fieldSize()));
 say('3 players, $120 to first of a $90 pot', bad.error || bad.table);
 ok('it refuses rather than inventing money', !!bad.error, bad);
 const q = await p.locator('#queue').innerText();
 say('the queue says', q.replace(/\n+/g,' | ').slice(0,140));
 ok('and the host is chased about it', q.includes("payouts don't add up") || q.includes("don't add up"), q.slice(0,80));
 const blocked = await p.evaluate(async()=>{
   await Game.drawSeats(1); await Game.setStatus('running');
   const a=Game.active(); for(let i=0;i<a.length-1;i++) await Game.confirmOut(a[a.length-1-i]);
   return Game.finalize().then(()=>'allowed').catch(e=>e.message);
 });
 ok('finalize refuses too', blocked!=='allowed', blocked);
 await p.evaluate(()=>Game.setPrizePlan(null,null)); await p.waitForTimeout(400);
 const nowOk = await p.evaluate(()=>Game.finalize().then(r=>r.pot).catch(e=>e.message));
 ok('and clearing the plan unblocks it', typeof nowOk==='number', nowOk);

 console.log('\n== 5. A KITTY THAT EATS THE WHOLE POT ==');
 await reset(['Nate','Jacob']);
 await p.evaluate(()=>Game.setKittyAmount(200)); await p.waitForTimeout(400);
 const eaten = await p.evaluate(()=>({pot:Game.pot(), pay:Game.payouts(Game.pot().net, 2)}));
 say('2 players, $200 kitty', {gross:eaten.pot.gross, kitty:eaten.pot.kitty, net:eaten.pot.net, table:eaten.pay.table});
 ok('kitty never exceeds what was collected', eaten.pot.kitty<=eaten.pot.gross);
 ok('nobody is listed as paid $0', !eaten.pay.table || eaten.pay.table.every(v=>v>0), eaten.pay.table);
 const rec5 = await p.evaluate(async()=>{
   await Game.drawSeats(1); await Game.setStatus('running');
   await Game.confirmOut(Game.active()[1]);
   return Game.finalize();
 });
 say('record', {pot:rec5.pot, kitty:rec5.kitty});
 ok('and the night can still end', !!rec5);
 ok('nobody got points for a $0 cash', rec5.finish.every(r=>!r.itm), rec5.finish.map(r=>r.name+':'+r.itm));

 console.log('\n== 6. HIGH HAND, ABUSED ==');
 await reset(['Nate','Jacob','Aaron','Tod']);
 await p.evaluate(()=>Game.setKittyAmount(null));
 let r = await p.evaluate(()=>Game.claimHighHand('Jacob','nonsense','').then(()=>'allowed').catch(e=>e.message));
 ok('a made-up hand is refused', r!=='allowed', r);
 r = await p.evaluate(()=>Game.claimHighHand('','quads','').then(()=>'allowed').catch(e=>e.message));
 ok('an empty name is refused', r!=='allowed', r);
 await p.evaluate(()=>Game.claimHighHand('Jacob','quads','quad 9s')); await p.waitForTimeout(300);
 r = await p.evaluate(()=>Game.claimHighHand('Tod','quads','quad 2s').then(()=>'allowed').catch(e=>e.message));
 ok('an equal hand does not steal it', r!=='allowed', r);
 await p.evaluate(()=>Game.claimHighHand('Tod','royal','')); await p.waitForTimeout(300);
 ok('a better one does', (await p.evaluate(()=>Game.highHand())).name==='Tod');
 const longNote = 'x'.repeat(200);
 await p.evaluate(n=>Game.claimHighHand('Nate','royal',n,true), longNote); await p.waitForTimeout(300);
 const hh = await p.evaluate(()=>Game.highHand());
 ok('a silly long note is trimmed', hh.note.length<=60, hh.note.length);
 ok('and the host override works', hh.name==='Nate');

 console.log('\n== 7. A KNOCKOUT SURVIVES A MISTAKEN ELIMINATION ==');
 await reset(['Nate','Jacob','Aaron','Tod']);
 await p.evaluate(async()=>{
   await Game.drawSeats(1); await Game.setStatus('running');
   await Game.report('Tod','out','Jacob');
   const rep = Game.pendingReports().find(x=>x.name==='Tod');
   await Game.confirmOut('Tod', rep.id);
 });
 await p.waitForTimeout(400);
 ok('the killer is recorded', await p.evaluate(()=>Game.outBy('Tod'))==='Jacob');
 await p.evaluate(()=>Game.reinstate('Tod')); await p.waitForTimeout(300);
 ok('reinstating wipes it', await p.evaluate(()=>Game.outBy('Tod'))===null);
 ok('and no stale report is left', await p.evaluate(()=>Game.reportedBy('Tod'))===null);
 await p.evaluate(()=>Game.confirmOut('Tod')); await p.waitForTimeout(300);
 ok('re-busting does not resurrect the old answer', await p.evaluate(()=>Game.outBy('Tod'))===null);

 console.log('\n== 8. A PLAYER NAMES THEMSELVES, OR A GHOST ==');
 await reset(['Nate','Jacob','Aaron','Tod']);
 await p.evaluate(async()=>{
   await Game.drawSeats(1); await Game.setStatus('running');
   await Game.confirmOut('Tod', null, 'Tod');
 });
 await p.waitForTimeout(300);
 ok('you cannot knock yourself out', await p.evaluate(()=>Game.outBy('Tod'))===null);
 await p.evaluate(()=>Game.confirmOut('Aaron', null, 'Somebody Who Was Not There'));
 await p.waitForTimeout(300);
 ok('nor can a stranger', await p.evaluate(()=>Game.outBy('Aaron'))===null);

 console.log('\n== 9. THE WHOLE FIELD REBUYS AND THE MONEY STILL BALANCES ==');
 await reset(['Nate','Jacob','Aaron','Tod','Syd','Guy','Tim','Drew']);
 await p.evaluate(async()=>{
   await Game.setKittyAmount(120); await Game.setPrizePlan(150, 3);
   for (const n of Game.entrants()) { await Game.addRebuy(n); await Game.settle(n,'Nate'); }
   await Game.drawSeats(1); await Game.setStatus('running');
   const a=Game.active(); for(let i=0;i<a.length-1;i++) await Game.confirmOut(a[a.length-1-i], null, a[0]);
 });
 await p.waitForTimeout(500);
 const rec9 = await p.evaluate(()=>Game.finalize());
 const handed = rec9.finish.reduce((a,x)=>a+(x.winnings||0),0);
 say('money', {gross:rec9.gross, kitty:rec9.kitty, bounty:rec9.bounty, pot:rec9.pot, handed});
 ok('gross is 8 buy-ins plus 8 top-ups', rec9.gross===480, rec9.gross);
 ok('kitty exactly as asked', rec9.kitty===120);
 ok('first got exactly what was asked', rec9.finish[0].winnings===150, rec9.finish[0].winnings);
 ok('and every dollar is accounted for', handed===rec9.pot+(rec9.bounty||0), [handed, rec9.pot]);
 ok('collected matches charged', await p.evaluate(()=>{const c=Game.collected();return c.paid===c.charged;}));

 console.log('\n== 10. A PLAN SET EARLY, BEFORE THE REBUYS MAKE IT WORK ==');
 await reset(['Nate','Jacob','Aaron','Tod','Syd','Guy','Tim','Drew']);
 const early = await p.evaluate(async()=>{
   await Game.setKittyAmount(120);
   /* $240 in, $120 kitty -- a $150 first place cannot be paid YET. */
   const stored = await Game.setPrizePlan(150, 3).then(()=>'stored').catch(e=>e.message);
   const before = Game.payouts(Game.pot().net, Game.fieldSize());
   for (const n of Game.entrants()) await Game.addRebuy(n);
   const after = Game.payouts(Game.pot().net, Game.fieldSize());
   return {stored, before: before.error||before.table, after: after.error||after.table};
 });
 say('at 8:30', early.before);
 say('after the rebuys', early.after);
 ok('the plan is accepted even though it does not work yet', early.stored==='stored', early.stored);
 ok('and it starts working when the pot grows', Array.isArray(early.after) && early.after[0]===150, early.after);

 console.log('\n== 11. TWO PHONES CLAIM THE HIGH HAND AT ONCE ==');
 await reset(['Nate','Jacob','Aaron','Tod']);
 const race = await p.evaluate(async()=>{
   const a = Game.claimHighHand('Jacob','flush','');
   const b = Game.claimHighHand('Tod','boat','');
   const r = await Promise.allSettled([a,b]);
   return { outcomes: r.map(x=>x.status), winner: Game.highHand() };
 });
 say('race', race);
 ok('exactly one hand ends up standing', !!race.winner && !!race.winner.cat, race.winner);
 ok('and it is a real hand', ['flush','boat'].indexOf(race.winner.cat)!==-1, race.winner.cat);

 console.log('\n== 12. A WALK-IN WINS, AND THE NEWS STILL WORKS ==');
 await reset(['Nate','Jacob','Aaron']);
 const news = await p.evaluate(async()=>{
   await Game.checkIn('Walk-In Dave', {walkIn:true});
   await Game.drawSeats(1); await Game.setStatus('running');
   for (const n of ['Aaron','Jacob','Nate']) await Game.confirmOut(n, null, 'Walk-In Dave');
   const rec = await Game.finalize();
   await new Promise(r=>setTimeout(r,400));
   return new Promise(done=>DB.on('results', v=>done({
     rec: rec.winner, line: BPL.newsLine(v||{}), mine: BPL.newsLine(v||{}, 'Walk-In Dave'),
     board: BPL.knockoutBoard(v||{})
   })));
 });
 say('winner', news.rec);
 say('news', news.line && news.line.text);
 ok('a walk-in can win and carry the bounty', news.line && news.line.text.indexOf('Walk-In Dave')!==-1, news.line);
 ok('and it speaks to them directly', news.mine.text.indexOf('your head')!==-1, news.mine.text);
 ok('their knockouts count', news.board[0] && news.board[0].name==='Walk-In Dave', news.board[0]);

 console.log('\n== 13. A LATE OVERRIDE TOP-UP AFTER THE PAYOUTS ARE SET ==');
 /* Nate names the money at the break. Then somebody hands him $30 at the
    bell and he pushes it through. The pot grows AFTER the numbers are set.
    Found by rehearsal: this used to make the night unfinalizable. */
 await reset(['Nate','Jacob','Aaron','Tod','Syd','Guy','Tim','Drew','Steele','Philo','Erik V','Zak']);
 const lateMoney = await p.evaluate(async()=>{
   await Game.setKittyAmount(60);
   for (const n of Game.entrants().slice(0,3)) await Game.addRebuy(n);
   await Game.drawSeats(2); await Game.setStatus('running'); await Game.timerStart();
   const breakIdx = LEAGUE.blinds.findIndex(x=>x.lastRebuy);
   await Game.timerGoto(breakIdx + 1);                       // rebuys now shut
   const atBreak = Game.pot();
   await Game.setPrizePlan(160, 3);
   const before = Game.payouts(Game.pot().net, Game.fieldSize());
   await Game.addRebuy(Game.entrants()[5], true);            // the override
   const after = Game.payouts(Game.pot().net, Game.fieldSize());
   return { atBreak: atBreak.net, before: before.table, afterNet: Game.pot().net,
            after: after.table || after.error, lifted: after.lifted, asked: after.asked };
 });
 say('at the break', {pot: lateMoney.atBreak, table: lateMoney.before});
 say('after the override', {pot: lateMoney.afterNet, table: lateMoney.after});
 ok('the table still pays', Array.isArray(lateMoney.after), lateMoney.after);
 ok('and still sums to the bigger pot',
    Array.isArray(lateMoney.after) && lateMoney.after.reduce((a,b)=>a+b,0)===lateMoney.afterNet,
    [lateMoney.after, lateMoney.afterNet]);
 ok('1st never goes DOWN from what he said',
    Array.isArray(lateMoney.after) && lateMoney.after[0] >= 160, lateMoney.after);
 ok('and it says his number was lifted', !!lateMoney.lifted && lateMoney.asked===160, lateMoney);
 const finishes = await p.evaluate(async()=>{
   const a=Game.active(); for(let i=0;i<a.length-1;i++) await Game.confirmOut(a[a.length-1-i], null, a[0]);
   const rec = await Game.finalize();
   return { pot: rec.pot, handed: rec.finish.reduce((s,r)=>s+(r.winnings||0),0), first: rec.finish[0].winnings };
 });
 say('finalized', finishes);
 ok('the night finalizes', !!finishes.pot);
 ok('every dollar handed out', finishes.handed===finishes.pot, finishes);
 ok('and the winner got at least what was promised', finishes.first>=160, finishes.first);

 console.log('\n== 14. NOTHING THREW ==');
 ok('no page errors', errs.length===0, errs.slice(0,4));

 console.log('\n'+(fails.length?'FAILED: '+fails.join(', '):'ALL PASSED — nothing found'));
 await b.close(); srv.close(); process.exit(fails.length?1:0);
})();
