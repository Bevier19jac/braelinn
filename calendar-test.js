/* THE CALENDAR GUARD vs A GAME THAT RUNS PAST MIDNIGHT.

   The guard decides "the season has run out" from the calendar date. On the
   night of 15 Sep the game was still nine-handed when the date rolled over,
   so for a few hours the front page told everyone there was no next game
   while they were sitting at the table. A night stays current until it is
   finalized, whatever the clock says. */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.ico':'image/x-icon'};
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

 const look = () => p.evaluate(() => {
   const none = document.getElementById('noneSec');
   const hero = document.querySelector('header.hero');
   return {
     sayingSeasonOver: !!none && !none.hidden,
     heroShowing: !!hero && !hero.hidden,
     rsvpShowing: !document.getElementById('rsvp').hidden,
     lastDate: BPL.currentGame() && BPL.currentGame().date,
     noneTitle: (document.getElementById('noneTitle')||{}).textContent || ''
   };
 });

 /* ------------------------------------------------------------------ */
 console.log('\n== 1. THE CALENDAR HAS RUN OUT AND NOBODY IS PLAYING ==');
 await p.goto(B+'index.html',{waitUntil:'networkidle'});
 await p.evaluate(()=>{ try{localStorage.clear()}catch(e){} });
 await p.goto(B+'index.html',{waitUntil:'networkidle'});
 await p.evaluate(async()=>{
   await DB.set('live/' + LEAGUE.nextGame.date, null);
   await DB.set('results', null);
 });
 await p.goto(B+'index.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1400);
 const empty = await look();
 say('front page', empty);
 const past = await p.evaluate(()=>{
   const g = BPL.currentGame(); if (!g) return true;
   const [y,m,d] = g.date.split('-').map(Number); const n = new Date();
   return new Date(y,m-1,d) < new Date(n.getFullYear(), n.getMonth(), n.getDate());
 });
 say('last scheduled game is in the past', past);
 if (past) {
   ok('it says the season has no next game', empty.sayingSeasonOver, empty);
   ok('and it does not advertise a date that has gone', !empty.heroShowing, empty);
 } else {
   ok('a future game is scheduled, so the guard stays quiet', !empty.sayingSeasonOver, empty);
   ok('and the hero is showing', empty.heroShowing, empty);
 }

 /* ------------------------------------------------------------------ */
 console.log('\n== 2. THE SAME NIGHT, STILL BEING PLAYED ==');
 await p.evaluate(async()=>{
   const gid = LEAGUE.nextGame.date;
   await DB.set('results', null);
   for (const n of ['Nate','Jacob','Tod','Syd']) {
     await DB.set('live/' + gid + '/players/' + n,
       { status: 'active', buyins: 1, rebuys: 0, paid: 30, joinedAt: Date.now() });
   }
   await DB.set('live/' + gid + '/status', 'running');
 });
 await p.waitForTimeout(1200);
 const playing = await look();
 say('front page mid-game', playing);
 ok('the season is NOT declared over while people are at the table',
    !playing.sayingSeasonOver, playing);
 ok('the hero comes back', playing.heroShowing, playing);
 ok('and so does the RSVP board', playing.rsvpShowing, playing);

 /* ------------------------------------------------------------------ */
 console.log('\n== 3. ONCE IT IS IN THE BOOKS, THE GUARD RETURNS ==');
 await p.evaluate(async()=>{
   const gid = LEAGUE.nextGame.date;
   const F = ['Nate','Jacob','Tod','Syd'];
   await DB.set('results/' + gid, {
     gameId: gid, date: gid, finalizedAt: Date.now(), winner: 'Nate', field: 4,
     finish: F.map((n,i)=>({ place:i+1, name:n, itm:i<2, winnings: i<2?[60,40][i]:0 }))
   });
 });
 await p.waitForTimeout(1200);
 const done = await look();
 say('front page after finalize', done);
 if (past) {
   ok('a finalized night stops holding the page open', done.sayingSeasonOver, done);
 } else {
   ok('still quiet, because a future game is on the calendar', !done.sayingSeasonOver, done);
 }

 /* ------------------------------------------------------------------ */
 console.log('\n== 4. LIVE PLAYERS DO NOT RESURRECT A FINALIZED NIGHT ==');
 await p.evaluate(async()=>{
   const gid = LEAGUE.nextGame.date;
   await DB.set('live/' + gid + '/players/Guy',
     { status: 'active', buyins: 1, rebuys: 0, paid: 30, joinedAt: Date.now() });
 });
 await p.waitForTimeout(1000);
 const zombie = await look();
 say('stale live rows + a finalized result', zombie);
 ok('the written result wins', zombie.sayingSeasonOver === past, zombie);

 console.log('\n== 5. NOTHING THREW ==');
 ok('no page errors', errs.length===0, errs);

 console.log(fails.length ? '\n' + fails.length + ' FAILED:\n  ' + fails.join('\n  ')
                          : '\nALL PASSED');
 await b.close(); srv.close(); process.exit(fails.length?1:0);
})();
