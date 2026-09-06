/* HUNT V — the season boards and the written record. Ties on the high hand
   and the knockout board, a season with one game, points that must survive
   a rules change, and the results page reading a night that had everything
   in it at once. */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};

(async()=>{await new Promise(r=>srv.listen(8996,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8996/';

 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>localStorage.setItem('bpl_me','Nate'));
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 await p.evaluate(()=>sessionStorage.setItem('bpl_admin_ok','1'));
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(800);

 /* Play a night start to finish. Returns the permanent record. */
 const night = (opts) => p.evaluate(async o=>{
   await Game.resetNight(); await Game.start();
   for (const n of o.field) await Game.checkIn(n,{});
   await Game.drawSeats(1); await Game.setStatus('running');
   if (o.high) await Game.claimHighHand(o.high[0], o.high[1], o.high[2] || '', true);
   if (o.kitty !== undefined) await Game.setKittyAmount(o.kitty);
   if (o.first) await Game.setPrizePlan(o.first, o.places);
   const order = o.field.slice(1).reverse();        // last in the list busts first
   for (const n of order) await Game.confirmOut(n, null, (o.killers && o.killers[n]) || o.field[0]);
   if (Game.bountyTarget() && !Game.bountyClaimed()) await Game.claimBounty(o.field[0]);
   return await Game.finalize();
 }, opts);


 /* A season is many DATES, and results are keyed by date -- one page can
    only finalize its own night, so history is written directly here. */
 console.log('\n== 1. TWO ROYAL FLUSHES IN A SEASON IS A TIE, NOT A FIGHT ==');
 const F = ['Nate','Jacob','Aaron','Tod','Syd','Guy'];
 const hh = await p.evaluate(([F,])=>{
   const mk = (date, order, high, outBy) => {
     const finish = order.map((n,i)=>{
       const row = { place:i+1, name:n, itm:i<3, winnings: i<3?[60,40,20][i]:0 };
       if (outBy && outBy[n]) row.outBy = outBy[n];
       return row;
     });
     const g = { gameId:date, date:date, finalizedAt:Date.parse(date), winner:order[0],
                 field:order.length, finish:finish };
     if (high) g.highHand = { name:high[0], cat:high[1], note:high[2]||'', at:Date.parse(date) };
     return g;
   };
   const res = {
     '2026-01-06': mk('2026-01-06', F, ['Tod','royal','all hearts']),
     '2026-01-20': mk('2026-01-20', F, ['Syd','royal','all spades']),
   };
   const h = BPL.highHand(res);
   const withLesser = Object.assign({}, res, {
     '2026-02-03': mk('2026-02-03', F, ['Guy','sflush','9 high']) });
   const h2 = BPL.highHand(withLesser);
   const onlyLesser = BPL.highHand({ '2026-02-03': mk('2026-02-03', F, ['Guy','sflush','9 high']) });
   return { tie: h && { cat:h.cat, label:h.label, holders:(h.holders||[]).map(x=>x.name) },
            after: h2 && { cat:h2.cat, holders:(h2.holders||[]).map(x=>x.name) },
            alone: onlyLesser && onlyLesser.cat };
 }, [F]);
 say('season high hand', hh.tie);
 ok('a royal is the season high hand', hh.tie && hh.tie.cat==='royal', hh.tie);
 ok('and both men are named, not one',
    hh.tie && hh.tie.holders.length===2 &&
    hh.tie.holders.indexOf('Tod')!==-1 && hh.tie.holders.indexOf('Syd')!==-1, hh.tie);

 console.log('\n== 2. A BEATEN HAND DOES NOT LINGER ==');
 say('after a straight flush is added', hh.after);
 ok('the royals still hold', hh.after && hh.after.cat==='royal', hh.after);
 ok('and the lesser hand is not among the holders',
    hh.after && hh.after.holders.indexOf('Guy')===-1, hh.after);
 ok('but a straight flush alone does win it', hh.alone==='sflush', hh.alone);

 console.log('\n== 3. THE KNOCKOUT BOARD, WITH A TIE AT THE TOP ==');
 const ko = await p.evaluate(F=>{
   const mk = (date, order, outBy) => ({
     gameId:date, date:date, finalizedAt:Date.parse(date), winner:order[0],
     field:order.length,
     finish: order.map((n,i)=>{
       const row = { place:i+1, name:n, itm:i<3, winnings:i<3?[60,40,20][i]:0 };
       if (outBy && outBy[n]) row.outBy = outBy[n];
       return row;
     })
   });
   const res = {
     '2026-01-06': mk('2026-01-06', F, {Jacob:'Tod',Aaron:'Tod',Syd:'Tod',Guy:'Tod',Nate:'Tod'}),
     '2026-01-20': mk('2026-01-20', F, {Jacob:'Syd',Aaron:'Syd',Tod:'Syd',Guy:'Syd',Nate:'Syd'})
   };
   const board = BPL.knockoutBoard(res);
   /* A nemesis has to be a pattern, not one bad hand: Tod and Syd have
      Jacob once each, so neither is his nemesis yet. */
   const once = BPL.nemesisOf(res, 'Jacob');
   const twice = BPL.nemesisOf(Object.assign({}, res, {
     '2026-02-03': mk('2026-02-03', F, {Jacob:'Tod'}) }), 'Jacob');
   const selfKill = BPL.knockoutBoard({ '2026-03-03': mk('2026-03-03', F, {Tod:'Tod'}) });
   return { board: board.map(r=>({name:r.name,kills:r.kills})),
            total: board.reduce((a,r)=>a+r.kills,0),
            once: once, twice: twice,
            selfKill: selfKill.length };
 }, F);
 say('knockout board', ko);
 ok('every recorded bust has a killer', ko.total===10, ko);
 ok('a tie at the top lists both men',
    ko.board.length===2 && ko.board[0].kills===5 && ko.board[1].kills===5, ko.board);
 ok('and it is sorted by kills then name',
    ko.board[0].name==='Syd' && ko.board[1].name==='Tod', ko.board);
 ok('one bust apiece names no nemesis', ko.once===null, ko.once);
 ok('but a man who has you twice is your nemesis',
    ko.twice && ko.twice.name==='Tod' && ko.twice.times===2, ko.twice);
 ok('and nobody knocks himself out', ko.selfKill===0, ko.selfKill);

 console.log('\n== 4. A HEAD-TO-HEAD THAT NEVER HAPPENED ==');
 const h2h = await p.evaluate(F=>{
   const mk = (date, order, outBy) => ({
     gameId:date, date:date, finalizedAt:Date.parse(date), winner:order[0],
     field:order.length,
     finish: order.map((n,i)=>{
       const row = { place:i+1, name:n, itm:i<3, winnings:i<3?[60,40,20][i]:0 };
       if (outBy && outBy[n]) row.outBy = outBy[n];
       return row;
     })
   });
   const res = { '2026-01-06': mk('2026-01-06', F, {Jacob:'Tod',Aaron:'Tod'}) };
   return { real: BPL.headToHead(res, 'Tod', 'Jacob'),
            never: BPL.headToHead(res, 'Tod', 'Nobody At All'),
            self: BPL.headToHead(res, 'Tod', 'Tod') };
 }, F);
 say('head to head', h2h);
 ok('a real pairing has numbers', !!h2h.real, h2h.real);
 ok('a stranger does not throw', h2h.never !== undefined);
 ok('and a man against himself does not either', h2h.self !== undefined);

 console.log('\n== 5. ONE GAME IN THE BOOKS AND THE STANDINGS STILL ADD UP ==');
 await p.evaluate(()=>DB.set('results', null));
 const rec = await night({ field: F, kitty: 60, first: 60, places: 3 });
 const agg = await p.evaluate(()=>DB.get('results').then(v=>{
   const a = BPL.aggregate(v||{});
   const rows = a.players.filter(x=>x.events>0)
     .map(x=>({name:x.name, pts:x.points, cashes:x.cashes, win:x.wins}));
   return { rows, games: a.gamesPlayed };
 }));
 say('one night', agg);
 ok('exactly one game counted', agg.games===1, agg.games);
 ok('six players scored', agg.rows.length===6, agg.rows);
 const itm = agg.rows.filter(r=>r.cashes>0);
 ok('three men were in the money', itm.length===3, itm);
 ok('and each of them carries the 100 bonus',
    itm.every(r=>r.pts >= 100), itm);

 console.log('\n== 6. THE RESULTS PAGE READS THE NIGHT BACK ==');
 await p.goto(B+'results.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
 const page = await p.evaluate(()=>{
   const t = document.body.innerText;
   return { hasWinner: /Nate/.test(t), hasKitty: /[Kk]itty/.test(t),
            money: (t.match(/\$\d+/g)||[]).slice(0,8), len: t.length };
 });
 say('results page', page);
 ok('the winner is on the page', page.hasWinner, page);
 ok('the kitty is shown', page.hasKitty, page);
 ok('and the page is not blank', page.len > 200, page.len);

 console.log('\n== 7. NEWS WITH NOTHING TO SAY ==');
 const news = await p.evaluate(()=>{
   const empty = BPL.newsLine({}, 'Nate');
   const junk  = BPL.newsLine({ x: { winner: 'Ghost' } }, 'Nate');
   return { empty: empty && empty.text, junk: junk && junk.text };
 });
 say('news', news);
 ok('an empty season says nothing false', !news.empty || !/\$/.test(news.empty), news.empty);
 ok('and a junk record puts nobody on the banner',
    !news.junk || !/Ghost/.test(news.junk), news.junk);

 console.log('\n== 8. NOTHING THREW ==');
 ok('no page errors', errs.length===0, errs);

 console.log(fails.length ? '\n' + fails.length + ' FAILED:\n  ' + fails.join('\n  ')
                          : '\nALL PASSED — nothing found');
 await b.close(); srv.close(); process.exit(fails.length?1:0);
})();
