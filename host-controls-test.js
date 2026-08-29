const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
(async()=>{await new Promise(r=>srv.listen(8951,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 // /* The Table now bounces anyone not signed in to the sign-in screen, so seed an identity before the first load. */
 await p.goto('http://localhost:8951/index.html',{waitUntil:'domcontentloaded'});
 await p.evaluate(()=>{try{localStorage.setItem('bpl_me','Nate')}catch(e){}});
 await p.goto('http://localhost:8951/game.html',{waitUntil:'networkidle'});
 await p.evaluate(async()=>{ sessionStorage.setItem('bpl_admin_ok','1'); localStorage.setItem('bpl_me','Jacob');
   await Game.resetNight(); await Game.start();
   for(const n of ['Nate','Jacob','Aaron','Tod','Syd','Guy','Tim','Drew','Steele','Philo','Erik V','Zak']) await Game.checkIn(n,{});
   await Game.addRebuy('Tod'); await Game.addRebuy('Syd'); await Game.addRebuy('Zak');
 });
 await p.waitForTimeout(900);
 await p.evaluate(()=>window.dispatchEvent(new Event('bpl:adminchange')));
 await p.waitForTimeout(500);
 await p.click('#btnMaster'); await p.waitForTimeout(600);

 console.log('\n== WHO REBOUGHT AND WHO DIDN\'T ==');
 const rows = await p.evaluate(()=>[...document.querySelectorAll('#rebuyList .trk-row')]
   .map(r=>({name:r.querySelector('.nm').textContent.trim(), count:r.querySelector('.pl').textContent.trim()})));
 say('rebuy tracker', rows.map(r=>r.name+' '+r.count).join('  |  '));
 ok('every_player_listed', rows.length===12, rows.length);
 const bought = rows.filter(r=>r.count.startsWith('1')).map(r=>r.name).sort();
 ok('shows_who_rebought', JSON.stringify(bought)===JSON.stringify(['Syd','Tod','Zak']), bought);
 ok('shows_cap', rows[0].count.includes('/1'), rows[0].count);
 say('pot now', await p.evaluate(()=>{const m=Game.pot();return '$'+m.gross+' gross, '+m.rebuys+' rebuys, $'+m.net+' playing for';}));

 console.log('\n== PAYOUTS TO HOWEVER MANY PLACES NATE WANTS ==');
 for (const splits of ['50,30,20', '40,25,15,10,6,4', '30,20,14,10,8,7,6,5', '100']) {
   await p.fill('#cfgSplits', splits);
   await p.click('#btnSplits'); await p.waitForTimeout(700);
   const live = await p.evaluate(()=>({
     stored: (Game.state().money||{}).splits,
     paid: [...document.querySelectorAll('#payoutList .payout-row')].map(r=>
       r.querySelector('.pl').textContent+' '+r.querySelector('.amt').textContent),
     sum: (function(){const m=Game.pot();
       return BPL.payoutTable(m.net,m.entries,Game.splits(m.entries)).reduce((a,b)=>a+b,0);})(),
     net: Game.pot().net
   }));
   ok(splits.split(',').length+'_places_accepted', JSON.stringify(live.stored)===JSON.stringify(splits.split(',').map(Number)), live.stored);
   ok('  pays out exactly the pot', live.sum===live.net, {paid:live.sum, pot:live.net});
   say('  ', live.paid.join('   '));
 }

 console.log('\n== IT REFUSES NONSENSE ==');
 for (const bad of ['50,30,10', '60,60', '0']) {
   await p.fill('#cfgSplits', bad);
   await p.click('#btnSplits'); await p.waitForTimeout(500);
   const t = await p.evaluate(()=>{const e=document.querySelector('.toast');return e?e.textContent:''});
   const good = bad==='0' ? /Cleared/i.test(t) : /must total 100/i.test(t);
   ok((bad==='0'?'clearing_says_so_':'refused_')+bad, good, t);
 }
 await p.fill('#cfgSplits','50,30,20'); await p.click('#btnSplits'); await p.waitForTimeout(500);

 console.log('\n== KITTY ==');
 await p.fill('#cfgKitty','10'); await p.click('#btnKitty'); await p.waitForTimeout(700);
 const k = await p.evaluate(()=>({pct:Game.kittyPct(), note:document.getElementById('kittyNote').textContent, pot:Game.pot()}));
 say('kitty', k.note);
 ok('kitty_comes_off_the_top', k.pot.kitty>0 && k.pot.net===k.pot.gross-k.pot.kitty, {gross:k.pot.gross,kitty:k.pot.kitty,net:k.pot.net});
 await p.fill('#cfgKitty','0'); await p.click('#btnKitty'); await p.waitForTimeout(500);

 ok('no_page_errors', errs.length===0, errs);
 await b.close();srv.close();
 console.log(fails.length? '\n'+fails.length+' FAILED: '+fails.join(', ') : '\nALL PASSED');
})();
