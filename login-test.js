/* The sign-in gate: one screen, one tap, and everything downstream knows you.
   Covers a player, a host with the wrong passcode, a host who skips it, the
   "In For Next" head count, and The Table bouncing a stranger to sign in. */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=__dirname;
const T={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p==='/')p='/index.html';
 const f=path.join(ROOT,p);if(!f.startsWith(ROOT)||!fs.existsSync(f)){r.writeHead(404);return r.end('404');}
 r.writeHead(200,{'Content-Type':T[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(r);});
const say=(k,v)=>console.log('  '+k+': '+(typeof v==='string'?v:JSON.stringify(v)));
const fails=[];const ok=(k,c,d)=>{console.log('  '+(c?'ok  ':'FAIL')+'  '+k+(d!==undefined?'  '+JSON.stringify(d):''));if(!c)fails.push(k)};
(async()=>{await new Promise(r=>srv.listen(8967,r));
 const b=await chromium.launch();const c=await b.newContext({viewport:{width:390,height:844}});
 await c.route('**/gstatic.com/**',r=>r.abort());
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const B='http://localhost:8967/';
 const wipe=async()=>{await p.goto(B+'index.html',{waitUntil:'domcontentloaded'});
   await p.evaluate(()=>{try{localStorage.clear();sessionStorage.clear()}catch(e){}});};

 await wipe();
 await p.goto(B+'index.html',{waitUntil:'networkidle'}); await p.waitForTimeout(900);

 console.log('\n== THE APP OPENS ON ONE QUESTION ==');
 ok('gate_is_up', await p.locator('#signIn').isVisible());
 ok('page_behind_is_locked', await p.evaluate(()=>document.body.classList.contains('gated')));
 const n = await p.locator('.si-row').count();
 ok('whole_roster_listed', n===34, n);
 ok('hosts_are_marked', await p.locator('.si-row .si-tag').count()===2);
 await p.fill('#siFilter','syd'); await p.waitForTimeout(200);
 ok('typing_narrows_it', await p.locator('.si-row').count()===1, await p.locator('.si-row').count());
 await p.fill('#siFilter','zzzz'); await p.waitForTimeout(200);
 ok('no_match_says_so', (await p.locator('#siList').innerText()).includes('No one by that name'));
 await p.fill('#siFilter','');

 console.log('\n== A PLAYER TAPS THEIR NAME AND IS IN ==');
 await p.click('.si-row[data-n="Syd"]'); await p.waitForTimeout(700);
 ok('gate_gone', await p.locator('#signIn').isVisible()===false);
 ok('remembered', await p.evaluate(()=>localStorage.getItem('bpl_me'))==='Syd');
 ok("no_master_control_for_a_player", await p.locator("#btnUnlockHere").count()===0);

 console.log('\n== AND THE RSVP IS THREE BUTTONS, NOT THIRTY-FOUR ROWS ==');
 ok('my_card_is_mine', (await p.locator('#myRsvp').innerText()).includes('Syd'));
 ok('three_buttons', await p.locator('#myRsvp .mychip').count()===3);
 ok('long_list_folded_away', await p.locator('#everyoneBox').isVisible()===false);
 say('my card', (await p.locator('#myRsvp').innerText()).replace(/\n+/g,' | '));
 await p.click('#myRsvp .mychip.in'); await p.waitForTimeout(600);
 ok('answer_sticks', (await p.locator('#myRsvp .mychip.in').getAttribute('class')).includes('on'));
 ok('tally_counts_me', (await p.locator('#tIn').innerText())==='1', await p.locator('#tIn').innerText());
 ok('clear_offered', await p.locator('#btnClearMine').count()===1);

 console.log('\n== "IN FOR NEXT" OPENS THE HEAD COUNT ==');
 await p.click('#stInBtn'); await p.waitForTimeout(400);
 ok('sheet_opens', await p.locator('.sheet-wrap').isVisible());
 const sheet = await p.locator('.sheet').innerText();
 ok('lists_who_is_in', sheet.includes('Syd'), sheet.split('\n').slice(0,6));
 ok('marks_me', await p.locator('.wi-row.isme').count()===1);
 await p.keyboard.press('Escape'); await p.waitForTimeout(300);
 ok('escape_closes_it', await p.locator('.sheet-wrap').count()===0);

 console.log('\n== THE FULL LIST IS STILL THERE FOR WHOEVER NEEDS IT ==');
 await p.click('#btnEveryone'); await p.waitForTimeout(400);
 ok('expands', await p.locator('#everyoneBox').isVisible());
 ok('rows_render', await p.locator('#rsvpList .rsvp-row').count()>0);
 ok('my_row_is_flagged', await p.locator('#rsvpList .rsvp-row.isme').count()===1);
 await p.click('#btnEveryone'); await p.waitForTimeout(300);
 ok('collapses_again', await p.locator('#everyoneBox').isVisible()===false);

 console.log('\n== THE TABLE ALREADY KNOWS THEM ==');
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(900);
 ok('no_second_login', p.url().includes('game.html'));
 ok('table_does_not_reask', await p.locator('#whoSec').isVisible()===false);

 console.log('\n== A STRANGER OPENING THE TABLE GETS SENT TO SIGN IN ==');
 await wipe();
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1200);
 ok('bounced_to_signin', p.url().includes('index.html'), p.url());
 ok('and_it_remembers_where_they_were_going', p.url().includes('next=game'));
 ok('gate_is_up_there', await p.locator('#signIn').isVisible());
 await p.click('.si-row[data-n="Syd"]'); await p.waitForTimeout(1500);
 ok('and_lands_back_on_the_table', p.url().includes('game.html'), p.url());

 console.log('\n== NATE: WRONG PASSCODE GIVES NOTHING ==');
 await wipe();
 await p.goto(B+'index.html',{waitUntil:'networkidle'}); await p.waitForTimeout(900);
 await p.click('.si-row[data-n="Nate"]'); await p.waitForTimeout(400);
 ok('passcode_step', await p.locator('#siHost').isVisible());
 ok('name_shown_back', (await p.locator('#siYou').innerText()).includes('Nate'));
 ok('not_signed_in_yet', await p.evaluate(()=>!localStorage.getItem('bpl_me')));
 await p.fill('#siPin','9999'); await p.click('#siGo'); await p.waitForTimeout(1200);
 ok('rejected', await p.locator('#siHost').isVisible());
 ok('says_why', (await p.locator('#siErr').innerText()).length>3, await p.locator('#siErr').innerText());
 ok('still_locked', await p.evaluate(()=>!Admin.isUnlocked()));
 ok('still_not_signed_in', await p.evaluate(()=>!localStorage.getItem('bpl_me')));

 console.log('\n== RIGHT PASSCODE UNLOCKS MASTER CONTROL ==');
 await p.fill('#siPin','1234'); await p.click('#siGo'); await p.waitForTimeout(1400);
 ok('gate_gone', await p.locator('#signIn').isVisible()===false);
 ok('signed_in_as_nate', await p.evaluate(()=>localStorage.getItem('bpl_me'))==='Nate');
 ok('unlocked', await p.evaluate(()=>Admin.isUnlocked()));
 ok('master_control_linked', await p.locator('.wb-host a[href="game.html"]').count()===1);
 await p.goto(B+'game.html',{waitUntil:'networkidle'}); await p.waitForTimeout(900);
 ok('master_button_on_the_table', await p.locator('#btnMaster').isVisible());

 console.log('\n== A HOST CAN SKIP THE PASSCODE AND JUST PLAY ==');
 await wipe();
 await p.goto(B+'index.html',{waitUntil:'networkidle'}); await p.waitForTimeout(900);
 await p.click('.si-row[data-n="Jacob"]'); await p.waitForTimeout(400);
 await p.click('#siSkip'); await p.waitForTimeout(700);
 ok('signed_in', await p.evaluate(()=>localStorage.getItem('bpl_me'))==='Jacob');
 ok('but_locked', await p.evaluate(()=>!Admin.isUnlocked()));
 ok('unlock_still_offered_later', await p.locator('#btnUnlockHere').count()===1);

 console.log('\n== NOT ME PUTS THE GATE BACK ==');
 await p.click('#btnNotMe'); await p.waitForTimeout(600);
 ok('gate_returns', await p.locator('#signIn').isVisible());
 ok('forgotten', await p.evaluate(()=>!localStorage.getItem('bpl_me')));

 console.log('\n== NOTHING THREW ==');
 ok('no_page_errors', errs.length===0, errs.slice(0,3));

 console.log('\n'+(fails.length?'FAILED: '+fails.join(', '):'ALL PASSED'));
 await b.close(); srv.close(); process.exit(fails.length?1:0);
})();
