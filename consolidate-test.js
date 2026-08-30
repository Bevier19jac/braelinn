/* Breaking tables mid-game: 3 -> 2 -> 1, the way a real night collapses.
   Checks that survivors are reseated, busted players are dropped, chips and
   rebuys and the clock are untouched, and nobody is lost or duplicated. */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
(async()=>{await new Promise(r=>srv.listen(8971,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8971/';
 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{try{localStorage.setItem('bpl_me','Nate')}catch(e){}});
 await p.goto(B+'game.html',{waitUntil:'networkidle'});

 const FIELD = 24;
 await p.evaluate(async(n)=>{
   try{localStorage.clear();sessionStorage.clear();localStorage.setItem('bpl_me','Nate')}catch(e){}
   sessionStorage.setItem('bpl_admin_ok','1');
   await Game.resetNight(); await Game.start();
   const roster = LEAGUE.standings.map(x=>x.name).slice(0,n);
   for (const x of roster) await Game.checkIn(x,{});
   await Game.drawSeats(3); await Game.setStatus('running'); await Game.timerStart();
   // give a few people chips and a rebuy, so we can prove they survive
   await Game.setStack(roster[0], 41000, roster[0]);
   await Game.addRebuy(roster[1]);
 }, FIELD);
 await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(1200);

 console.log('\n== 24 PLAYERS, 3 TABLES ==');
 let st = await p.evaluate(()=>({tables:Game.state().seats.tables, order:Game.state().seats.order.length,
   ideal:Game.idealTables(), should:Game.shouldConsolidate()}));
 say('state', st);
 ok('three_tables', st.tables===3);
 ok('not_yet_time', st.should===false, st);

 const bust = async k => p.evaluate(async(k)=>{
   const alive = Game.active();
   for (let i=0;i<k;i++) await Game.confirmOut(alive[alive.length-1-i]);
 }, k);

 console.log('\n== BUST DOWN TO 18: STILL THREE TABLES ==');
 await bust(6); await p.waitForTimeout(500);
 st = await p.evaluate(()=>({alive:Game.active().length, ideal:Game.idealTables(), should:Game.shouldConsolidate()}));
 say('state', st);
 ok('18_fits_on_two', st.ideal===2, st);
 ok('prompted_to_break_one', st.should===true);

 console.log('\n== THE HOST IS TOLD, IN MASTER CONTROL ==');
 await p.click('#btnMaster'); await p.waitForTimeout(500);
 const tab = p.locator('.tabs button[data-tab="host"]');
 if (await tab.count()) { await tab.click(); await p.waitForTimeout(400); }
 ok('panel_shown', await p.locator('#consolidateBox').isVisible());
 say('panel says', (await p.locator('#consolidateBox').innerText()).replace(/\n+/g,' | '));
 ok('recommends_two', (await p.locator('#consolBtns .btn-primary').innerText()).includes('2 tables'));
 ok('current_count_disabled', await p.locator('#consolBtns .btn[disabled]').count()===1);

 console.log('\n== REDRAW 3 -> 2 ==');
 const before = await p.evaluate(()=>({alive:Game.active().slice().sort(), out:Game.busted().slice().sort(),
   stack:Game.state().players[Game.state().seats.order[0]], clock:Game.clock().index}));
 const chips = await p.evaluate(()=>{const P=Game.state().players;const o={};for(const k in P)o[k]=[P[k].stack||0,P[k].rebuys||0];return o;});
 await p.click('#consolBtns .btn-primary'); await p.waitForTimeout(400);
 await p.locator('.sheet [data-yes]').click(); await p.waitForTimeout(1600);
 let s2 = await p.evaluate(()=>({tables:Game.state().seats.tables, order:Game.state().seats.order.slice().sort(),
   alive:Game.active().slice().sort(), clock:Game.clock().index}));
 ok('now_two_tables', s2.tables===2, s2.tables);
 ok('everyone_alive_is_seated', JSON.stringify(s2.order)===JSON.stringify(before.alive), {seated:s2.order.length, alive:before.alive.length});
 ok('no_duplicates', new Set(s2.order).size===s2.order.length);
 ok('no_busted_player_reseated', s2.order.every(n=>before.out.indexOf(n)===-1));
 const chips2 = await p.evaluate(()=>{const P=Game.state().players;const o={};for(const k in P)o[k]=[P[k].stack||0,P[k].rebuys||0];return o;});
 ok('chips_and_rebuys_untouched', JSON.stringify(chips)===JSON.stringify(chips2));
 ok('clock_untouched', s2.clock===before.clock, [before.clock, s2.clock]);
 const split = await p.evaluate(()=>UI.tables(Game.state().seats.order, Game.state().seats.tables).map(t=>t.length));
 say('table sizes', split);
 ok('tables_are_even', Math.max(...split)-Math.min(...split)<=1, split);
 ok('nobody_over_nine', Math.max(...split)<=9, split);

 console.log('\n== BUST DOWN TO 9: TWO -> ONE ==');
 await bust(9); await p.waitForTimeout(600);
 st = await p.evaluate(()=>({alive:Game.active().length, ideal:Game.idealTables(), should:Game.shouldConsolidate()}));
 say('state', st);
 ok('nine_fits_on_one', st.ideal===1, st);
 ok('prompted_again', st.should===true);
 const aliveNow = await p.evaluate(()=>Game.active().slice().sort());
 await p.click('#consolBtns .btn-primary'); await p.waitForTimeout(400);
 await p.locator('.sheet [data-yes]').click(); await p.waitForTimeout(1600);
 s2 = await p.evaluate(()=>({tables:Game.state().seats.tables, order:Game.state().seats.order.slice().sort()}));
 ok('now_one_table', s2.tables===1, s2.tables);
 ok('final_table_is_the_survivors', JSON.stringify(s2.order)===JSON.stringify(aliveNow), {seated:s2.order.length});
 ok('no_more_prompt', await p.evaluate(()=>Game.shouldConsolidate())===false);

 console.log('\n== IT REFUSES THE IMPOSSIBLE ==');
 const bad = await p.evaluate(()=>Game.consolidate(5).then(()=>'allowed').catch(e=>e.message));
 ok('five_tables_for_nine_refused', /Too many tables/.test(bad), bad);
 const offered = await p.evaluate(()=>[...document.querySelectorAll('#consolBtns .btn')].map(b=>b.textContent.trim()));
 say('offered at 1 table', offered);
 ok('never_offers_more_tables_than_running', offered.every(t=>!/[2-9] tables/.test(t)), offered);
 await p.evaluate(async()=>{ const a=Game.active(); for(let i=0;i<a.length-1;i++) await Game.confirmOut(a[i]); });
 await p.waitForTimeout(400);
 const solo = await p.evaluate(()=>Game.consolidate(1).then(()=>'allowed').catch(e=>e.message));
 ok('one_player_left_refused', /Not enough players/.test(solo), solo);
 ok('panel_hides_at_the_end', await p.evaluate(()=>Game.shouldConsolidate())===false);

 console.log('\n== AND THE NIGHT STILL FINALIZES ==');
 const fin = await p.evaluate(()=>Game.finalize().then(r=>({ok:true,winner:r&&r.winner,field:r&&r.field})).catch(e=>({ok:false,err:e.message})));
 say('finalize', fin);
 ok('finalized', fin.ok===true);
 ok('field_is_the_whole_night', fin.field===24, fin.field);

 ok('no_page_errors', errs.length===0, errs.slice(0,3));
 console.log('\n'+(fails.length?'FAILED: '+fails.join(', '):'ALL PASSED'));
 await b.close(); srv.close(); process.exit(fails.length?1:0);
})();
