const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const fails=[];
const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
(async()=>{await new Promise(r=>srv.listen(8943,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8943/';

 console.log('\n== HOME PAGE: COUNTDOWN + RSVP TOGGLES ==');
 await p.goto(B+'index.html',{waitUntil:'networkidle'});
 await p.evaluate(()=>{try{localStorage.clear();sessionStorage.clear()}catch(e){}});
 await p.goto(B+'index.html',{waitUntil:'networkidle'}); await p.waitForTimeout(900);
 ok('countdown_visible', await p.locator('#hcUnits .hc-u').count()>0);
 console.log('     countdown reads:', (await p.locator('#hcUnits').innerText()).replace(/\n+/g,' '));
 console.log('     date reads     :', (await p.locator('#hcWhen').innerText()).replace(/\n+/g,' '));
 /* The page opens on the sign-in gate now -- sign in, then RSVP is YOUR
    three buttons rather than the whole roster. */
 ok('signin_gate_first', await p.locator('#signIn').isVisible());
 await p.click('.si-row[data-n="Syd"]'); await p.waitForTimeout(700);
 ok('rsvp_section_present', await p.locator('#myRsvp').count()>0);
 const chips = await p.locator('#myRsvp .mychip').allInnerTexts();
 ok('three_toggles', chips.length===3, chips);
 ok('toggles_are_in_maybe_out', JSON.stringify(chips)===JSON.stringify(["I'm in",'Maybe',"I'm out"]), chips);

 console.log('\n== TOGGLING WORKS AND STICKS ==');
 const who = 'Syd';
 await p.click('#myRsvp .mychip.in'); await p.waitForTimeout(600);
 ok('in_is_on', await p.locator('#myRsvp .mychip.on').innerText()==="I'm in");
 await p.click('#myRsvp .mychip.maybe'); await p.waitForTimeout(600);
 ok('can_switch_to_maybe', await p.locator('#myRsvp .mychip.on').innerText()==='Maybe');
 await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(900);
 ok('survives_reload', await p.locator('#myRsvp .mychip.on').innerText()==='Maybe');
 console.log('     toggled for   :', who);

 console.log('\n== NAV ==');
 const nav = await p.evaluate(()=>[...document.querySelectorAll('.nav-links a')].map(a=>a.textContent.replace(/[^\w ]/g,'').trim()));
 ok('six_tabs', nav.length===6, nav);
 for (const f of ['game.html','standings.html','schedule.html','results.html','players.html']) {
   ok('page_'+f, (await p.request.get(B+f)).status()===200);
 }

 console.log('\n== THE TABLE TAB: pick your table, see it overhead ==');
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(800);
 await p.evaluate(async()=>{
   sessionStorage.setItem('bpl_admin_ok','1'); localStorage.setItem('bpl_me','Jacob');
   await Game.resetNight(); await Game.start();
   for(const n of ['Nate','Jacob','Aaron','Tod','Syd','Guy','Tim','Drew','Steele','Philo','Erik V','Zak']) await Game.checkIn(n,{});
   await Game.drawSeats(2); await Game.setStatus('running'); await Game.timerStart();
   const st={Nate:11800,Jacob:9350,Aaron:4200,Tod:13100,Syd:7600,Guy:5900};
   for(const k in st) await Game.setStack(k,st[k],k);
   Admin.lock();
 });
 await p.waitForTimeout(1300);
 ok('table_picker_present', await p.locator('.felt-tabs button').count()===2);
 console.log('     picker:', await p.locator('.felt-tabs').innerText());
 ok('overhead_view_shown', await p.locator('.bseat').count()>0);
 ok('defaults_to_my_table', await p.locator('.bseat.mine').count()===1);
 const t1 = await p.locator('.bseat .bs-nm').allInnerTexts();
 // click whichever table is NOT the one currently shown
 const curIdx = await p.evaluate(()=>[...document.querySelectorAll('.felt-tabs button')].findIndex(b=>b.classList.contains('on')));
 const other = curIdx === 0 ? 1 : 0;
 await p.locator('.felt-tabs button').nth(other).click(); await p.waitForTimeout(700);
 const t2 = await p.locator('.bseat .bs-nm').allInnerTexts();
 ok('switching_table_changes_players', JSON.stringify(t1)!==JSON.stringify(t2), {table1:t1, table2:t2});
 ok('only_my_seat_editable', await p.evaluate(()=>[...document.querySelectorAll('.bseat')].filter(e=>e.hasAttribute('data-stack')).length)<=1);
 ok('clock_on_same_screen', await p.locator('#clockCard').isVisible());
 ok('no_rsvp_on_game_tab', await p.locator('#rsvpList').count()===0);

 ok('no_page_errors', errs.length===0, errs);
 await p.setViewportSize({width:390,height:844});
 await p.goto(B+'index.html',{waitUntil:'networkidle'}); await p.waitForTimeout(900);
 await p.screenshot({path: __dirname+'/home-restored.png',fullPage:true});
 await b.close();srv.close();
 console.log(fails.length? '\n'+fails.length+' FAILED: '+fails.join(', ') : '\nALL PASSED');
 process.exit(fails.length?1:0);
})();
