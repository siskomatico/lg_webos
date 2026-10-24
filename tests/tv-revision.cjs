/* Optional v0.4 TV checks: theme, centering and real next-batch loading. No power actions. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{connect}=require('../scripts/cdp.cjs');
(async()=>{
 const c=await connect('org.smwebos.inicio');fs.mkdirSync('research',{recursive:true,mode:0o700});
 async function wait(expression){for(let i=0;i<70;i++){if(await c.evaluate(expression))return;await new Promise(r=>setTimeout(r,500));}throw Error('TV wait timed out: '+expression);}
 async function key(code){await c.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{keyCode:${code},which:${code},bubbles:true,cancelable:true}));`);}
 try{
  await wait('!!window.Inicio&&Inicio.view.picks.length===16');
  const prefs=await c.evaluate('JSON.stringify(Inicio.view.prefs)');
  await c.evaluate('Inicio.setPage(1);document.querySelector(".pick").click();');
  const theme=await c.evaluate('({dark:document.getElementById("app").classList.contains("dark"),detail:getComputedStyle(document.getElementById("dialog")).backgroundColor,panel:getComputedStyle(document.getElementById("live")).backgroundColor})');
  assert.equal(theme.detail,theme.panel,'Details must follow the global theme');
  await key(461);
  const centered=await c.evaluate('({title:document.getElementById("shelfTitle").textContent,positions:(function(){var shelf=document.getElementById("shelf").getBoundingClientRect(),apps=document.querySelectorAll("#shelf button"),first=apps[0].getBoundingClientRect(),last=apps[apps.length-1].getBoundingClientRect();return {center:(shelf.left+shelf.right)/2,apps:(first.left+last.right)/2};})()})');
  assert.equal(centered.title,'TUS APPS');assert(Math.abs(centered.positions.center-centered.positions.apps)<2);
  const before=await c.evaluate('({page:Inicio.view.recommendationPage||1,ids:Inicio.view.picks.map(function(p){return p.type+":"+p.id;})})');
  await c.evaluate('document.getElementById("refreshRecommendations").click()');
  await wait('document.getElementById("refreshRecommendations").getAttribute("aria-busy")==="false"');
  const after=await c.evaluate('({page:Inicio.view.recommendationPage,ids:Inicio.view.picks.map(function(p){return p.type+":"+p.id;}),movies:Inicio.view.picks.filter(function(p){return p.type==="movie";}).length,series:Inicio.view.picks.filter(function(p){return p.type==="tv";}).length})');
  assert.notEqual(after.page,before.page,'Next-batch request must succeed');assert.notDeepEqual(after.ids,before.ids);assert.equal(after.movies,10);assert.equal(after.series,6);
  assert.equal(await c.evaluate('JSON.stringify(Inicio.view.prefs)'),prefs,'Preferences must not change');
  const result={result:'PASS',theme,centered,nextBatch:{previous:before.page,current:after.page,newTitles:after.ids.filter(id=>!before.ids.includes(id)).length},preferencesUnchanged:true,poweroffExecuted:false};
  fs.writeFileSync('research/tv-v04-revision.json',JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result,null,2));
 }finally{c.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
