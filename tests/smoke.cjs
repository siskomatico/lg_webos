const playwright=require('playwright');
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),metadata=require('../ui/icons.json');
// Test artwork is an original geometric placeholder, not extracted app artwork.
for(const app of Object.values(metadata))app.icon='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" rx="24" fill="#3869a8"/><circle cx="96" cy="96" r="48" fill="#fff"/></svg>');
// Additional mock apps exercise overflow without depending on a person's inventory.
const expectedApps=Object.keys(metadata).length-1+8;
let browser;
(async()=>{
 fs.mkdirSync(root+'/research',{recursive:true,mode:0o700});
 browser=await playwright.chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({metadata})=>{
   Object.defineProperty(window,'INICIO_ICONS',{configurable:true,get(){return metadata;},set(){}});
   Object.defineProperty(window,'INICIO_CONFIG',{configurable:true,get(){return {city:'Valencia',lat:39.4699,lon:-0.3763,tmdbKey:'test-token-not-a-secret'};},set(){}});
   localStorage.setItem('fmtv_theme','day');
   window.__commands=[];window.__launches=[];
   const sdk={service:{request(uri,o){
     if(o.method==='listLaunchPoints')return setTimeout(()=>o.onFailure({errorText:'Denied method call'}),0);
     if(o.method==='getAllInputStatus')return setTimeout(()=>o.onSuccess({returnValue:true,devices:[1,2,3].map(n=>({appId:'com.webos.app.hdmi'+n,label:'HDMI '+n,connected:n===1}))}),0);
     if(o.method==='exec'){
       window.__commands.push(o.parameters.command);
       let stdoutString='';
       if(o.parameters.command.includes('listApps'))stdoutString=JSON.stringify({returnValue:true,apps:Object.keys(metadata).map(id=>({id,title:metadata[id].title,visible:true})).concat(Array.from({length:8},(_,i)=>({id:'test.extra.'+i,title:'Extra '+i,visible:true})),[{id:'hidden.test',title:'Hidden',visible:false}])});
       return setTimeout(()=>o.onSuccess({returnValue:true,stdoutString,stderrString:''}),0);
     }
     if(o.method==='launch'){window.__launches.push(o.parameters.id);return o.onSuccess({returnValue:true});}
     o.onFailure({errorText:'Unexpected mock request'});
   }}};
   Object.defineProperty(window,'webOS',{configurable:true,get(){return sdk;},set(){}});
 },{metadata});
 await page.route('https://api.themoviedb.org/**',async route=>{
   const url=new URL(route.request().url());requests.push(url.pathname);
   if(url.pathname.includes('/discover/')){
     const type=url.pathname.includes('/movie')?'movie':'tv';
     return route.fulfill({json:{results:Array.from({length:20},(_,i)=>({id:(type==='movie'?100:200)+i,title:type==='movie'?'Película '+i:undefined,name:type==='tv'?'Serie '+i:undefined,backdrop_path:'/fixture-'+i+'.jpg',overview:'Sinopsis de prueba en español.',vote_average:7.8}))}});
   }
   if(url.pathname.endsWith('/watch/providers'))return route.fulfill({json:{results:{ES:{flatrate:[{provider_id:9,provider_name:'Amazon Prime Video'},{provider_id:337,provider_name:'Disney+'}]}}}});
   return route.abort();
 });
 await page.route('https://image.tmdb.org/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="780" height="480"><defs><linearGradient id="g"><stop stop-color="#29384e"/><stop offset="1" stop-color="#896f5b"/></linearGradient></defs><rect width="780" height="480" fill="url(#g)"/></svg>'}));
 await page.route('https://api.open-meteo.com/**',route=>route.fulfill({json:{current:{temperature_2m:20,weather_code:2,is_day:1},daily:{sunrise:['2026-10-23T08:15'],sunset:['2026-10-23T19:11']}}}));
 await page.goto('file://'+root+'/app/index.html');
 await page.waitForFunction(count=>Inicio.view.picks.length===16&&Inicio.view.apps.length===count,expectedApps);
 assert.equal(await page.locator('#temperature').innerText(),'20°C');
 assert.equal(await page.evaluate(()=>Inicio.view.prefs.theme),'light','Legacy day theme migrates to light');
 assert.equal(await page.locator('.pick').count(),3);
 assert.equal(await page.evaluate(()=>Inicio.view.picks.filter(p=>p.type==='movie').length),10);
 assert.equal(await page.evaluate(()=>Inicio.view.picks.filter(p=>p.type==='tv').length),6);
 assert((await page.locator('.pickProviders').first().innerText()).includes('Prime Video'));
 assert.equal(await page.locator('#inputs button').count(),4,'TV and exactly three real HDMI ports');
 assert.equal(await page.locator('#allApps button').count(),expectedApps);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('#shelf img')).every(i=>i.complete&&i.naturalWidth>0));
 assert.equal(await page.locator('#shelf .appTile').count(),8);
 assert.equal(await page.locator('#shelf .appTile .appName').count(),0);
 assert.equal(await page.evaluate(()=>Array.from(document.querySelectorAll('*')).filter(n=>(getComputedStyle(n).backdropFilter||'').includes('blur')).length),0);
 assert.equal(await page.evaluate(()=>__commands.some(c=>c.includes('poweroff'))),false);
 await page.screenshot({path:root+'/research/inicio-v02-day.png'});
 // Down from the shelf reveals inputs and every app. The header is shared.
 await page.keyboard.press('ArrowDown');
 assert.equal(await page.evaluate(()=>Inicio.view.page),2);
 assert.equal(await page.locator('header').count(),1);
 await page.keyboard.press('ArrowDown');
 for(let i=0;i<4;i++)await page.keyboard.press('ArrowDown');
 assert((await page.locator('#allApps').evaluate(n=>n.scrollTop))>0,'Grid scrolls with the remote');
 await page.screenshot({path:root+'/research/inicio-v02-page2.png'});
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>Inicio.view.page),1);
 // Manual carousel navigation wraps, and auto-rotation does not fight the remote.
 await page.keyboard.press('ArrowUp');
 const before=await page.evaluate(()=>Inicio.view.start);
 for(let i=0;i<4;i++)await page.keyboard.press('ArrowRight');
 assert.notEqual(await page.evaluate(()=>Inicio.view.start),before);
 await page.keyboard.press('ArrowDown');
 await page.evaluate(()=>{window.__now=Date.now;Date.now=()=>__now()+30000;});await page.waitForTimeout(1150);
 const rotated=await page.evaluate(()=>Inicio.view.start);assert.notEqual(rotated,before);
 await page.keyboard.press('ArrowUp');
 const paused=await page.evaluate(()=>Inicio.view.start);
 await page.evaluate(()=>Date.now=()=>__now()+60000);await page.waitForTimeout(1150);
 assert.equal(await page.evaluate(()=>Inicio.view.start),paused);
 await page.evaluate(()=>Date.now=__now);
 // First-app-style settings: OK selects; arrows reorder; persistence survives reload.
 await page.locator('#settings').click();
 await page.getByRole('button',{name:'Estante de aplicaciones',exact:true}).click();
 const original=await page.evaluate(()=>Inicio.view.prefs.favorites.slice());
 await page.keyboard.press('ArrowRight');
 assert.equal(await page.evaluate(()=>Inicio.view.prefs.favorites[1]),original[0]);
 // DOM replacement beneath an idle pointer must not steal the keyboard's selected app.
 await page.locator('.settingRow').nth(4).dispatchEvent('mouseenter');
 assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),metadata[original[0]].title);
 await page.keyboard.press('Enter');assert.equal(await page.evaluate(id=>Inicio.view.prefs.favorites.includes(id),original[0]),false);
 assert.equal(await page.evaluate(()=>Inicio.view.prefs.favorites.length),7);
 await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>Inicio.view.prefs.favorites.length),8);
 const saved=await page.evaluate(()=>Inicio.view.prefs.favorites.slice());
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>Inicio.view.dialog),'settings');
 await page.getByRole('button',{name:'Tema',exact:true}).click();
 // First click advances light -> dark.
 assert(await page.locator('#app').evaluate(n=>n.classList.contains('dark')));
 await page.keyboard.press('Escape');await page.screenshot({path:root+'/research/inicio-v02-night.png'});
 await page.reload();await page.waitForFunction(count=>Inicio.view.apps.length===count&&Inicio.view.picks.length===16,expectedApps);
 assert.deepEqual(await page.evaluate(()=>Inicio.view.prefs.favorites),saved);
 assert.equal(requests.filter(p=>p.includes('/discover/')).length,2,'Cached mixed recommendations avoid repeat API calls');
 await page.locator('#live').click();assert.equal(await page.evaluate(()=>__launches.at(-1)),'com.webos.app.livetv');
 // Safety: opening or cancelling power confirmation must never shut anything down.
 await page.locator('#settings').click();await page.getByRole('button',{name:'Apagar por completo',exact:true}).click();
 assert.equal(await page.evaluate(()=>__commands.some(c=>c.includes('poweroff'))),false);
 await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>Inicio.view.dialog),'settings');
 await page.getByRole('button',{name:'Apagar por completo',exact:true}).click();
 await page.getByRole('button',{name:'Sí, apagar por completo',exact:true}).click();
 assert.equal(await page.evaluate(()=>__commands.filter(c=>c==='/bin/systemctl --no-block poweroff').length),1);
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({result:'PASS',checks:['two screens','shared weather/clock/live/settings header','10 movies + 6 series','ES providers','manual carousel','automatic carousel and focus pause','official local icons','three physical HDMI inputs','all-app grid scrolling','first-app-style shelf toggling/reordering','persistent preferences','cache','live TV launch','no unconfirmed poweroff','poweroff only after explicit confirmation in MOCK'],rendererErrors:errors.length,providerLookups:requests.filter(p=>p.endsWith('/watch/providers')).length},null,2));
 await browser.close();
})().catch(async error=>{console.error(error);if(browser)await browser.close();process.exitCode=1;});
