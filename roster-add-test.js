/* Adding a player must be purely additive. RSVPs are keyed by the short name,
   so this proves the new names exist, work end to end, and that every RSVP
   already on file reads back exactly as it was written. */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
const NEW = ['Larry','Greg','Matt M'];
(async()=>{await new Promise(r=>srv.listen(8975,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8975/';
 await p.goto(B,{waitUntil:'networkidle'});
 await p.evaluate(()=>{try{localStorage.clear();sessionStorage.clear()}catch(e){}});
 await p.goto(B,{waitUntil:'networkidle'}); await p.waitForTimeout(900);

 console.log('\n== THE ROSTER ==');
 const roster = await p.evaluate(()=>LEAGUE.standings.map(x=>({n:x.name,f:x.fullName})));
 say('size', roster.length);
 ok('larry_is_there', roster.some(x=>x.n==='Larry' && x.f==='Larry Stewart'));
 ok('greg_is_there', roster.some(x=>x.n==='Greg' && x.f==='Gregory James Lee'));
 ok('matt_m_is_there', roster.some(x=>x.n==='Matt M' && x.f==='Matt McCoy'));
 ok('and_did_not_collide_with_matt_t', roster.some(x=>x.n==='Matt T' && x.f==='Matt Therriault'));
 ok('short_names_unique', new Set(roster.map(x=>x.n)).size===roster.length);
 ok('no_forbidden_key_chars', roster.every(x=>!/[.#$\[\]/]/.test(x.n)));
 ok('both_on_the_signin_screen', await p.locator('.si-row[data-n="Larry"]').count()===1
    && await p.locator('.si-row[data-n="Greg"]').count()===1);
 ok('signin_lists_everyone', await p.locator('.si-row').count()===roster.length);
 await p.fill('#siFilter','stewart'); await p.waitForTimeout(250);
 ok('findable_by_full_name', await p.locator('.si-row[data-n="Larry"]').count()===1);
 await p.fill('#siFilter','gregory'); await p.waitForTimeout(250);
 ok('greg_findable_by_full_name', await p.locator('.si-row[data-n="Greg"]').count()===1);
 await p.fill('#siFilter','mccoy'); await p.waitForTimeout(250);
 ok('matt_m_findable_by_full_name', await p.locator('.si-row[data-n="Matt M"]').count()===1);
 await p.fill('#siFilter','matt'); await p.waitForTimeout(250);
 ok('both_matts_found', await p.locator('.si-row').count()===2, await p.locator('.si-row').count());
 await p.fill('#siFilter','');

 console.log('\n== EVERY EXISTING RSVP IS UNTOUCHED ==');
 /* Put an answer on file for the whole old roster, then confirm the new
    names change nothing about any of them. */
 const old = roster.map(x=>x.n).filter(n=>NEW.indexOf(n)===-1);
 const want = {};
 old.forEach((n,i)=>{ want[n] = ['in','maybe','out'][i%3]; });
 await p.evaluate(async(w)=>{
   for (const n in w) await DB.set('rsvp/'+LEAGUE.nextGame.date+'/'+n, w[n]);
 }, want);
 await p.waitForTimeout(700);
 const back = await p.evaluate(()=>new Promise(done=>{
   DB.on('rsvp/'+LEAGUE.nextGame.date, v=>done(v||{}));
 }));
 const drifted = Object.keys(want).filter(n=>back[n]!==want[n]);
 ok('nothing_drifted', drifted.length===0, drifted);
 ok('the_new_two_have_no_answer_yet', NEW.every(n=>back[n]===undefined || back[n]===null));
 const counts = {in:0,maybe:0,out:0};
 Object.values(back).forEach(v=>{ if(counts[v]!==undefined) counts[v]++; });
 say('tally on file', counts);
 const shown = { in:await p.locator('#tIn').innerText(), maybe:await p.locator('#tMaybe').innerText(), out:await p.locator('#tOut').innerText() };
 ok('page_tally_matches', Number(shown.in)===counts.in && Number(shown.maybe)===counts.maybe && Number(shown.out)===counts.out, {shown, counts});

 console.log('\n== LARRY SIGNS IN AND RSVPs ==');
 await p.click('.si-row[data-n="Larry"]'); await p.waitForTimeout(700);
 ok('signed_in', await p.evaluate(()=>localStorage.getItem('bpl_me'))==='Larry');
 ok('his_card_is_his', (await p.locator('#myRsvp').innerText()).includes('Larry'));
 await p.click('#myRsvp .mychip.in'); await p.waitForTimeout(700);
 ok('his_answer_sticks', (await p.locator('#myRsvp .mychip.on').innerText())==="I'm in");
 const after = await p.evaluate(()=>new Promise(done=>{
   DB.on('rsvp/'+LEAGUE.nextGame.date, v=>done(v||{}));
 }));
 ok('only_larry_changed', Object.keys(want).every(n=>after[n]===want[n]) && after.Larry==='in',
    Object.keys(want).filter(n=>after[n]!==want[n]));
 await p.click('#stInBtn'); await p.waitForTimeout(400);
 ok('he_shows_in_the_head_count', (await p.locator('.sheet').innerText()).includes('Larry'));
 await p.keyboard.press('Escape'); await p.waitForTimeout(250);

 console.log('\n== AND THEY CAN PLAY A WHOLE NIGHT ==');
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(700);
 const rec = await p.evaluate(async(NEW)=>{
   sessionStorage.setItem('bpl_admin_ok','1');
   await Game.resetNight(); await Game.start();
   const field = NEW.concat(['Nate','Jacob','Aaron','Tod','Syd','Guy']);
   for (const n of field) await Game.checkIn(n,{});
   await Game.drawSeats(1); await Game.setStatus('running'); await Game.timerStart();
   await Game.addRebuy('Greg');
   const a = Game.active();
   for (let i=0;i<a.length-1;i++) await Game.confirmOut(a[a.length-1-i]);
   return Game.finalize();
 }, NEW);
 const rows = Array.isArray(rec.finish) ? rec.finish : Object.values(rec.finish||{});
 say('finish', rows.map(r=>r.place+':'+r.name+'='+r.points));
 ok('both_recorded', NEW.every(n=>rows.some(r=>r.name===n)));
 ok('places_are_1_to_N', JSON.stringify(rows.map(r=>r.place).sort((a,b)=>a-b))===JSON.stringify(rows.map((_,i)=>i+1)));
 const stand = await p.evaluate(()=>new Promise(done=>{
   DB.on('results', v=>{ const s={}; BPL.aggregate(v||{}).players.forEach(r=>s[r.name]=r.points); done(s); });
 }));
 ok('they_appear_in_the_standings', NEW.every(n=>typeof stand[n]==='number'));
 say('their points', NEW.map(n=>n+'='+stand[n]).join(', '));

 ok('no_page_errors', errs.length===0, errs.slice(0,3));
 console.log('\n'+(fails.length?'FAILED: '+fails.join(', '):'ALL PASSED'));
 await b.close(); srv.close(); process.exit(fails.length?1:0);
})();
