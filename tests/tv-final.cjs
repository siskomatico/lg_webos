/* Real-TV visual/navigation QA. The destructive power action is guarded, never executed. */
const fs=require('fs'),assert=require('assert'),{connect}=require('../scripts/cdp.cjs');
(async()=>{
 fs.mkdirSync('research',{recursive:true,mode:0o700});
 const c=await connect('org.smwebos.inicio');
 try{
  await c.evaluate(`window.__qaPoweroff=Inicio.poweroff;window.__qaBlockedPoweroff=0;Inicio.poweroff=function(){window.__qaBlockedPoweroff++;return Promise.reject(new Error('Poweroff blocked during QA'));};if(Inicio.view.dialog==='powerPending')throw new Error('Shutdown already pending; QA refused');for(var i=0;i<4&&Inicio.view.dialog;i++)document.dispatchEvent(new KeyboardEvent('keydown',{keyCode:461,which:461,bubbles:true,cancelable:true}));Inicio.setPage(1);`);
  const summary=await c.evaluate(`({title:document.title,lang:document.documentElement.lang,apps:Inicio.view.apps.length,shelf:document.querySelectorAll('#shelf .appTile').length,movies:Inicio.view.picks.filter(function(p){return p.type==='movie';}).length,series:Inicio.view.picks.filter(function(p){return p.type==='tv';}).length,providersConfirmed:Inicio.view.picks.filter(function(p){return p.confirmed;}).length,platforms:Inicio.view.picks.map(function(p){return {title:p.title,type:p.type,platforms:p.providers};}),inputs:Inicio.view.inputs,weather:document.getElementById('temperature').textContent,blur:Array.from(document.querySelectorAll('*')).filter(function(el){var s=getComputedStyle(el);return ((s.filter||'')+(s.backdropFilter||'')).indexOf('blur(')>=0;}).length,brokenIcons:Array.from(document.querySelectorAll('.appTile img')).filter(function(i){return !i.complete||!i.naturalWidth;}).length})`);
  assert.equal(summary.lang,'es');assert.equal(summary.movies,10);assert.equal(summary.series,6);assert.equal(summary.inputs.length,4);assert.equal(summary.blur,0);assert.equal(summary.brokenIcons,0);assert(summary.weather.includes('°'));
  async function screenshot(name){const r=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('research/'+name,Buffer.from(r.data,'base64'));}
  async function key(code,anchor){await c.evaluate(`${anchor?'document.querySelector('+JSON.stringify(anchor)+').focus();':''}document.dispatchEvent(new KeyboardEvent('keydown',{keyCode:${code},which:${code},bubbles:true,cancelable:true}));`);}
  await screenshot('tv-v02-main.png');
  await key(40,'#shelf button');assert.equal(await c.evaluate('Inicio.view.page'),2);
  await new Promise(r=>setTimeout(r,1200));
  await screenshot('tv-v02-page2.png');
  // The refreshed input list must leave a live, connected focus target.
  assert(await c.evaluate(`document.activeElement.isConnected&&document.activeElement.dataset.zone==='inputs'`));
  await key(40,'#inputs button');for(let i=0;i<4;i++)await key(40);
  if(summary.apps>24)assert(await c.evaluate(`document.getElementById('allApps').scrollTop>0`));
  await key(461);assert.equal(await c.evaluate('Inicio.view.page'),1);
  await key(38,'#shelf button');
  const visited=new Set();
  for(let i=0;i<20;i++){visited.add(await c.evaluate(`document.activeElement.dataset.mediaId`));await key(39);}
  assert(visited.size>=16,'Remote can reach all 16 recommendations');
  await key(40);
  const timings=await c.evaluate(`new Promise(function(resolve){var samples=[],last=0,begin=performance.now();function frame(t){if(last)samples.push(t-last);last=t;if(t-begin<2400)requestAnimationFrame(frame);else{var sorted=samples.slice().sort(function(a,b){return a-b;});resolve({scope:'Short renderer rAF sample; NOT compositor/panel FPS',frames:samples.length,meanMs:samples.reduce(function(a,b){return a+b;},0)/samples.length,p95Ms:sorted[Math.floor(sorted.length*.95)]});}}requestAnimationFrame(frame);})`);
  await c.evaluate('Inicio.openSettings()');await screenshot('tv-v02-settings.png');
  await c.evaluate(`Array.from(document.querySelectorAll('.settingRow')).find(function(b){return b.getAttribute('aria-label')==='Estante de aplicaciones';}).click();`);
  assert.equal(await c.evaluate('Inicio.view.dialog'),'shelf');await screenshot('tv-v02-shelf-editor.png');
  await key(461);assert.equal(await c.evaluate('Inicio.view.dialog'),'settings');
  await c.evaluate(`Array.from(document.querySelectorAll('.settingRow')).find(function(b){return b.getAttribute('aria-label')==='Apagar por completo';}).click();`);
  assert.equal(await c.evaluate('Inicio.view.dialog'),'power');
  // OK on the initially selected row CANCELS. No shutdown request is allowed.
  await key(13);assert.equal(await c.evaluate('Inicio.view.dialog'),'settings');
  assert.equal(await c.evaluate('__qaBlockedPoweroff'),0);
  await key(461);await c.evaluate('Inicio.setPage(1)');
  fs.writeFileSync('research/tv-final-smoke-v02.json',JSON.stringify({result:'PASS',...summary,visitedRecommendations:visited.size,poweroffExecuted:false,timings},null,2));
  console.log(JSON.stringify({result:'PASS',apps:summary.apps,shelf:summary.shelf,movies:summary.movies,series:summary.series,confirmed:summary.providersConfirmed,visited:visited.size,poweroffExecuted:false,timings},null,2));
 }finally{
  try{await c.evaluate(`if(window.__qaPoweroff){Inicio.poweroff=window.__qaPoweroff;delete window.__qaPoweroff;}delete window.__qaBlockedPoweroff;`);}finally{c.close();}
 }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
