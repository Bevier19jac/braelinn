/* High hand of the season, and the knockout leaderboard. Both derive from
   the finalized records -- nothing is entered twice. */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
(async()=>{await new Promise(r=>srv.listen(8989,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:900},deviceScaleFactor:2});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8989/';
 await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{try{localStorage.setItem('bpl_me','Nate')}catch(e){}});
 await p.goto(B+'game.html',{waitUntil:'networkidle'});
 const FIELD=['Nate','Jacob','Aaron','Tod','Syd','Guy'];
 await p.evaluate(async(F)=>{
   try{localStorage.clear();sessionStorage.clear();localStorage.setItem('bpl_me','Syd')}catch(e){}
   sessionStorage.setItem('bpl_admin_ok','1');
   await DB.set('results', null); await DB.set('config/money', null);
   await Game.resetNight(); await Game.start();
   for (const n of F) await Game.checkIn(n,{});
   await Game.drawSeats(1); await Game.setStatus('running'); await Game.timerStart();
   Admin.lock(); sessionStorage.removeItem('bpl_admin_ok');
 }, FIELD);
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);

 console.log('\n== A PLAYER CLAIMS THE HIGH HAND FROM THEIR SEAT ==');
 await p.locator('.bseat.mine').click(); await p.waitForTimeout(500);
 ok('the_control_is_there', await p.locator('#ssHigh [data-hh]').count()===1);
 say('reads', (await p.locator('#ssHigh').innerText()).replace(/\n+/g,' | '));
 p.once('dialog', d => d.accept('aces full of kings'));
 await p.click('#ssHigh [data-hh]'); await p.waitForTimeout(400);
 await p.locator('.sheet .pickrow', {hasText:'Full house'}).last().click(); await p.waitForTimeout(1000);
 let h = await p.evaluate(()=>Game.highHand());
 say('claimed', h);
 ok('recorded', h && h.name==='Syd' && h.cat==='boat', h);
 ok('with_the_note', h.note==='aces full of kings', h.note);

 console.log('\n== A WORSE HAND CANNOT TAKE IT ==');
 const worse = await p.evaluate(()=>Game.claimHighHand('Tod','flush','').then(()=>'allowed').catch(e=>e.message));
 ok('refused', worse!=='allowed', worse);
 ok('and_says_why', /still beats that/.test(worse), worse);
 h = await p.evaluate(()=>Game.highHand());
 ok('syd_keeps_it', h.name==='Syd');

 console.log('\n== A BETTER ONE DOES ==');
 await p.evaluate(()=>Game.claimHighHand('Tod','quads','quad 8s')); await p.waitForTimeout(600);
 h = await p.evaluate(()=>Game.highHand());
 ok('tod_takes_it', h.name==='Tod' && h.cat==='quads', h);

 console.log('\n== IT LANDS ON THE RECORD, AND THE SEASON BOARD ==');
 const rec = await p.evaluate(async()=>{
   sessionStorage.setItem('bpl_admin_ok','1');
   const a = Game.active();
   for (let i=0;i<a.length-1;i++) await Game.confirmOut(a[a.length-1-i], null, a[0]);
   return Game.finalize();
 });
 say('record highHand', rec.highHand);
 ok('on_the_record', rec.highHand && rec.highHand.cat==='quads' && rec.highHand.name==='Tod');

 /* A second night: a worse hand, and a different set of knockouts. */
 await p.evaluate(async(F)=>{
   await DB.set('results/2026-10-01', {gameId:'2026-10-01',date:'2026-10-01',season:7,label:'Event 2',
     type:'regular',field:6,buyinAmount:30,rebuyAmount:30,rebuys:0,gross:180,kittyPct:0,kitty:0,pot:180,
     bounty:0,bountyOn:null,bountyStreak:0,bountyWonBy:null,winner:'Syd',finalizedAt:9,
     highHand:{name:'Jacob',cat:'flush',at:1},
     finish:[{place:1,name:'Syd',points:1900,rebuys:0,late:false,winnings:180,bounty:0,itm:true},
             {place:2,name:'Nate',points:1500,rebuys:0,late:false,winnings:0,bounty:0,itm:false,outBy:'Syd'},
             {place:3,name:'Jacob',points:1200,rebuys:0,late:false,winnings:0,bounty:0,itm:false,outBy:'Syd'},
             {place:4,name:'Tod',points:900,rebuys:0,late:false,winnings:0,bounty:0,itm:false,outBy:'Nate'},
             {place:5,name:'Aaron',points:600,rebuys:0,late:false,winnings:0,bounty:0,itm:false,outBy:'Syd'},
             {place:6,name:'Guy',points:300,rebuys:0,late:false,winnings:0,bounty:0,itm:false,outBy:'Nate'}]});
 }, FIELD);
 await p.waitForTimeout(700);
 const season = await p.evaluate(()=>new Promise(done=>{
   DB.on('results', v=>done({ hh: BPL.highHand(v||{}), board: BPL.knockoutBoard(v||{}) }));
 }));
 say('high hand of the season', season.hh);
 ok('quads_still_stands', season.hh.cat==='quads' && season.hh.holders[0].name==='Tod', season.hh);
 ok('a_later_flush_does_not_beat_it', season.hh.holders.length===1);
 say('knockout board', season.board.slice(0,4));
 ok('a board exists at all', season.board.length>0, season.board);
 ok('board_is_ranked', season.board.every((r,i)=>i===0||r.kills<=season.board[i-1].kills), season.board);
 /* Night 1 credited every bust to Nate, night 2 gave Syd three -- so Nate
    leads on the combined board. Checked as arithmetic, not as a guess. */
 const expect = {}; 
 season.board.forEach(r => { expect[r.name] = r.kills; });
 ok('totals_add_up_across_nights', expect.Nate === 7 && expect.Syd === 3, expect);
 ok('nobody_with_zero_is_listed', season.board.every(r=>r.kills>0));

 console.log('\n== AND IT RENDERS ON STANDINGS ==');
 await p.goto(B+'standings.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
 ok('section_shown', await p.locator('#extraSec').isVisible());
 const txt = await p.locator('#extraSec').innerText();
 say('reads', txt.replace(/\n+/g,' | ').slice(0,220));
 ok('names_the_hand', txt.includes('Four of a kind'));
 ok('names_the_holder', txt.includes('Tod'));
 ok('has_a_knockout_board', await p.locator('.ko-line').count()>0, await p.locator('.ko-line').count());
 await p.locator('#extraSec').scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
 await p.screenshot({path:'/tmp/season.png'});

 console.log('\n== BEFORE ANYONE RECORDS ONE, IT STAYS OUT OF THE WAY ==');
 await p.evaluate(()=>DB.set('results', null)); await p.waitForTimeout(900);
 ok('hidden_when_empty', await p.locator('#extraSec').isVisible()===false);

 ok('no_page_errors', errs.length===0, errs.slice(0,3));
 console.log('\n'+(fails.length?'FAILED: '+fails.join(', '):'ALL PASSED'));
 await b.close(); srv.close(); process.exit(fails.length?1:0);
})();
