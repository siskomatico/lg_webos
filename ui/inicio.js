(function () {
    'use strict';
    var api=window.Inicio, $=function(id){return document.getElementById(id);};
    var defaults=['amazon','com.disney.disneyplus-prod','io.strem.tv','youtube.leanback.v4','com.wbd.stream','com.amazoff.patcher','twitch.adamffdev.v1','netflix'];
    function glyph(name){
        var paths={sun:'<circle cx="24" cy="24" r="10"/><path d="M24 3v6m0 30v6M3 24h6m30 0h6M9 9l5 5m20 20 5 5M9 39l5-5m20-20 5-5"/>',moon:'<path d="M39 28A18 18 0 1 1 20 9a14 14 0 0 0 19 19z"/>',cloud:'<path d="M12 35a9 9 0 1 1 3-17 12 12 0 0 1 23 3 7 7 0 0 1-1 14z"/>',hdmi:'<path d="M8 10h32v19L32 39H16L8 29zM15 17h18M16 24v5m8-5v5m8-5v5"/>',tv:'<rect x="5" y="10" width="38" height="27" rx="4"/><path d="M17 44h14M15 3l9 7 9-7"/>'};
        return '<svg viewBox="0 0 48 48" aria-hidden="true">'+paths[name]+'</svg>';
    }
    function readJSON(key){try{return JSON.parse(localStorage.getItem(key));}catch(error){return null;}}
    var saved=readJSON('inicio.prefs.v2')||{},legacy=readJSON('fmtv_favorites');
    var favorites=Array.isArray(saved.favorites)?saved.favorites:(Array.isArray(legacy)?legacy:defaults);
    var storedTheme=saved.theme||localStorage.getItem('fmtv_theme')||'auto';
    storedTheme=({day:'light',night:'dark',black:'dark'})[storedTheme]||storedTheme;
    var prefs={favorites:favorites.filter(function(id,i,all){return typeof id==='string'&&!/^com\.webos\.app\.hdmi/.test(id)&&all.indexOf(id)===i;}).slice(0,8),
        theme:['auto','light','dark'].indexOf(storedTheme)>=0?storedTheme:'auto',
        unit:saved.unit==='F'?'F':'C',weather:saved.weather!==false,city:typeof saved.city==='string'?saved.city:(localStorage.getItem('fmtv_city')||INICIO_CONFIG.city),
        autoRotate:saved.autoRotate!==false,rotation:[8,12,20].indexOf(saved.rotation)>=0?saved.rotation:12};
    var view=api.view={page:1,dialog:'',apps:[],inputs:[],picks:[],start:0,prefs:prefs};
    var pointerX=null,pointerY=null;
    var active=null,dialogRows=[],dialogIndex=0,returnIndex=0,toastTimer,lastInteraction=Date.now(),lastRotation=Date.now(),weatherBusy=false,weatherData=null,weatherAt=0,pendingLaunch=false;
    function persist(){try{localStorage.setItem('inicio.prefs.v2',JSON.stringify(prefs));}catch(error){toast('No se han podido guardar los cambios.');}}
    function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(function(){$('toast').hidden=true;},5000);}
    api.toast=toast;
    function text(tag,className,value,parent){var node=document.createElement(tag);if(className)node.className=className;node.textContent=value;if(parent)parent.appendChild(node);return node;}
    function nodes(zone){return Array.prototype.slice.call(document.querySelectorAll('[data-zone="'+zone+'"]')).filter(function(n){return !n.disabled;});}
    function focus(node){
        if(!node||node.disabled)return;
        if(active&&active!==node)active.classList.remove('focused');
        active=node;node.classList.add('focused');
        try{node.focus({preventScroll:true});}catch(error){node.focus();}
        if(node.dataset.zone==='all'||node.dataset.zone==='dialog')node.scrollIntoView({block:'nearest',inline:'nearest'});
        if(node.dataset.zone==='dialog')dialogIndex=Number(node.dataset.index);
    }
    function pointerFocus(node,event){
        // A redraw beneath a stationary pointer must not override D-pad selection.
        if(event.clientX===pointerX&&event.clientY===pointerY)return;
        pointerX=event.clientX;pointerY=event.clientY;
        if(!view.dialog||node.dataset.zone==='dialog')focus(node);
    }
    function focusZone(zone,index){var list=nodes(zone);if(!list.length&&zone!=='header')list=nodes('header');focus(list[Math.max(0,Math.min(list.length-1,index||0))]);}
    function button(parent,zone,index,label,run,className){
        var b=document.createElement('button');b.type='button';b.className=className||'';b.dataset.zone=zone;b.dataset.index=index;b.setAttribute('aria-label',label);
        b.addEventListener('focus',function(){if(active!==b)focus(b);});
        b.addEventListener('mousemove',function(event){pointerFocus(b,event);});
        b.addEventListener('click',function(){lastInteraction=Date.now();focus(b);run();});parent.appendChild(b);return b;
    }
    function icon(parent,app){
        var fallback=text('span','iconFallback',app.title,parent);
        if(!app.icon)return;
        var image=document.createElement('img');image.alt=app.title;image.draggable=false;if(app.brand)image.className='brandIcon';
        image.onload=function(){fallback.hidden=true;};image.onerror=function(){image.remove();fallback.hidden=false;};
        image.src=app.icon;parent.appendChild(image);fallback.hidden=true;
    }
    function launch(id){
        if(pendingLaunch)return;pendingLaunch=true;
        api.launch(id).catch(function(){toast('No se ha podido abrir la aplicación o entrada.');}).then(function(){pendingLaunch=false;});
    }
    function appTile(parent,zone,index,app){var b=button(parent,zone,index,app.title,function(){launch(app.id);},'appTile');b.dataset.appId=app.id;if(/^#[0-9a-f]{3,8}$/i.test(app.color||''))b.style.backgroundColor=app.color;icon(b,app);return b;}
    function shelfApps(){return prefs.favorites.map(function(id){return view.apps.find(function(a){return a.id===id;});}).filter(Boolean);}
    function renderApps(){
        var oldZone=active&&active.dataset.zone,oldId=active&&active.dataset.appId;
        $('shelf').innerHTML='';$('allApps').innerHTML='';
        shelfApps().forEach(function(app,i){appTile($('shelf'),'shelf',i,app);});
        if(!shelfApps().length)text('div','empty','Elige tus favoritas en ⚙ Ajustes → Estante.',$('shelf'));
        view.apps.forEach(function(app,i){appTile($('allApps'),'all',i,app);});
        $('appCount').textContent=view.apps.length+' aplicaciones';
        if(oldZone==='shelf'||oldZone==='all'){
            var replacement=nodes(oldZone).find(function(n){return n.dataset.appId===oldId;});
            focus(replacement||nodes(oldZone)[0]);
        }
    }
    function refreshApps(){
        return api.getApps().then(function(apps){
            view.apps=apps;
            var installed=prefs.favorites.filter(function(id){return apps.some(function(app){return app.id===id;});});
            if(installed.length!==prefs.favorites.length){prefs.favorites=installed;persist();}
            renderApps();if(view.dialog==='shelf')openShelf();
        }).catch(function(){toast('No se pudo actualizar la lista. Se conserva la última disponible.');});
    }
    function renderInputs(){
        var wasFocused=active&&active.dataset.zone==='inputs',oldIndex=wasFocused?Number(active.dataset.index):0;
        $('inputs').innerHTML='';view.inputs.forEach(function(input,i){
            var b=button($('inputs'),'inputs',i,input.title,function(){launch(input.id);},'inputTile');
            var mark=text('span','inputGlyph','',b);mark.innerHTML=glyph(i===0?'tv':'hdmi');text('strong','inputTitle',input.title,b);text('span','inputStatus',input.status,b);b.dataset.inputId=input.id;
        });
        if(wasFocused&&!view.dialog)focusZone('inputs',oldIndex);
    }
    function refreshInputs(){return api.getInputs().then(function(inputs){view.inputs=inputs;try{localStorage.setItem('inicio.inputs',JSON.stringify(inputs));}catch(error){}renderInputs();}).catch(function(){view.inputs.forEach(function(i){if(i.id!=='com.webos.app.livetv')i.status='Estado sin confirmar';});renderInputs();});}
    function setPage(page){
        view.page=page;$('page1').hidden=page!==1;$('page2').hidden=page!==2;$('pageNumber').textContent=page+' / 2';
        if(page===2){focusZone('inputs',0);refreshInputs();}else focusZone('shelf',0);
    }
    function renderCarousel(){
        var focused=active&&active.dataset.zone==='picks',position=focused?Number(active.dataset.index):0;
        $('carousel').innerHTML='';
        if(!view.picks.length){text('div','loading','Buscando películas y series disponibles en España…',$('carousel'));return;}
        for(var slot=0;slot<3;slot++)(function(slot){
            var item=view.picks[(view.start+slot)%view.picks.length];
            var b=button($('carousel'),'picks',slot,item.title+' · '+item.providers,function(){showPick(item);},'pick');b.dataset.mediaType=item.type;b.dataset.mediaId=item.id;
            var image=document.createElement('img');image.alt='';image.src=item.image;image.onerror=function(){image.style.visibility='hidden';};b.appendChild(image);
            text('span','pickShade','',b);var content=text('span','pickContent','',b);
            text('span','pickType',(item.type==='movie'?'PELÍCULA':'SERIE')+(item.rating?' · '+Number(item.rating).toFixed(1).replace('.',',')+' ★':''),content);
            text('strong','pickTitle',item.title,content);text('span','pickProviders',item.providers,content);
        })(slot);
        if(focused)focusZone('picks',position);
        var next=view.picks[(view.start+3)%view.picks.length];if(next){var preload=new Image();preload.src=next.image;}
    }
    function loadPicks(force){
        if(document.hidden)return;
        api.loadRecommendations(force).then(function(result){
            view.picks=result.items;view.start=view.start%view.picks.length;renderCarousel();
            var movies=view.picks.filter(function(p){return p.type==='movie';}).length,shows=view.picks.length-movies;
            $('recommendationInfo').textContent=movies+' películas · '+shows+' series · España'+(result.stale?' · Sin actualizar':'');
        }).catch(function(){if(!view.picks.length)$('carousel').firstChild.textContent='No se han podido cargar las recomendaciones. Reintenta desde Ajustes.';toast('TMDB no está disponible. No se inventarán plataformas.');});
    }
    function slide(direction,automatic){
        if(!view.picks.length)return;
        view.start=(view.start+direction+view.picks.length)%view.picks.length;lastRotation=Date.now();renderCarousel();
        if(!automatic)lastInteraction=Date.now();
    }
    function theme(){var dark=prefs.theme==='dark'||(prefs.theme!=='light'&&(weatherData?weatherData.current.is_day!==1:new Date().getHours()<8||new Date().getHours()>=20));$('app').classList.toggle('dark',dark);}
    function clock(){if(document.hidden)return;var now=new Date();$('clock').textContent=now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});$('date').textContent=now.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});theme();}
    function weatherLabel(code){if(code===0)return 'Despejado';if(code<=3)return 'Parcialmente nuboso';if(code<=48)return 'Niebla';if(code<=67)return 'Lluvia';if(code<=77)return 'Nieve';if(code<=82)return 'Chubascos';return 'Tormentas';}
    function renderWeather(){
        $('weather').style.visibility=prefs.weather?'visible':'hidden';$('weather').disabled=!prefs.weather;
        $('weatherCity').textContent=prefs.city;
        if(!weatherData)return;
        var current=weatherData.current,value=current.temperature_2m;if(prefs.unit==='F')value=value*9/5+32;
        $('temperature').textContent=Math.round(value)+'°'+prefs.unit;
        $('weatherIcon').innerHTML=glyph(current.is_day?(current.weather_code===0?'sun':'cloud'):'moon');
        $('weatherDescription').textContent=weatherLabel(current.weather_code);theme();
    }
    function fetchWeather(force){
        if(document.hidden||!prefs.weather||weatherBusy||(!force&&Date.now()-weatherAt<1800000))return;
        weatherBusy=true;var city=prefs.city,lat=INICIO_CONFIG.lat,lon=INICIO_CONFIG.lon;
        var cached=readJSON('inicio.weather.v2');
        var geo=(city.toLowerCase()===INICIO_CONFIG.city.toLowerCase())?Promise.resolve({latitude:lat,longitude:lon}):api.fetchJSON('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(city)+'&count=1&language=es').then(function(data){if(!data.results||!data.results[0])throw new Error('Ciudad no encontrada');return data.results[0];});
        geo.then(function(loc){return api.fetchJSON('https://api.open-meteo.com/v1/forecast?latitude='+loc.latitude+'&longitude='+loc.longitude+'&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=1');}).then(function(data){
            if(!data.current)throw new Error('Sin datos');if(city!==prefs.city)return;
            weatherData=data;weatherAt=Date.now();try{localStorage.setItem('inicio.weather.v2',JSON.stringify({city:city,at:weatherAt,data:data}));}catch(error){}renderWeather();
        }).catch(function(){
            if(cached&&cached.data&&cached.data.current&&cached.city===city&&Date.now()-cached.at<86400000){weatherData=cached.data;renderWeather();$('weatherDescription').textContent+=' · Guardado';}
            else{$('temperature').textContent='—°';$('weatherDescription').textContent='Sin datos del tiempo';}
        }).then(function(){weatherBusy=false;});
    }
    function showDialog(type,title,rows,hint,selected){
        view.dialog=type;dialogRows=rows;$('dialogTitle').textContent=title;$('dialogHint').textContent=hint||'';$('dialogList').innerHTML='';$('overlay').hidden=false;
        rows.forEach(function(row,i){
            var b=button($('dialogList'),'dialog',i,row.label,function(){row.run();},'settingRow'+(row.danger?' danger':''));
            var label=text('span',row.app?'nameWithIcon':'settingLabel','',b);
            if(row.app){var image=document.createElement('img');image.src=row.app.icon;image.alt='';image.onerror=function(){image.remove();};label.appendChild(image);}
            text('span','settingLabel',row.label,label);text('span','settingValue',row.value||'',b);
        });
        focusZone('dialog',selected||0);
    }
    function closeDialog(){view.dialog='';$('overlay').hidden=true;dialogRows=[];if(view.page===1)focusZone('shelf',0);else focusZone('inputs',0);}
    function cycle(key,values,direction,index){var i=values.indexOf(prefs[key]);prefs[key]=values[(i+(direction||1)+values.length)%values.length];persist();theme();renderWeather();openSettings(index);}
    function openSettings(selected){
        var labels={auto:'Automático',light:'Claro',dark:'Oscuro'};
        var rows=[
            {label:'Tema',value:'‹ '+(labels[prefs.theme]||'Automático')+' ›',run:function(){cycle('theme',['auto','light','dark'],1,0);},step:function(d){cycle('theme',['auto','light','dark'],d,0);}},
            {label:'Temperatura',value:'‹ °'+prefs.unit+' ›',run:function(){cycle('unit',['C','F'],1,1);},step:function(d){cycle('unit',['C','F'],d,1);}},
            {label:'Mostrar el tiempo',value:prefs.weather?'Activado':'Desactivado',run:function(){prefs.weather=!prefs.weather;persist();renderWeather();fetchWeather();openSettings(2);}},
            {label:'Ciudad del tiempo',value:prefs.city+' ›',run:openCity},
            {label:'Carrusel automático',value:prefs.autoRotate?'Activado':'Desactivado',run:function(){prefs.autoRotate=!prefs.autoRotate;persist();openSettings(4);}},
            {label:'Cambiar recomendación cada',value:'‹ '+prefs.rotation+' segundos ›',run:function(){cycle('rotation',[8,12,20],1,5);},step:function(d){cycle('rotation',[8,12,20],d,5);}},
            {label:'Estante de aplicaciones',value:prefs.favorites.length+' / 8  ›',run:openShelf},
            {label:'Actualizar aplicaciones y recomendaciones',value:'›',run:function(){refreshApps();refreshInputs();loadPicks(true);toast('Actualizando…');}},
            {label:'Ajustes de la TV',value:'›',run:function(){launch('com.palm.app.settings');}},
            {label:'Apagar por completo',value:'Apagar',danger:true,run:confirmPower}
        ];
        showDialog('settings','⚙  Ajustes del inicio',rows,'↑ ↓ elige · OK o ← → cambia el valor · Atrás cierra',selected);
    }
    function editList(){
        return view.apps.slice().sort(function(a,b){var ia=prefs.favorites.indexOf(a.id),ib=prefs.favorites.indexOf(b.id);if(ia>=0||ib>=0)return(ia<0?999:ia)-(ib<0?999:ib);return a.title.localeCompare(b.title,'es');});
    }
    function editShelf(app,direction){
        var ids=prefs.favorites.slice(),at=ids.indexOf(app.id);
        if(direction===0){if(at>=0)ids.splice(at,1);else if(ids.length<8)ids.push(app.id);else{toast('El estante admite hasta 8 aplicaciones. Quita una antes.');return;}}
        else{if(at<0)return;var to=Math.max(0,Math.min(ids.length-1,at+direction));ids.splice(at,1);ids.splice(to,0,app.id);}
        prefs.favorites=ids;persist();renderApps();openShelf(app.id);
    }
    function openShelf(selectedId){
        var apps=editList();
        var rows=apps.map(function(app){var at=prefs.favorites.indexOf(app.id);return{label:app.title,app:app,value:at>=0?'#'+(at+1):'Fuera del estante',run:function(){editShelf(app,0);},step:function(d){editShelf(app,d);}};});
        var index=selectedId?Math.max(0,apps.findIndex(function(a){return a.id===selectedId;})):0;
        showDialog('shelf','Estante · elige y ordena',rows,'OK añade o quita (máximo 8) · ← → mueve la aplicación · Atrás vuelve',index);
    }
    function openCity(){
        showDialog('city','Ciudad del tiempo',[{label:'Guardar',run:saveCity},{label:'Cancelar',run:function(){openSettings(3);}}],'Escribe la ciudad · OK guarda · ↓ pasa a los botones');
        var input=document.createElement('input');input.id='cityInput';input.className='cityInput';input.type='text';input.maxLength=80;input.value=prefs.city;input.setAttribute('aria-label','Ciudad');$('dialogList').insertBefore(input,$('dialogList').firstChild);if(active)active.classList.remove('focused');input.focus();
    }
    function saveCity(){var value=$('cityInput').value.trim();if(!value){toast('Escribe una ciudad.');return;}prefs.city=value;weatherAt=0;weatherData=null;persist();renderWeather();fetchWeather(true);openSettings(3);}
    function confirmPower(){
        showDialog('power','¿Apagar por completo la TV?',[
            {label:'Cancelar',run:function(){openSettings(9);}},
            {label:'Sí, apagar por completo',danger:true,run:function(){
                if(view.dialog==='powerPending')return;view.dialog='powerPending';dialogRows=[];$('dialogList').innerHTML='';text('p','detailText','Cerrando webOS…',$('dialogList'));$('dialogHint').textContent='No desenchufes la TV durante el apagado.';
                api.poweroff().catch(function(){toast('No se pudo solicitar el apagado.');openSettings(9);});
            }}
        ],'Apagado ordenado de webOS, no suspensión. El próximo encendido será más lento. Función pendiente de su primera prueba física.');
    }
    function showPick(item){
        showDialog('pick',item.title,[{label:'Volver al carrusel',run:closeDialog}],'Disponibilidad en España según TMDB / JustWatch. Puede requerir suscripción, alquiler o compra; no comprueba tus cuentas.');
        var box=document.createElement('div');text('p','detailText',item.overview,box);text('p','detailProviders',item.providers,box);$('dialogList').insertBefore(box,$('dialogList').firstChild);
    }
    function showWeather(){
        showDialog('weather','El tiempo en '+prefs.city,[{label:'Volver',run:closeDialog}],'Datos meteorológicos: Open-Meteo.');
        var message=$('temperature').textContent+' · '+$('weatherDescription').textContent;
        if(weatherData&&weatherData.daily){var d=weatherData.daily;message+='\nAmanecer '+(d.sunrise[0]||'').split('T')[1]+' · Atardecer '+(d.sunset[0]||'').split('T')[1];}
        var p=text('p','detailText',message);$('dialogList').insertBefore(p,$('dialogList').firstChild);
    }
    function back(){
        if(view.dialog==='shelf'){openSettings(6);return;}
        if(view.dialog==='city'){openSettings(3);return;}
        if(view.dialog==='power'){openSettings(9);return;}
        if(view.dialog==='powerPending')return;
        if(view.dialog){closeDialog();return;}
        if(view.page===2)setPage(1);else focusZone('shelf',0);
    }
    function move(dx,dy){
        if(view.dialog){
            if(!dialogRows.length)return;
            if(dy){focusZone('dialog',dialogIndex+dy);return;}
            if(dx&&dialogRows[dialogIndex].step)dialogRows[dialogIndex].step(dx);
            else if(dx&&view.dialog==='settings')dialogRows[dialogIndex].run();
            return;
        }
        var zone=active&&active.dataset.zone,index=active?Number(active.dataset.index||0):0;
        if(zone==='header'){
            var header=nodes('header'),at=header.indexOf(active);
            if(dx)focus(header[Math.max(0,Math.min(header.length-1,at+dx))]);
            if(dy>0)focusZone(view.page===1?'picks':'inputs',0);
            if(dy<0&&view.page===2)setPage(1);
        }else if(zone==='picks'){
            if(dx){if(index+dx>=0&&index+dx<3)focusZone('picks',index+dx);else{slide(dx,false);focusZone('picks',index);}}
            if(dy>0)focusZone('shelf',Math.round(index*Math.max(0,shelfApps().length-1)/2));
            if(dy<0)focusZone('header',index===0?0:1);
        }else if(zone==='shelf'){
            if(dx)focusZone('shelf',index+dx);
            if(dy>0)setPage(2);
            if(dy<0)focusZone(view.picks.length?'picks':'header',Math.min(2,Math.round(index*2/Math.max(1,shelfApps().length-1))));
        }else if(zone==='inputs'){
            if(dx)focusZone('inputs',index+dx);
            if(dy>0)focusZone('all',index*2);
            if(dy<0)focusZone('header',0);
        }else if(zone==='all'){
            var all=nodes('all');
            if(dx)focusZone('all',index+dx);
            if(dy>0)focusZone('all',Math.min(all.length-1,index+8));
            if(dy<0){if(index<8)focusZone('inputs',Math.floor(index/2));else focusZone('all',index-8);}
        }else{focusZone(view.page===1?'shelf':'inputs',0);}
    }
    document.addEventListener('keydown',function(event){
        var code=event.keyCode||event.which;lastInteraction=Date.now();
        if(event.target.tagName==='INPUT'){
            if(code===461||code===27){event.preventDefault();back();}else if(code===13){event.preventDefault();saveCity();}else if(code===40){event.preventDefault();focusZone('dialog',0);}return;
        }
        if(code===461||code===27||event.key==='GoBack'){event.preventDefault();event.stopPropagation();back();return;}
        if(code===13){event.preventDefault();if(active&&active.isConnected)active.click();return;}
        if(code>=37&&code<=40){event.preventDefault();move(code===37?-1:code===39?1:0,code===38?-1:code===40?1:0);}
    });
    $('settings').addEventListener('click',function(){openSettings();});$('live').addEventListener('click',function(){launch('com.webos.app.livetv');});$('weather').addEventListener('click',showWeather);$('nextPage').addEventListener('click',function(){setPage(2);});
    nodes('header').forEach(function(b,i){b.dataset.index=i;b.addEventListener('mousemove',function(event){pointerFocus(b,event);});b.addEventListener('focus',function(){if(!view.dialog&&active!==b)focus(b);});});
    function resize(){var scale=Math.min(innerWidth/1920,innerHeight/1080);$('app').style.transform='scale('+scale+')';}
    window.addEventListener('resize',resize);resize();
    // A saved snapshot is used only until the TV returns its actual installed list.
    view.apps=Object.keys(window.INICIO_ICONS||{}).filter(function(id){return id!=='org.kagev.inicio';}).map(function(id){var a=INICIO_ICONS[id];return{id:id,title:a.title,icon:a.icon,color:a.color,brand:a.brand};}).sort(function(a,b){return a.title.localeCompare(b.title,'es');});
    view.inputs=readJSON('inicio.inputs')||[{id:'com.webos.app.livetv',title:'TV en vivo',status:'Antena / canales'},1,2,3].map(function(value){return typeof value==='object'?value:{id:'com.webos.app.hdmi'+value,title:'HDMI '+value,status:'Estado sin confirmar'};});
    var weatherSaved=readJSON('inicio.weather.v2');if(weatherSaved&&weatherSaved.data&&weatherSaved.data.current&&weatherSaved.city===prefs.city&&Date.now()-weatherSaved.at<1800000){weatherData=weatherSaved.data;weatherAt=weatherSaved.at;}
    var pickSaved=api.cachedRecommendations();if(pickSaved)view.picks=pickSaved.items;
    $('weatherIcon').innerHTML=glyph('sun');
    renderApps();renderInputs();renderCarousel();renderWeather();clock();focusZone('shelf',0);
    refreshApps();refreshInputs();loadPicks(false);fetchWeather(false);
    setInterval(function(){if(!document.hidden)clock();},30000);
    setInterval(function(){
        if(!document.hidden&&view.page===1&&!view.dialog&&prefs.autoRotate&&view.picks.length&&(!active||active.dataset.zone!=='picks')&&Date.now()-lastInteraction>4000&&Date.now()-lastRotation>prefs.rotation*1000)slide(1,true);
    },1000);
    setInterval(function(){if(!document.hidden)fetchWeather(false);},1800000);
    document.addEventListener('visibilitychange',function(){if(!document.hidden){lastInteraction=Date.now();pendingLaunch=false;clock();fetchWeather(false);loadPicks(false);}});
    // No in-app screensaver: the original LG screensaver remains responsible for idle.
    api.openSettings=openSettings;api.setPage=setPage;api.refreshApps=refreshApps;
})();
