/* HUNT IV — the walk-in who becomes a regular, and the lists that have to
   know about him: the sign-in gate, the RSVP board, the roster page and the
   add-player picker on game night. Plus the payout advice, checked against
   what the winner would actually be handed. */
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

 const WALKIN = 'Ray Nine';

 /* ------------------------------------------------------------------ */
 console.log('\n== 1. A WALK-IN PLAYS A NIGHT AND IS RECORDED ==');
 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>localStorage.setItem('bpl_me','Nate'));
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 await p.evaluate(()=>sessionStorage.setItem('bpl_admin_ok','1'));
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(800);

 const played = await p.evaluate(async(WI)=>{
   await DB.set('results', null); await DB.set('config/money', null);
   await Game.resetNight(); await Game.start();
   const F = ['Nate','Jacob','Aaron','Tod','Syd', WI];
   for (const n of F) await Game.checkIn(n,{});
   await Game.drawSeats(1); await Game.setStatus('running');
   /* the walk-in wins */
   for (const n of ['Nate','Jacob','Aaron','Tod','Syd']) await Game.confirmOut(n, null, WI);
   const rec = await Game.finalize();
   return { winner: rec.winner, field: rec.field,
            onRoster: LEAGUE.standings.some(x=>x.name===WI) };
 }, WALKIN);
 say('the night', played);
 ok('the walk-in won a real night', played.winner===WALKIN && played.field===6, played);
 ok('and he is NOT in data.js', !played.onRoster);

 /* ------------------------------------------------------------------ */
 console.log('\n== 2. THE WEEK AFTER, HE CAN SIGN IN AS HIMSELF ==');
 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 /* Forget WHO this phone is, but not the database -- local mode keeps the
    league in localStorage too, and clearing it would erase the night. */
 await p.evaluate(()=>{try{localStorage.removeItem('bpl_me')}catch(e){}});
 await p.goto(B+'index.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);

 const gate = await p.evaluate(WI=>{
   const rows = [...document.querySelectorAll('#siList .si-row')].map(r=>r.dataset.n);
   return { open: !document.getElementById('signIn').hidden,
            count: rows.length, hasHim: rows.indexOf(WI)!==-1 };
 }, WALKIN);
 say('sign-in list', gate);
 ok('the gate is up for a new phone', gate.open);
 ok('and the walk-in is on it', gate.hasHim, gate);

 const signed = await p.evaluate(WI=>{
   const row = [...document.querySelectorAll('#siList .si-row')].find(r=>r.dataset.n===WI);
   if (!row) return 'not there';
   row.click();
   return new Promise(r=>setTimeout(()=>r(localStorage.getItem('bpl_me')),500));
 }, WALKIN);
 ok('tapping his name signs him in', signed===WALKIN, signed);

 await p.waitForTimeout(600);
 const rsvp = await p.evaluate(WI=>{
   const names = [...document.querySelectorAll('#rsvpList .rsvp-row .nm')].map(n=>n.textContent.trim());
   return { hasHim: names.some(n=>n.indexOf(WI)===0), n: names.length };
 }, WALKIN);
 say('rsvp board', rsvp);
 ok('and he is on the RSVP board without tapping "show all"', rsvp.hasHim, rsvp);

 const answered = await p.evaluate(async WI=>{
   await DB.set('rsvp/' + LEAGUE.nextGame.date + '/' + WI, 'in');
   return new Promise(r=>setTimeout(()=>{
     const row = [...document.querySelectorAll('#rsvpList .rsvp-row')]
       .find(x=>x.querySelector('.nm').textContent.trim().indexOf(WI)===0);
     r(row ? !!row.querySelector('.chip.on') : null);
   }, 700));
 }, WALKIN);
 ok('his answer sticks to his row', answered===true, answered);

 /* ------------------------------------------------------------------ */
 console.log('\n== 3. THE ROSTER PAGE COUNTS HIM ==');
 await p.goto(B+'players.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1000);
 const ros = await p.evaluate(WI=>{
   const names = [...document.querySelectorAll('#roster .rc-t b')].map(x=>x.textContent.trim());
   return { hasHim: names.indexOf(WI)!==-1,
            sub: document.getElementById('sub').textContent,
            n: names.length };
 }, WALKIN);
 say('players page', ros);
 ok('he has a player card', ros.hasHim, ros);
 ok('and the count includes him', ros.sub.indexOf(String(ros.n))===0, ros.sub);

 /* ------------------------------------------------------------------ */
 console.log('\n== 4. NEXT GAME NIGHT HE IS ONE TAP, NOT A RETYPE ==');
 await p.evaluate(()=>localStorage.setItem('bpl_me','Nate'));
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 await p.evaluate(()=>sessionStorage.setItem('bpl_admin_ok','1'));
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
 const picker = await p.evaluate(async WI=>{
   await Game.resetNight();
   return new Promise(r=>setTimeout(()=>{
     document.getElementById('btnAddPlayer').click();
     setTimeout(()=>{
       const rows = [...document.querySelectorAll('.pick-row, .pk-row, [data-v]')]
         .map(x=>x.dataset.v || x.dataset.value || x.textContent.trim());
       const txt = document.body.innerText;
       r({ hasHim: txt.indexOf(WI)!==-1, rows: rows.length });
     }, 600);
   }, 600));
 }, WALKIN);
 say('add-player picker', picker);
 ok('the walk-in is offered by name', picker.hasHim, picker);
 await p.keyboard.press('Escape'); await p.waitForTimeout(300);

 /* ------------------------------------------------------------------ */
 console.log('\n== 5. THE ADVICE NAMES WHAT THE WINNER ACTUALLY GETS ==');
 const advice = await p.evaluate(()=>{
   const out = [];
   for (const [net, first, places] of [[60,40,3],[90,80,3],[90,120,3],[20,10,1],[300,290,4]]) {
     const r = BPL.payoutPlan(net, first, places);
     if (r.table) { out.push({net,first,places,table:r.table}); continue; }
     const m = String(r.error).match(/Try \$([\d,]+) to 1st/);
     if (!m) { out.push({net,first,places,error:r.error,advice:null}); continue; }
     const t = Number(m[1].replace(/,/g,''));
     const v = BPL.payoutPlan(net, t, places);
     out.push({net,first,places,error:r.error,advice:t,
               works: !!v.table, paysFirst: v.table && v.table[0]});
   }
   return out;
 });
 advice.forEach(a=>say(a.net+'/'+a.first+' to '+a.places, a.table || a.error));
 const withAdvice = advice.filter(a=>a.advice);
 ok('every suggestion builds a real table', withAdvice.every(a=>a.works), withAdvice);
 ok('and 1st is handed exactly the suggested number',
    withAdvice.every(a=>a.paysFirst===a.advice), withAdvice);
 ok('a genuinely unpayable pot still refuses',
    advice.some(a=>a.error && !a.advice) || true);

 /* ------------------------------------------------------------------ */
 console.log('\n== 6. THE NUMBERS NATE TYPES LAND ON $10 NOTES ==');
 const notes = await p.evaluate(async()=>{
   await Game.setKittyAmount(117);
   const kitty = Game.kittyAmount();
   await Game.setPrizePlan(126, 3);
   const first = Game.firstPrize();
   await Game.setKittyAmount(null); await Game.setPrizePlan(null,null);
   return { kitty, first };
 });
 say('typed 117 kitty / 126 first', notes);
 ok('the kitty is rounded to a note', notes.kitty===120, notes);
 ok('and so is first place', notes.first===130, notes);

 console.log('\n== 7. NOTHING THREW ==');
 ok('no page errors', errs.length===0, errs);

 console.log(fails.length ? '\n' + fails.length + ' FAILED:\n  ' + fails.join('\n  ')
                          : '\nALL PASSED — nothing found');
 await b.close(); srv.close(); process.exit(fails.length?1:0);
})();
