/* Things gamenight-sim structurally cannot reach. */
const fs=require('fs'), vm=require('vm');
const fails=[];
const chk=(c,m,d)=>{ console.log('  '+(c?'ok  ':'FAIL')+'  '+m+(d!==undefined?'  '+JSON.stringify(d):'')); if(!c) fails.push(m); };

function load(now){
  const ctx={console, Date: now?class extends Date{constructor(...a){super(...(a.length?a:[now]))} static now(){return now}}:Date,
    localStorage:{_:{},getItem(k){return this._[k]||null},setItem(k,v){this._[k]=v},removeItem(k){delete this._[k]}},
    window:{addEventListener(){},dispatchEvent(){}}};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('data.js','utf8')+';globalThis.LEAGUE=LEAGUE;globalThis.BPL=BPL;',ctx);
  return ctx;
}

console.log('\n== A FULL-ROSTER FIELD (sim never exceeds 18) ==');
{
  const {LEAGUE,BPL}=load();
  /* Derived from the roster, never hard-coded -- a number typed in twice is
     a number that drifts the day somebody joins the league. */
  const field=LEAGUE.standings.length;
  console.log('   roster size:',field);
  chk(field>=8,'roster is big enough to be a league',field);
  const names=LEAGUE.standings.map(p=>p.name);
  chk(new Set(names).size===names.length,'every short name is unique',
      names.filter((n,i)=>names.indexOf(n)!==i));
  chk(names.every(n=>n && !/[.#$\[\]/]/.test(n)),
      'no name contains a character Firebase forbids in a key',
      names.filter(n=>!n||/[.#$\[\]/]/.test(n)));
  const pts=[]; for(let p=1;p<=field;p++) pts.push(BPL.pointsFor(p,field));
  chk(pts[0]===field*300,'winner of a full field',pts[0]);
  chk(pts[field-1]===300,'first out still gets 300',pts[field-1]);
  chk(new Set(pts).size===field,'every place scores differently');
  chk(pts.every((v,i)=>i===0||v<pts[i-1]),'points strictly decrease down the finish order');
  const splits=BPL.splitsFor(field);
  const pot=field*30;
  const pay=BPL.payoutTable(pot, field, splits);
  chk(pay.reduce((a,b)=>a+b,0)===pot,'payouts sum to the pot exactly at a full field',
      {field:field,pot:pot,paid:pay.reduce((a,b)=>a+b,0),table:pay});
  chk(pay.every(a=>a>0),'nobody is paid $0 while being listed as paid');
}

console.log('\n== BLIND STRUCTURE COVERS A LONG NIGHT ==');
{
  const {LEAGUE}=load();
  const total=LEAGUE.blinds.reduce((s,l)=>s+l.mins,0);
  chk(total>=200,'structure lasts at least 3h20',total+' min');
  const real=LEAGUE.blinds.filter(b=>!b.break);
  chk(real.every((l,i)=>i===0||l.bb>real[i-1].bb),'blinds only ever go up');
  chk(LEAGUE.blinds.every(b=>b.ante===0),'no antes anywhere');
  const lr=LEAGUE.blinds.findIndex(b=>b.lastRebuy);
  chk(lr>0 && LEAGUE.blinds[lr-1].bb===600,'rebuy window closes right after 300/600');
}

console.log('\n== THE DATE ROLL ACROSS REAL CLOCK EDGES ==');
/* Every case is derived from the calendar in data.js, so adding a game night
   never breaks this test -- it just gets tested. */
{
  const {LEAGUE:L0}=load();
  const cal = L0.schedule.map(e=>e.date).sort();
  const first = cal[0], last = cal[cal.length-1];
  const next  = cal.length > 1 ? cal[1] : null;
  const at = (iso, h, mi, dayShift) => {
    const [y,m,d]=iso.split('-').map(Number);
    return new Date(y, m-1, d+(dayShift||0), h, mi).getTime();
  };
  console.log('   calendar:', cal.join(', '));
  const cases=[
    ['day before the first, 11:59pm', at(first,23,59,-1), first],
    ['first game day, 00:01am',       at(first,0,1),      first],
    ['first game day, 8:29pm',        at(first,20,29),    first],
    ['first game day, 11:59pm',       at(first,23,59),    first],
    ['day after the last, 00:01am',   at(last,0,1,1),     null],
    ['a year after the last',         at(last,12,0,365),  null]
  ];
  /* The one that actually matters on a real season: the morning after a game
     must roll to the NEXT one, not sit on the night that just happened. */
  if (next) cases.splice(4, 0, ['morning after the first -> rolls on', at(first,9,0,1), next]);
  for (const [label, t, want] of cases) {
    const {BPL}=load(t);
    const g=BPL.currentGame();
    const got=g?g.date:null;
    if (want) {
      chk(got===want, label+' -> still tonight', got);
    } else {
      /* With one event on the calendar there is nothing to advance TO. The app
         pins to the last event; the UI is what must refuse to call a past date
         "next game" (see schedule-test.js). What matters here is that it never
         invents a future date. */
      const ctx2 = load(t);
      chk(ctx2.BPL.seasonOver(), label+' -> season correctly reads as over', got);
    }
  }
}

console.log('\n== PAYOUTS AT EVERY FIELD SIZE 2..40 ==');
{
  const {BPL}=load();
  let bad=[];
  for(let f=2;f<=40;f++){
    for(const pot of [f*30, f*30+180, 1, 7]){
      const t=BPL.payoutTable(pot,f,BPL.splitsFor(f));
      const sum=t.reduce((a,b)=>a+b,0);
      if(sum!==pot) bad.push({f,pot,sum});
      if(t.some(a=>a<0)) bad.push({f,pot,neg:true});
    }
  }
  chk(bad.length===0,'payouts always sum to the pot and never go negative',bad.slice(0,4));
}

console.log('\n== POINTS BONUS, IF IT IS EVER SWITCHED ON ==');
{
  const {LEAGUE,BPL}=load();
  LEAGUE.points.placeBonus=[1500,1000,750,500,250];
  const f=20;
  const pts=[]; for(let p=1;p<=f;p++) pts.push(BPL.pointsFor(p,f));
  chk(pts.every((v,i)=>i===0||v<pts[i-1]),'bonus must not let a worse finish outscore a better one',pts.slice(0,7));
  LEAGUE.points.placeBonus=[100,9000];
  const p1=BPL.pointsFor(1,f), p2=BPL.pointsFor(2,f);
  chk(p2>p1,'a deliberately silly bonus DOES invert the order — worth knowing',{first:p1,second:p2});
}

console.log(fails.length? '\n'+fails.length+' PROBLEM(S): '+fails.join(' | ') : '\nno problems found in the blind spots');
