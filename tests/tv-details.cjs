/* Optional real-TV QA. Reads/opens detail views only; never confirms poweroff. */
const fs=require('node:fs'),assert=require('node:assert/strict'),{connect}=require('../scripts/cdp.cjs');
(async()=>{
 const c=await connect('org.smwebos.inicio');fs.mkdirSync('research',{recursive:true,mode:0o700});
 async function wait(expression){for(let i=0;i<45;i++){if(await c.evaluate(expression))return;await new Promise(r=>setTimeout(r,400));}throw Error('Timed out waiting for TV UI: '+expression);}
 async function shot(name){const image=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('research/'+name,Buffer.from(image.data,'base64'),{mode:0o600});}
 async function key(code){await c.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{keyCode:${code},which:${code},bubbles:true,cancelable:true}));`);}
 try{
  await wait('!!window.Inicio&&!!Inicio.details&&Inicio.view.picks.length===16');
  const prefs=await c.evaluate('JSON.stringify(Inicio.view.prefs)');
  await c.evaluate('window.__detailQaPower=Inicio.poweroff;Inicio.poweroff=function(){throw Error("Poweroff blocked by detail QA");};Inicio.setPage(1);document.querySelector(".pick").click();');
  await wait('document.querySelector(".detailGenres")&&!document.querySelector(".detailGenres").textContent.includes("Información adicional")');
  await wait('document.querySelector(".detailArtwork img").complete');
  assert.equal(await c.evaluate('Inicio.view.dialog'),'pick');
  const pick=await c.evaluate('({title:document.querySelector(".pickTitleLarge").textContent,facts:document.querySelector(".detailFacts").textContent,genres:document.querySelector(".detailGenres").textContent,poster:document.querySelector(".detailArtwork img").naturalWidth>0,platforms:document.querySelectorAll(".platformChip").length})');
  assert(pick.poster);assert(pick.platforms>0);await shot('tv-v03-recomendacion.png');
  await c.evaluate('document.querySelectorAll(".detailActions button")[2].click()');
  await wait('document.querySelector(".detailGenres")&&!document.querySelector(".detailGenres").textContent.includes("Información adicional")');
  assert.notEqual(await c.evaluate('document.querySelector(".pickTitleLarge").textContent'),pick.title);
  await key(461);await wait('document.activeElement.dataset.zone==="picks"');
  await c.evaluate('document.getElementById("weather").click()');
  await wait('document.querySelectorAll(".hourCard").length===6&&document.querySelectorAll(".dayCard").length===5');
  await shot('tv-v03-tiempo.png');
  const weather=await c.evaluate('({temperature:document.querySelector(".weatherBigTemperature").textContent,metrics:Array.from(document.querySelectorAll(".metricValue")).map(function(n){return n.textContent;}),hours:document.querySelectorAll(".hourCard").length,days:document.querySelectorAll(".dayCard").length,overflowX:document.getElementById("dialog").scrollWidth>document.getElementById("dialog").clientWidth})');
  assert.equal(weather.overflowX,false);assert(weather.metrics.every(s=>s!=='—'));
  await key(461);await wait('document.activeElement.id==="weather"');
  assert.equal(await c.evaluate('JSON.stringify(Inicio.view.prefs)'),prefs,'Detail browsing must preserve preferences');
  const result={result:'PASS',pick,weather,poweroffExecuted:false,preferencesUnchanged:true};
  fs.writeFileSync('research/tv-v03-details.json',JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify(result,null,2));
 }finally{try{await c.evaluate('if(window.__detailQaPower){Inicio.poweroff=window.__detailQaPower;delete window.__detailQaPower;}');}finally{c.close();}}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
