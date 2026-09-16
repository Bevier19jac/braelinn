const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+JSON.stringify(v));
const fails=[];
const ok=(k,c,d)=>{ console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):'')); if(!c) fails.push(k); };
(async()=>{await new Promise(r=>srv.listen(8941,r));
 const b=await chromium.launch();
 /* The cases come FROM the calendar in data.js. Typing dates in here meant
    every new game night broke this test and taught nobody anything. */
 const dates = require('fs').readFileSync(__dirname+'/data.js','utf8')
   .split('schedule: [')[1].split(/^  \]/m)[0]
   .replace(/\/\*[\s\S]*?\*\//g, '')     // the commented-out examples are not the calendar
   .match(/date:\s*"(\d{4}-\d{2}-\d{2})"/g)
   .map(m=>m.match(/\d{4}-\d{2}-\d{2}/)[0])
   .filter((d,i,a)=>a.indexOf(d)===i).sort();
 const first = dates[0], last = dates[dates.length-1];
 const shift = (iso, days) => {
   const [y,m,d] = iso.split('-').map(Number);
   const dt = new Date(y, m-1, d+days);
   return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
 };
 console.log('  calendar:', dates.join(', '));
 for (const [label, iso, expectRsvp] of [
   ['the day before the first', shift(first,-1)+'T12:00:00', true ],
   ['first game day, morning',  first+'T09:00:00',           true ],
   ['last game day, morning',   last+'T09:00:00',            true ],
   ['the day after the last',   shift(last,1)+'T09:00:00',   false],
   ['two weeks after the last', shift(last,14)+'T09:00:00',  false],
   ['a year after the last',    shift(last,365)+'T09:00:00', false]
 ]) {
   const c=await b.newContext({viewport:{width:390,height:844}});
   await c.route('**/gstatic.com/**',r=>r.abort());
   await c.addInitScript(`{
     const F=Date, T=new F('${iso}').getTime();
     class D extends F { constructor(...a){ super(...(a.length?a:[T])); } static now(){ return T; } }
     Date=D;
   }`);
   const p=await c.newPage();
   await p.goto('http://localhost:8941/index.html',{waitUntil:'networkidle'});
   await p.evaluate(()=>{try{localStorage.setItem('bpl_me','Aaron')}catch(e){}});
   await p.reload({waitUntil:'networkidle'}); await p.waitForTimeout(700);
   const st = await p.evaluate(()=>({
     rsvp: !!document.querySelector('#rsvp') && !document.querySelector('#rsvp').hidden,
     none: !document.getElementById('noneSec').hidden,
     shownDate: (document.getElementById('hcWhen')||{}).textContent||'',
     noneMsg: (document.getElementById('noneBody')||{}).textContent||''
   }));
   console.log('\n-- ' + label + ' --');
   ok('shows_rsvp', st.rsvp===expectRsvp, st.rsvp);
   ok('shows_nothing_scheduled', st.none===!expectRsvp, st.none);
   if (st.rsvp) say('advertises', st.shownDate);
   if (st.none) say('says', st.noneMsg);
   ok('never_advertises_a_past_date', !(st.rsvp && !expectRsvp));
   await c.close();
 }
 /* ---------------------------------------------------------------------
    THE SCHEDULE PAGE ITSELF. "Upcoming" used to split on a `completed:`
    flag in data.js that nobody ever set, so a fortnight after Event 1 was
    played the page still called it "Next Up" and counted it among the games
    "to go". Whether a night happened is already recorded in /results.
    --------------------------------------------------------------------- */
 console.log('\n== THE SCHEDULE PAGE KNOWS WHAT HAS BEEN PLAYED ==');
 {
   const c = await b.newContext({viewport:{width:390,height:844}});
   await c.route('**/gstatic.com/**', r=>r.abort());
   const p = await c.newPage();
   await p.goto('http://localhost:8941/schedule.html',{waitUntil:'networkidle'});

   /* Record a result for every date except the last two. */
   const seeded = await p.evaluate(async DATES => {
     await DB.set('results', null);
     const played = DATES.slice(0, Math.max(0, DATES.length - 2));
     for (const d of played) {
       await DB.set('results/' + d, {
         gameId: d, date: d, finalizedAt: Date.parse(d), winner: 'Tod', field: 4, pot: 120,
         finish: [1,2,3,4].map(i => ({ place:i, name:['Tod','Syd','Guy','Nate'][i-1],
                                       itm:i<3, winnings: i===1?80:(i===2?40:0) }))
       });
     }
     return played;
   }, dates);
   await p.waitForTimeout(1200);

   const view = await p.evaluate(() => ({
     count: document.getElementById('upCount').textContent,
     upcoming: [...document.querySelectorAll('#upcoming .sched-row')].map(r =>
       (r.querySelector('strong')||{}).textContent + ' | ' +
       (r.querySelector('.tag')||{}).textContent),
     past: [...document.querySelectorAll('#past .sched-row')].map(r =>
       (r.querySelector('strong')||{}).textContent + ' | ' +
       (r.querySelector('.tag')||{}).textContent + ' | ' +
       (r.querySelector('small')||{}).textContent),
     pastHidden: document.getElementById('pastSec').hidden
   }));
   say('upCount', view.count);
   say('upcoming', view.upcoming);
   say('past', view.past);

   const expectUp = dates.length - seeded.length;
   ok('counts_only_games_still_to_come',
      view.count.indexOf(String(expectUp)) === 0, {count: view.count, expect: expectUp});
   ok('upcoming_lists_only_those', view.upcoming.length === expectUp, view.upcoming);
   ok('no_played_game_is_tagged_next_up',
      !view.past.some(r => /Next Up/i.test(r)), view.past);
   ok('exactly_one_next_up',
      view.upcoming.filter(r => /Next Up/i.test(r)).length === 1, view.upcoming);
   /* Name the date, not just "something is tagged Next Up" -- an assertion
      that cannot fail is worse than no assertion. */
   const earliestUnplayed = dates.filter(d => seeded.indexOf(d) === -1).sort()[0];
   const nextUpLabel = await p.evaluate(D => {
     const e = LEAGUE.schedule.find(x => x.date === D);
     return e ? e.label : null;
   }, earliestUnplayed);
   ok('the_next_up_is_the_earliest_unplayed_date',
      /Next Up/i.test(view.upcoming[0] || '') &&
      (view.upcoming[0] || '').indexOf(nextUpLabel + ' |') === 0,
      {row: view.upcoming[0], expected: nextUpLabel, date: earliestUnplayed});
   ok('played_games_are_marked_played',
      view.past.length === seeded.length && view.past.every(r => /Played/.test(r)), view.past);
   ok('and_say_who_won', view.past.every(r => /Tod won/.test(r)), view.past[0]);

   /* A date that has gone by with nothing recorded is NOT "played" -- the
      app must not invent a game that was never finalized. */
   const goneBy = await p.evaluate(async DATES => {
     await DB.set('results', null);
     return new Promise(r => setTimeout(() => r(
       [...document.querySelectorAll('#past .sched-row')].map(x =>
         (x.querySelector('.tag')||{}).textContent)), 900));
   }, dates);
   say('past dates with no result', goneBy);
   ok('never_claims_a_game_was_played_without_a_record',
      goneBy.every(t => !/Played/.test(t)), goneBy);

   await c.close();
 }

 await b.close();srv.close();
 console.log(fails.length? '\n'+fails.length+' FAILED: '+[...new Set(fails)].join(', ') : '\nPASSED — a past date is never shown as the next game');
 process.exit(fails.length?1:0);
})();
