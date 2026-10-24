const playwright=require('playwright');
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),metadata=require('../ui/icons.json');
// Test artwork is an original geometric placeholder, not extracted app artwork.
for(const app of Object.values(metadata))app.icon='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="192" height="192" rx="24" fill="#3869a8"/><circle cx="96" cy="96" r="48" fill="#fff"/></svg>');
// Additional mock apps exercise overflow without depending on a person's inventory.
const expectedApps=Object.keys(metadata).length-1+8;
let browser,server;
(async()=>{
 fs.mkdirSync(root+'/research',{recursive:true,mode:0o700});
 server=await require('./server.cjs').start(root+'/app');
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
     return route.fulfill({json:{results:Array.from({length:20},(_,i)=>({id:(type==='movie'?100:200)+i,title:type==='movie'?'Película '+i:undefined,name:type==='tv'?'Serie '+i:undefined,backdrop_path:'/fixture-'+i+'.jpg',overview:'Una historia de aventuras y descubrimientos que invita a mirar más allá de lo conocido. '.repeat(28),vote_average:7.8}))}});
   }
   if(url.pathname.endsWith('/watch/providers'))return route.fulfill({json:{results:{ES:{flatrate:[{provider_id:9,provider_name:'Amazon Prime Video'},{provider_id:337,provider_name:'Disney+'}]}}}});
   if(/^\/3\/(movie|tv)\/\d+$/.test(url.pathname))return route.fulfill({json:{release_date:'2026-09-18',first_air_date:'2025-01-10',runtime:126,number_of_seasons:3,poster_path:'/poster-fixture.jpg',genres:[{name:'Aventura'},{name:'Drama'}],credits:{cast:[{name:'Intérprete A'},{name:'Intérprete B'}]}}});
   return route.abort();
 });
 await page.route('https://image.tmdb.org/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="780" height="480"><defs><linearGradient id="g"><stop stop-color="#29384e"/><stop offset="1" stop-color="#896f5b"/></linearGradient></defs><rect width="780" height="480" fill="url(#g)"/></svg>'}));
 const weatherFixture={current:{time:'2026-10-23T14:15',temperature_2m:20,apparent_temperature:19,relative_humidity_2m:65,wind_speed_10m:12,weather_code:2,is_day:1},daily:{time:[23,24,25,26,27].map(n=>'2026-10-'+n),weather_code:[2,0,61,95,71],temperature_2m_max:[24,25,21,22,19],temperature_2m_min:[16,17,15,16,14],precipitation_probability_max:[10,5,80,60,10],sunrise:['2026-10-23T08:15'],sunset:['2026-10-23T19:11']},hourly:{time:Array.from({length:24},(_,i)=>'2026-10-23T'+String(i).padStart(2,'0')+':00'),temperature_2m:Array(24).fill(20),weather_code:Array(24).fill(0),is_day:Array.from({length:24},(_,i)=>i>=8&&i<19?1:0),precipitation_probability:Array(24).fill(10)}};
 await page.route('https://api.open-meteo.com/**',route=>route.fulfill({json:weatherFixture}));
 await page.goto(server.url+'/index.html');
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
 // Cinematic details: lazy metadata, remote scrolling, neighbors and focus restoration.
 await page.locator('.pick').first().click();
 await page.waitForFunction(()=>document.querySelector('.detailGenres').textContent.includes('Aventura'));
 assert.equal(await page.locator('.detailArtwork img').count(),1);
 assert.equal(await page.locator('.platformChip').count(),2);
 assert((await page.locator('.detailFacts').innerText()).includes('126 min'));
 await page.keyboard.press('ArrowDown');assert((await page.locator('#detailScroll').evaluate(n=>n.scrollTop))>0);
 await page.screenshot({path:root+'/research/detalle-recomendacion-desktop.png'});
 const firstTitle=await page.locator('.pickTitleLarge').innerText();
 await page.getByRole('button',{name:'Siguiente →',exact:true}).click();
 assert.notEqual(await page.locator('.pickTitleLarge').innerText(),firstTitle);
 await page.getByRole('button',{name:'← Anterior',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.detailGenres').textContent.includes('Aventura'));
 assert.equal(await page.locator('.pickTitleLarge').innerText(),firstTitle);
 assert.equal(requests.filter(p=>/^\/3\/(movie|tv)\/\d+$/.test(p)).length,2,'Detail metadata cached per title');
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.dataset.zone),'picks');
 await page.locator('#weather').click();
 assert.equal(await page.locator('.hourCard').count(),6);assert.equal(await page.locator('.dayCard').count(),5);
 assert.equal(await page.locator('.weatherBigTemperature').innerText(),'20°C');
 assert((await page.locator('.weatherStats').innerText()).includes('65 %'));
 await page.screenshot({path:root+'/research/detalle-tiempo-desktop.png'});
 const modal=await page.locator('#dialog').boundingBox();assert(modal.x>=0&&modal.y>=0&&modal.x+modal.width<=1920&&modal.y+modal.height<=1080);
 await page.unroute('https://api.open-meteo.com/**');await page.route('https://api.open-meteo.com/**',route=>route.abort());
 await page.getByRole('button',{name:'Actualizar el tiempo',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('weatherDetailStatus').textContent.includes('Datos guardados'));
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'weather');
 await page.locator('#settings').click();await page.getByRole('button',{name:'Temperatura',exact:true}).click();await page.keyboard.press('Escape');
 await page.locator('#weather').click();assert.equal(await page.locator('.weatherBigTemperature').innerText(),'68°F');await page.keyboard.press('Escape');
 await page.locator('#settings').click();await page.getByRole('button',{name:'Temperatura',exact:true}).click();await page.keyboard.press('Escape');
 await page.evaluate(()=>document.querySelector('#shelf button').focus());
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
 // A separate, strictly non-root build configuration: every privileged URI is forbidden.
 const noroot=await browser.newPage({viewport:{width:1920,height:1080}}),nonrootErrors=[];
 noroot.on('pageerror',e=>nonrootErrors.push(e.message));
 await noroot.addInitScript(()=>{
  Object.defineProperty(window,'INICIO_CONFIG',{configurable:true,get(){return {city:'Valencia',lat:39.4699,lon:-.3763,tmdbKey:'',installMode:'noroot',apps:[{id:'netflix',title:'Netflix'},{id:'amazon',title:'Prime Video'}],inputs:[{id:'com.webos.app.hdmi1',title:'Consola'}]};},set(){}});
  window.__calls=[];
  Object.defineProperty(window,'webOS',{configurable:true,get(){return {service:{request(uri,o){__calls.push(uri+'/'+o.method);if(window.__publicCatalog&&o.method==='listLaunchPoints')return o.onSuccess({returnValue:true,launchPoints:[{id:'netflix',title:'Netflix'}]});if(o.method==='launch')o.onSuccess({returnValue:true});else o.onFailure({errorText:'Denied'});}}};},set(){}});
 });
 await noroot.route('https://**',route=>route.abort());
 await noroot.goto(server.url+'/index.html');
 await noroot.waitForFunction(()=>Inicio.capabilities.catalog==='manual'&&Inicio.view.apps.length===2);
 assert.equal(await noroot.locator('#appCount').innerText(),'2 accesos configurados');
 assert.equal(await noroot.locator('#inputs button').count(),2,'TV plus explicitly configured manual HDMI');
 assert((await noroot.locator('#inputs').innerText()).includes('Estado sin confirmar'));
 await noroot.locator('#shelf button').first().click();
 assert((await noroot.evaluate(()=>__calls)).some(c=>c.endsWith('/launch')));
 await noroot.locator('#settings').click();assert(await noroot.getByRole('button',{name:'Apagar por completo',exact:true}).isDisabled());
 assert.equal(await noroot.evaluate(()=>Inicio.poweroff().then(()=>false,()=>true)),true);
 assert.equal(await noroot.evaluate(()=>__calls.some(c=>c.includes('hbchannel'))),false,'Non-root mode must never call Homebrew, even directly');
 await noroot.evaluate(async()=>{window.__publicCatalog=true;await Inicio.refreshApps();});
 assert.equal(await noroot.evaluate(()=>Inicio.capabilities.catalog),'system');assert.equal(await noroot.locator('#appCount').innerText(),'1 aplicación');
 assert.equal(await noroot.evaluate(()=>__calls.some(c=>c.includes('hbchannel'))),false);
 assert.equal(nonrootErrors.length,0,nonrootErrors.join('\n'));await noroot.close();
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(JSON.stringify({result:'PASS',checks:['two screens','shared weather/clock/live/settings header','10 movies + 6 series','ES providers','manual carousel','automatic carousel and focus pause','official local icons','three physical HDMI inputs','all-app grid scrolling','first-app-style shelf toggling/reordering','persistent preferences','cache','live TV launch','no unconfirmed poweroff','poweroff only after explicit confirmation in MOCK','cinematic details and cached metadata','synopsis scroll and focus restoration','six hourly and five daily forecasts','weather stale fallback and C/F conversion','non-root manual and public catalogs','zero privileged calls in non-root mode'],rendererErrors:errors.length,providerLookups:requests.filter(p=>p.endsWith('/watch/providers')).length},null,2));
 await browser.close();await server.close();
})().catch(async error=>{console.error(error);if(browser)await browser.close();if(server)await server.close();process.exitCode=1;});
