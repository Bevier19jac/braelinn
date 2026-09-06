/* Who knocked out whom: asked once at the bust, credited to the bounty in
   the same answer, carried onto the permanent record, and turned into
   head-to-head numbers on the players page. Plus the recap on Results. */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
(async()=>{await new Promise(r=>srv.listen(8985,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8985/';
 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{try{localStorage.setItem('bpl_me','Nate')}catch(e){}});
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 const FIELD=['Nate','Jacob','Aaron','Tod','Syd','Guy'];
 await p.evaluate(async(F)=>{
   try{localStorage.clear();sessionStorage.clear();localStorage.setItem('bpl_me','Nate')}catch(e){}
   sessionStorage.setItem('bpl_admin_ok','1');
   await DB.set('results', null); await DB.set('config/money', null);
   /* A prior game so somebody is carrying a bounty. */
   await DB.set('results/2026-08-01', {gameId:'2026-08-01',date:'2026-08-01',season:7,label:'Prior',
     type:'regular',field:6,buyinAmount:30,rebuyAmount:30,rebuys:0,gross:180,kittyPct:0,kitty:0,pot:180,
     bounty:0,bountyOn:null,bountyStreak:0,bountyWonBy:null,winner:'Tod',finalizedAt:1,
     finish:[{place:1,name:'Tod',points:1800,rebuys:0,late:false,winnings:180,bounty:0,itm:true},
             {place:2,name:'Syd',points:1500,rebuys:0,late:false,winnings:0,bounty:0,itm:false,outBy:'Tod'}]});
   await Game.resetNight(); await Game.start();
   for (const n of F) await Game.checkIn(n,{});
   await Game.drawSeats(1); await Game.setStatus('running'); await Game.timerStart();
 }, FIELD);
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
 await p.click('#btnMaster'); await p.waitForTimeout(400);

 console.log('\n== THE HOST IS NOT ASKED. ONE TAP, DONE. ==');
 const players = p.locator('.tabs button[data-tab="players"]');
 if (await players.count()) { await players.click(); await p.waitForTimeout(400); }
 await p.locator('button[data-out="Guy"]').click(); await p.waitForTimeout(900);
 ok('no_sheet_in_his_way', await p.locator('.sheet').count()===0);
 ok('he_is_out', await p.evaluate(()=>Game.active().indexOf('Guy')===-1));
 ok('and_no_killer_invented', await p.evaluate(()=>Game.outBy('Guy'))===null);

 console.log('\n== THE PLAYER SAYS WHO GOT THEM, FROM THEIR OWN SEAT ==');
 await p.evaluate(()=>{ localStorage.setItem('bpl_me','Aaron'); Admin.lock(); sessionStorage.removeItem('bpl_admin_ok'); });
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
 await p.locator('.bseat.mine').click(); await p.waitForTimeout(500);
 await p.locator('#ssBust [data-imout]').click(); await p.waitForTimeout(300);
 await p.locator('.sheet [data-yes]').click(); await p.waitForTimeout(600);
 ok('only_one_sheet_at_a_time', await p.locator('.sheet').count()===1, await p.locator('.sheet').count());
 ok('they_are_asked_who_got_them', (await p.locator('.sheet h3').last().innerText()).includes('Who got you'));
 ok('rather_not_say_is_offered', (await p.locator('.sheet [data-skip]').last().innerText()).includes('Rather not say'));
 await p.locator('.sheet .pickrow', {hasText:'Jacob'}).last().click(); await p.waitForTimeout(1000);
 ok('the_report_carries_it', await p.evaluate(()=>Game.reportedBy('Aaron'))==='Jacob');
 ok('but_they_are_not_out_yet', await p.evaluate(()=>Game.active().indexOf('Aaron')!==-1));

 console.log('\n== AND THE HOST JUST CONFIRMS IT ==');
 await p.evaluate(()=>{ localStorage.setItem('bpl_me','Nate'); sessionStorage.setItem('bpl_admin_ok','1'); });
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
 /* The action queue lives on the page itself, not in the drawer -- so leave
    the drawer shut, the way Nate would when he's watching the room. */
 await p.locator('#queue button[data-act="confirmOut"]').first().click(); await p.waitForTimeout(1000);
 ok('confirmed_without_a_question', await p.locator('.sheet').count()===0);
 ok('aaron_is_out', await p.evaluate(()=>Game.active().indexOf('Aaron')===-1));
 ok('with_the_players_answer', await p.evaluate(()=>Game.outBy('Aaron'))==='Jacob');

 console.log('\n== THE BOUNTY IS CREDITED BY THE SAME ANSWER ==');
 const t = await p.evaluate(()=>Game.bountyTarget());
 say('bounty', t);
 ok('tod_carries_it', t && t.name==='Tod' && t.amount===20, t);
 /* Back into Master Control to reach the player list. */
 await p.click('#btnMaster'); await p.waitForTimeout(400);
 const pl2 = p.locator('.tabs button[data-tab="players"]');
 if (await pl2.count()) { await pl2.click(); await p.waitForTimeout(400); }
 await p.locator('button[data-out="Tod"]').click(); await p.waitForTimeout(700);
 ok('the_host_IS_asked_when_money_is_on_it', await p.locator('.sheet').count()===1);
 ok('the_sheet_says_so', (await p.locator('.sheet').innerText()).includes('bounty goes to'));
 await p.locator('.sheet .pickrow', {hasText:'Syd'}).first().click(); await p.waitForTimeout(1000);
 ok('one_question_not_two', await p.evaluate(()=>Game.bountyClaimed()));
 ok('syd_gets_it', await p.evaluate(()=>Game.state().bounty.wonBy)==='Syd');
 ok('and_the_knockout_too', await p.evaluate(()=>Game.outBy('Tod'))==='Syd');

 console.log('\n== REINSTATING CLEARS IT ==');
 await p.evaluate(()=>Game.reinstate('Aaron')); await p.waitForTimeout(500);
 ok('back_in_means_no_killer', await p.evaluate(()=>Game.outBy('Aaron'))===null);
 await p.evaluate(()=>Game.confirmOut('Aaron', null, 'Nate')); await p.waitForTimeout(500);
 ok('re-busting_records_the_new_answer', await p.evaluate(()=>Game.outBy('Aaron'))==='Nate');

 console.log('\n== IT LANDS ON THE PERMANENT RECORD ==');
 const rec = await p.evaluate(async()=>{
   const a = Game.active(); for (let i=0;i<a.length-1;i++) await Game.confirmOut(a[a.length-1-i], null, a[0]);
   return Game.finalize();
 });
 say('finish', rec.finish.map(r=>r.place+':'+r.name+(r.outBy?' <- '+r.outBy:'')));
 const killers = [...new Set(rec.finish.filter(r=>r.outBy).map(r=>r.outBy))];
 say('killers', killers);
 ok('killers_on_the_record', killers.includes('Syd') && killers.length >= 2, killers);
 ok('a_bust_with_nobody_named_is_still_a_bust',
    rec.finish.some(r=>r.place>1 && !r.outBy) && rec.finish.length===6);
 ok('winner_has_none', !rec.finish.find(r=>r.place===1).outBy);

 console.log('\n== WHICH BECOMES A HEAD-TO-HEAD RECORD ==');
 await p.waitForTimeout(600);
 const ko = await p.evaluate(()=>new Promise(done=>{
   DB.on('results', v=>done({ all: BPL.knockouts(v||{}), nemSyd: BPL.nemesisOf(v||{}, 'Syd'),
                              h2h: BPL.headToHead(v||{}, 'Tod', 'Syd') }));
 }));
 say('Tod vs Syd', ko.h2h);
 ok('tod_busted_syd_last_time', ko.h2h.aGotB===1, ko.h2h);
 ok('syd_got_him_back', ko.h2h.bGotA===1, ko.h2h);
 ok('no_nemesis_off_one_each', ko.nemSyd===null, ko.nemSyd);

 console.log('\n== THE PLAYERS PAGE SHOWS IT ==');
 await p.goto(B+'players.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
 const cards = await p.locator('.rc-ko').count();
 ok('knockout_lines_render', cards>0, cards);
 say('sample', (await p.locator('.rc-ko').first().innerText()).replace(/\n+/g,' | '));

 console.log('\n== AND THE RECAP IS ON RESULTS ==');
 await p.goto(B+'results.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
 const txt = await p.locator('#gamesList').innerText();
 ok('out_to_shown', txt.includes('out to'), txt.split('\n').slice(0,4));
 const withRecap = await p.evaluate(()=>Object.keys(LEAGUE.recaps||{})[0]);
 say('recap on file for', withRecap);
 ok('a_recap_exists', !!withRecap);
 /* Render it by pointing a game at that date. */
 await p.evaluate(async(d)=>{
   await DB.set('results/'+d, {gameId:d,date:d,season:7,label:'Event 1',type:'regular',field:12,
     buyinAmount:30,rebuyAmount:30,rebuys:11,gross:690,kittyPct:20.3,kitty:140,pot:550,
     bounty:0,bountyOn:null,bountyStreak:0,bountyWonBy:null,winner:'Tod',finalizedAt:2,
     finish:[{place:1,name:'Tod',points:3700,rebuys:1,late:false,winnings:245,bounty:0,itm:true},
             {place:2,name:'Tim',points:3400,rebuys:1,late:false,winnings:165,bounty:0,itm:true}]});
 }, withRecap);
 await p.waitForTimeout(1000);
 ok('recap_renders', await p.locator('.recap').count()>0);
 say('opens with', (await p.locator('.recap p').first().innerText()).slice(0, 90) + '…');
 ok('it_has_paragraphs', await p.locator('.recap p').count()>=4, await p.locator('.recap p').count());

 ok('no_page_errors', errs.length===0, errs.slice(0,3));
 console.log('\n'+(fails.length?'FAILED: '+fails.join(', '):'ALL PASSED'));
 await b.close(); srv.close(); process.exit(fails.length?1:0);
})();
