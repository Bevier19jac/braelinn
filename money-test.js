/* ===========================================================================
   MONEY RULES — rounding, the kitty, the bounty, and the in-the-money bonus.

   Pure-engine checks against data.js (no browser), then the live path through
   the real page: a champion is crowned, defends, the bounty stacks, somebody
   knocks him out and takes it.
   =========================================================================== */
const fs=require('fs'), vm=require('vm'), path=require('path');
const fails=[]; const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));

function load() {
  const ctx = { console:{log(){},warn(){},error(){}}, Date: Date,
                localStorage:{getItem:()=>null,setItem(){}} };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'data.js'),'utf8') +
    ';globalThis.LEAGUE=LEAGUE;globalThis.BPL=BPL;', ctx);
  return { LEAGUE: ctx.LEAGUE, BPL: ctx.BPL };
}
const {LEAGUE, BPL} = load();

console.log('\n== EVERY PAYOUT LANDS ON A $10 NOTE ==');
{
  let bad=[], zero=[], sums=[];
  for (let field=2; field<=40; field++) {
    for (const rebuys of [0,1,5,13]) {
      const pot = field*30 + rebuys*30;
      for (const kittyPct of [0,5,10,15,20]) {
        const kitty = BPL.round10(pot*kittyPct/100);
        const net = pot - kitty;
        const table = BPL.payoutTable(net, field);
        if (table.some(a=>a%10!==0)) bad.push({field,rebuys,kittyPct,table});
        if (table.some(a=>a<=0)) zero.push({field,rebuys,kittyPct,table});
        const total = table.reduce((a,b)=>a+b,0);
        if (total!==net) sums.push({field,rebuys,kittyPct,net,total});
        if (kitty%10!==0) bad.push({kitty});
      }
    }
  }
  ok('every payout is a multiple of 10', bad.length===0, bad.slice(0,3));
  ok('nobody is listed as paid $0', zero.length===0, zero.slice(0,3));
  ok('payouts always sum to the pot exactly', sums.length===0, sums.slice(0,3));
  say('20-player example, no kitty', BPL.payoutTable(600, 20));
  say('20-player example, 10% kitty', BPL.payoutTable(600-BPL.round10(60), 20));
}

console.log('\n== IN THE MONEY IS WORTH ' + LEAGUE.points.itmBonus + ' POINTS ==');
{
  const field=20;
  const cash = BPL.pointsFor(4, field, true);
  const dry  = BPL.pointsFor(4, field, false);
  ok('cashing adds exactly the bonus', cash-dry===LEAGUE.points.itmBonus, {cash,dry});
  ok('winner of 20 takes 6,100', BPL.pointsFor(1,20,true)===6100, BPL.pointsFor(1,20,true));
  ok('first out still gets 300', BPL.pointsFor(20,20,false)===300);
  /* The bonus must never let a worse finish outscore a better one. The gap
     between places is 300, so a 100 bonus cannot invert anything -- but check
     it rather than reason about it. */
  let inverted=[];
  for (let f=2; f<=40; f++) {
    const paid = BPL.payoutTable(f*30, f).length;
    const pts=[]; for (let p=1;p<=f;p++) pts.push(BPL.pointsFor(p,f,p<=paid));
    for (let i=1;i<pts.length;i++) if (pts[i] >= pts[i-1]) inverted.push({field:f,place:i+1,pts:pts.slice(i-1,i+1)});
  }
  ok('a worse finish never outscores a better one', inverted.length===0, inverted.slice(0,3));
}

console.log('\n== A GAME ALREADY IN THE BOOKS RESCORES UNDER TODAY\'S RULES ==');
{
  /* A record written BEFORE the in-the-money bonus existed: old point totals
     baked in, no bounty field. The standings must not keep scoring that night
     under the retired formula. */
  const old = {gameId:'2026-09-03',date:'2026-09-03',season:7,label:'Event 1',type:'regular',
    field:10,winner:'Nate',finalizedAt:1,pot:300,gross:300,kitty:0,
    finish:[{place:1,name:'Nate',points:3000,winnings:150,rebuys:0,itm:true},
            {place:2,name:'Syd',points:2700,winnings:90,rebuys:0,itm:true},
            {place:3,name:'Tod',points:2400,winnings:60,rebuys:0,itm:true},
            {place:4,name:'Guy',points:2100,winnings:0,rebuys:0,itm:false},
            {place:10,name:'Jacob',points:300,winnings:0,rebuys:0,itm:false}]};
  const a = BPL.aggregate({'2026-09-03': old});
  const pts = n => (a.players.find(p=>p.name===n)||{}).points;
  ok('the winner picks up the bonus', pts('Nate')===3100, pts('Nate'));
  ok('so does everyone else who cashed', pts('Syd')===2800 && pts('Tod')===2500, [pts('Syd'),pts('Tod')]);
  ok('nobody who missed it gains anything', pts('Guy')===2100 && pts('Jacob')===300, [pts('Guy'),pts('Jacob')]);
  ok('the record itself is untouched', old.finish[0].points===3000, old.finish[0].points);

  /* And where itm was never written, fall back to whether they got paid. */
  const noItm = JSON.parse(JSON.stringify(old));
  noItm.finish.forEach(r => delete r.itm);
  const b = BPL.aggregate({'2026-09-03': noItm});
  const bp = n => (b.players.find(p=>p.name===n)||{}).points;
  ok('winnings stand in for a missing itm flag', bp('Nate')===3100 && bp('Guy')===2100, [bp('Nate'),bp('Guy')]);

  /* A record too odd to recompute keeps whatever it stored, rather than 0. */
  const odd = {gameId:'x',date:'2026-01-01',season:7,label:'x',type:'regular',
    winner:'Nate',finalizedAt:1,
    finish:[{place:1,name:'Nate',points:999},{place:2,name:'Syd',points:111}]};
  const cp = BPL.aggregate({x: odd}).players.find(p=>p.name==='Nate');
  ok('a record with no field size keeps its stored points', cp.points===999, cp.points);
}

console.log('\n== THE BOUNTY STACKS WITH CONSECUTIVE WINS ==');
{
  const g = (date,winner)=>({date,winner,field:10,finish:[{place:1,name:winner,points:3000}]});
  const R = arr => { const o={}; arr.forEach(x=>o[x.date]=x); return o; };
  ok('no bounty before the first game', BPL.bountyOn({})===null);
  let b = BPL.bountyOn(R([g('2026-09-03','Nate')]));
  ok('one win = $20 on Nate', b.name==='Nate' && b.amount===20 && b.streak===1, b);
  b = BPL.bountyOn(R([g('2026-09-03','Nate'), g('2026-09-15','Nate')]));
  ok('back to back = $40', b.amount===40 && b.streak===2, b);
  b = BPL.bountyOn(R([g('2026-09-03','Nate'), g('2026-09-15','Nate'), g('2026-09-29','Nate')]));
  ok('three in a row = $60', b.amount===60, b);
  b = BPL.bountyOn(R([g('2026-09-03','Nate'), g('2026-09-15','Nate'), g('2026-09-29','Syd')]));
  ok('somebody else winning resets it', b.name==='Syd' && b.amount===20, b);
  b = BPL.bountyOn(R([g('2026-09-03','Nate'), g('2026-09-15','Syd'), g('2026-09-29','Nate')]));
  ok('a broken streak does not resume', b.name==='Nate' && b.amount===20, b);
  b = BPL.bountyOn(R([g('2026-09-03','Nate'), g('2026-09-15','Nate')]), '2026-09-15');
  ok('a game only counts history BEFORE it', b.amount===20 && b.name==='Nate', b);
  /* Out of order in the object, in order by date. */
  b = BPL.bountyOn(R([g('2026-09-29','Nate'), g('2026-09-03','Syd'), g('2026-09-15','Nate')]));
  ok('date order, not insertion order', b.name==='Nate' && b.amount===40, b);
}

console.log('\n'+(fails.length?'FAILED: '+fails.join(', '):'ALL PASSED'));
process.exit(fails.length?1:0);
