/* The door: a player checks themselves in at Nate's and says when they've
   paid. And the money the way Nate says it: "$120 kitty, $200 to first,
   pay four" -- everything below 1st derived. */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
(async()=>{await new Promise(r=>srv.listen(8983,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8983/';
 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{try{localStorage.setItem('bpl_me','Nate')}catch(e){}});
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 await p.evaluate(async()=>{
   try{localStorage.clear();sessionStorage.clear()}catch(e){}
   await DB.set('results', null); await DB.set('config/money', null);
   await Game.resetNight(); await Game.start();
   localStorage.setItem('bpl_me','Syd');
 });
 await p.waitForTimeout(500);
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);

 console.log('\n== A PLAYER ARRIVES AND CHECKS THEMSELVES IN ==');
 ok('door_offered', await p.locator('#btnImHere').isVisible());
 ok('not_in_the_field_yet', await p.evaluate(()=>Game.entrants().length)===0);
 await p.click('#btnImHere'); await p.waitForTimeout(300);
 await p.locator('.sheet [data-yes]').click(); await p.waitForTimeout(900);
 ok('in_the_field', await p.evaluate(()=>Game.entrants().indexOf('Syd')!==-1));
 ok('recorded_as_their_own_tap', await p.evaluate(()=>Game.selfEntered('Syd')));
 ok('counts_toward_the_pot', await p.evaluate(()=>Game.pot().gross)===30);
 say('door now', (await p.locator('#doorBox').innerText()).replace(/\n+/g,' | '));

 console.log('\n== AND SAYS WHEN THEY HAVE PAID ==');
 ok('owes_the_buyin', await p.evaluate(()=>Game.owes('Syd'))===30);
 ok('paid_button_offered', (await p.locator('#btnIPaid').innerText()).includes('$30'));
 await p.click('#btnIPaid'); await p.waitForTimeout(300);
 await p.locator('.sheet [data-yes]').click(); await p.waitForTimeout(900);
 ok('now_settled', await p.evaluate(()=>Game.owes('Syd'))===0);
 ok('and_it_says_so', (await p.locator('#doorBox').innerText()).includes('Paid'));

 console.log('\n== A TOP-UP PUTS THEM BACK IN DEBT ==');
 await p.evaluate(()=>Game.claimRebuy('Syd')); await p.waitForTimeout(600);
 ok('owes_the_topup', await p.evaluate(()=>Game.owes('Syd'))===30, await p.evaluate(()=>Game.owes('Syd')));
 ok('charged_is_sixty', await p.evaluate(()=>Game.charged('Syd'))===60);
 await p.evaluate(()=>Game.settle('Syd','Syd')); await p.waitForTimeout(500);
 ok('settles_again', await p.evaluate(()=>Game.owes('Syd'))===0);
 ok('paying_twice_cannot_double_count', await p.evaluate(async()=>{
   await Game.settle('Syd','Syd'); await Game.settle('Syd','Syd');
   return Game.paid('Syd');
 })===60);

 console.log('\n== NATE SEES WHO STILL OWES ==');
 await p.evaluate(async()=>{
   sessionStorage.setItem('bpl_admin_ok','1');
   for (const n of ['Nate','Jacob','Aaron','Tod','Guy','Tim','Drew','Steele','Philo']) await Game.checkIn(n,{});
   await Game.setPaid('Nate', 30, 'Nate');
 });
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
 await p.click('#btnMaster'); await p.waitForTimeout(400);
 const money = p.locator('.tabs button[data-tab="money"]');
 if (await money.count()) { await money.click(); await p.waitForTimeout(500); }
 ok('board_shown', await p.locator('#owedCard').isVisible());
 say('board', (await p.locator('#owedCard').innerText()).replace(/\n+/g,' | ').slice(0,200));
 ok('counts_collected', (await p.locator('#owedCard').innerText()).includes('$90 collected'),
    (await p.locator('#owedCard').innerText()).split('\n')[0]);
 const owedRows = await p.locator('.owed-row').count();
 ok('lists_only_the_debtors', owedRows===8, owedRows);
 await p.locator('.owed-row button').first().click(); await p.waitForTimeout(800);
 ok('one_tap_settles', await p.locator('.owed-row').count()===7, await p.locator('.owed-row').count());

 console.log('\n== "KITTY IS $120, FIRST GETS $200, PAY FOUR" ==');
 await p.evaluate(async()=>{
   for (const n of ['Michael H','Chris P','Chris F','Erik V','Zak','Joe C','Eric C','Phil T','Syd']) await Game.checkIn(n,{});
 });
 await p.waitForTimeout(600);
 const gross = await p.evaluate(()=>Game.pot().gross);
 say('gross', gross);
 await p.fill('#cfgKittyAmt','120');
 await p.fill('#cfgFirst','200');
 await p.fill('#cfgPlaces','4');
 await p.click('#btnPlan'); await p.waitForTimeout(1200);
 const m = await p.evaluate(()=>Game.pot());
 say('pot', {gross:m.gross, kitty:m.kitty, fixed:m.kittyFixed, net:m.net});
 ok('kitty_is_exactly_120', m.kitty===120, m.kitty);
 const table = await p.evaluate(()=>Game.payouts(Game.pot().net, Game.fieldSize()).table);
 say('payouts', table);
 ok('four_places', table.length===4, table.length);
 ok('first_gets_200', table[0]===200, table[0]);
 ok('all_tens', table.every(a=>a%10===0));
 ok('descending', table.every((a,i)=>i===0||a<table[i-1]));
 ok('sums_to_the_pot', table.reduce((a,x)=>a+x,0)===m.net, [table.reduce((a,x)=>a+x,0), m.net]);
 say('what the panel says', (await p.locator('#planNote').innerText()));
 say('payout list', (await p.locator('#payoutList').innerText()).replace(/\n+/g,' | '));

 console.log('\n== A FIRST PRIZE TOO SMALL IS LIFTED, AND SAID OUT LOUD ==');
 /* His number is a floor, not a ceiling: the table is repaired rather than
    refused, so a night can never be blocked by it -- but the panel says
    plainly that his number moved. */
 await p.evaluate(()=>Game.setPrizePlan(20, 6)); await p.waitForTimeout(700);
 const lifted = await p.evaluate(()=>Game.payouts(Game.pot().net, Game.fieldSize()));
 say('asked for $20 to 1st', lifted.table || lifted.error);
 ok('it_still_pays', Array.isArray(lifted.table), lifted);
 ok('1st_was_lifted', lifted.lifted > 0 && lifted.asked === 20, lifted);
 const note = await p.locator('#planNote').innerText();
 say('the panel says', note);
 ok('and_the_panel_says_his_number_moved', note.indexOf('lifted from') !== -1 && note.indexOf('keep 2nd behind') !== -1, note);
 ok('the_queue_is_quiet_because_it_pays', !(await p.locator('#queue').innerText()).includes("don't add up"));

 console.log('\n== A POT THAT GENUINELY CANNOT PAY IS STILL REFUSED ==');
 await p.evaluate(()=>Game.setKittyAmount(540)); await p.waitForTimeout(500);
 const impossible = await p.evaluate(()=>({pot:Game.pot().net, plan:Game.payouts(Game.pot().net, Game.fieldSize())}));
 say('tiny pot, six places', impossible);
 ok('refused_when_it_truly_cannot', !!impossible.plan.error, impossible.plan);
 ok('and_the_queue_chases_that', (await p.locator('#queue').innerText()).includes("don't add up"));
 const blocked = await p.evaluate(()=>Game.finalize().then(()=>'allowed').catch(e=>e.message));
 ok('and_finalize_refuses', blocked!=='allowed', blocked);
 await p.evaluate(()=>Game.setKittyAmount(120)); await p.waitForTimeout(500);
 const huge = await p.evaluate(()=>Game.setPrizePlan(99999, 4).then(()=>'allowed').catch(e=>e.message));
 ok('an_absurd_first_prize_is_refused_outright', huge!=='allowed', huge);

 console.log('\n== PUT IT BACK AND THE NIGHT PROCEEDS ==');
 await p.fill('#cfgFirst','200'); await p.fill('#cfgPlaces','4');
 await p.click('#btnPlan'); await p.waitForTimeout(1000);
 const still = await p.evaluate(()=>Game.payouts(Game.pot().net, Game.fieldSize()).table);
 ok('the_good_plan_is_back', still && still[0]===200 && still.length===4, still);

 console.log('\n== AND THE NIGHT FINALIZES ON THOSE NUMBERS ==');
 const rec = await p.evaluate(async()=>{
   if (!Game.state().seats) { await Game.drawSeats(2); await Game.setStatus('running'); await Game.timerStart(); }
   const a = Game.active(); for (let i=0;i<a.length-1;i++) await Game.confirmOut(a[a.length-1-i]);
   return Game.finalize();
 });
 say('record', {gross:rec.gross, kitty:rec.kitty, pot:rec.pot});
 const paidRows = rec.finish.filter(r=>r.winnings>0);
 say('paid', paidRows.map(r=>r.place+':'+r.name+'='+r.winnings));
 ok('four_paid', paidRows.length===4, paidRows.length);
 ok('winner_took_200', paidRows[0].winnings===200, paidRows[0].winnings);
 ok('kitty_recorded', rec.kitty===120, rec.kitty);
 ok('money_balances', paidRows.reduce((a,r)=>a+r.winnings,0)===rec.pot, [paidRows.reduce((a,r)=>a+r.winnings,0), rec.pot]);

 ok('no_page_errors', errs.length===0, errs.slice(0,3));
 console.log('\n'+(fails.length?'FAILED: '+fails.join(', '):'ALL PASSED'));
 await b.close(); srv.close(); process.exit(fails.length?1:0);
})();
