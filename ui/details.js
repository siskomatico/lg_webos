/* Rich detail views: DOM/text only, bounded images and no blur/compositor loops. */
(function(){
 'use strict';
 var api=window.Inicio,epoch=0;
 function node(tag,cls,value,parent){var n=document.createElement(tag);if(cls)n.className=cls;if(value!==undefined)n.textContent=value;if(parent)parent.appendChild(n);return n;}
 function finite(n){return typeof n==='number'&&isFinite(n);}
 function temperature(n,unit){return finite(n)?Math.round(unit==='F'?n*9/5+32:n)+'°'+unit:'—';}
 function layout(kind){
  var dialog=document.getElementById('dialog'),list=document.getElementById('dialogList');
  dialog.classList.add('detailPanel','detailPanel--'+kind);
  var footer=node('div','detailActions');
  Array.prototype.slice.call(list.children).forEach(function(b){footer.appendChild(b);});
  var body=node('div','detailBody');list.appendChild(body);list.appendChild(footer);
  var selected=footer.querySelector('.focused');if(selected){try{selected.focus({preventScroll:true});}catch(error){selected.focus();}}
  return body;
 }
 function chip(parent,value,cls){return node('span',cls||'detailChip',value,parent);}
 function current(id){return document.getElementById(id);}
 api.details={
  openPick:function(item,hooks,selected){
   var ticket=++epoch;
   hooks.dialog('pick',item.title,[{label:'Volver al carrusel',run:hooks.close},{label:'← Anterior',run:function(){hooks.neighbor(item,-1);}},{label:'Siguiente →',run:function(){hooks.neighbor(item,1);}}],'← → elige una acción · ↑ ↓ lee la sinopsis · Atrás vuelve al carrusel',selected);
   var body=layout('pick'),art=node('div','detailArtwork','',body),image=node('img','','',art);
   var fellBack=false;image.alt='';image.src=item.poster||item.image;image.onerror=function(){if(!fellBack&&item.image){fellBack=true;image.src=item.image;}else image.hidden=true;};
   node('div','detailArtworkShade','',art);chip(art,item.type==='movie'?'CINE':'SERIES','detailArtLabel');
   var info=node('div','pickInformation','',body);
   node('p','detailEyebrow','TU PRÓXIMA HISTORIA',info);
   node('h2','pickTitleLarge',item.title,info);
   var facts=node('div','detailFacts','',info);
   chip(facts,item.type==='movie'?'Película':'Serie');
   if(finite(item.rating)&&item.rating>0)chip(facts,'★ '+item.rating.toFixed(1).replace('.',',')+' / 10 · TMDB','detailChip detailRating');
   var extra=node('span','detailExtra','',facts);
   if(item.year)chip(extra,item.year);
   var genres=node('p','detailGenres','Información adicional…',info);
   var scroll=node('div','synopsisScroll','',info);scroll.id='detailScroll';
   node('h3','detailSectionTitle','La historia',scroll);node('p','detailSynopsis',item.overview||'Sin sinopsis disponible en español.',scroll);
   var cast=node('p','detailCast','',scroll);cast.hidden=true;
   var offers=node('section','detailOffers','',info);
   var rental=(item.providers||'').indexOf('Alquiler / compra:')===0;
   node('h3','detailSectionTitle',item.confirmed===false?'Disponibilidad sin confirmar':rental?'Alquiler o compra en España':'Dónde verla en España',offers);
   var platforms=node('div','detailPlatforms','',offers);
   if(item.confirmed===false)node('p','detailMuted','No hay datos confirmados para este título.',platforms);
   else (item.providers||'').replace(/^Alquiler \/ compra: /,'').split(' · ').filter(Boolean).forEach(function(name){chip(platforms,name,'platformChip');});
   node('p','detailAttribution','TMDB / JustWatch · Puede requerir suscripción, alquiler o compra. No comprueba tus cuentas.',offers);
   api.loadPickDetails(item).then(function(data){
    if(ticket!==epoch||api.view.dialog!=='pick')return;
    extra.innerHTML='';
    if(data.year)chip(extra,data.year);
    if(data.runtime)chip(extra,data.runtime+' min');
    if(data.seasons)chip(extra,data.seasons+' temporada'+(data.seasons===1?'':'s'));
    var labels={'Action & Adventure':'Acción y aventura','Sci-Fi & Fantasy':'Ciencia ficción y fantasía','Kids':'Infantil','Soap':'Telenovela','Talk':'Entrevistas','War & Politics':'Guerra y política','Reality':'Telerrealidad','News':'Noticias'};
    genres.textContent=data.genres.length?data.genres.map(function(g){return labels[g]||g;}).join(' · '):'Sin géneros disponibles';
    if(data.cast.length){cast.textContent='Reparto · '+data.cast.join(' · ');cast.hidden=false;}
    if(data.poster){image.src=data.poster;image.hidden=false;}
   }).catch(function(){if(ticket===epoch&&api.view.dialog==='pick')genres.textContent='Ficha ampliada no disponible · Se muestra la información guardada';});
  },
  openWeather:function(hooks){
   ++epoch;
   hooks.dialog('weather','El tiempo en '+hooks.weather().city,[{label:'Volver al inicio',run:hooks.close},{label:'Actualizar el tiempo',run:function(){var status=current('weatherDetailStatus');if(status)status.textContent='Actualizando…';hooks.refreshWeather();}}],'↑ ↓ desplaza la previsión · ← → elige una acción · Datos: Open-Meteo');
   var body=layout('weather');body.id='detailScroll';body.classList.add('weatherDetailScroll');
   api.details.updateWeather(hooks);
  },
  updateWeather:function(hooks){
   if(api.view.dialog!=='weather')return;
   var body=current('detailScroll');if(!body)return;
   var top=body.scrollTop;body.innerHTML='';
   var state=hooks.weather(),data=state.data,unit=state.unit;
   var head=node('div','weatherDetailHeading','',body);
   node('p','detailEyebrow','PLANIFICA TU DÍA',head);
   var stamp=node('span','detailMuted',state.stale?'Datos guardados · Sin actualizar':state.at?'Actualizado a las '+new Date(state.at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}):'Consultando la previsión…',head);stamp.id='weatherDetailStatus';
   if(!data||!data.current){node('p','detailEmpty','Todavía no hay datos. Puedes reintentar con «Actualizar el tiempo».',body);return;}
   var c=data.current,hero=node('div','weatherHero','',body),now=node('div','weatherNow','',hero);
   var icon=node('span','weatherBigIcon','',now);icon.innerHTML=hooks.glyph(hooks.weatherGlyph(c.weather_code,c.is_day));
   var summary=node('div','weatherSummary','',now);
   node('strong','weatherBigTemperature',temperature(c.temperature_2m,unit),summary);
   node('p','weatherCondition',hooks.weatherLabel(c.weather_code),summary);
   node('span','detailMuted',state.city,summary);
   var stats=node('div','weatherStats','',hero),daily=data.daily||{},hourly=data.hourly||{};
   function metric(label,value){var card=node('div','weatherMetric','',stats);node('span','metricLabel',label,card);node('strong','metricValue',value,card);}
   metric('Sensación',temperature(c.apparent_temperature,unit));
   metric('Humedad',finite(c.relative_humidity_2m)?Math.round(c.relative_humidity_2m)+' %':'—');
   metric('Viento',finite(c.wind_speed_10m)?Math.round(c.wind_speed_10m)+' km/h':'—');
   function localTime(v){return typeof v==='string'&&v.indexOf('T')>=0?v.split('T')[1].slice(0,5):'—';}
   metric('Amanecer / atardecer',localTime((daily.sunrise||[])[0])+' / '+localTime((daily.sunset||[])[0]));
   var hours=node('section','weatherHours','',body);node('h3','detailSectionTitle','Las próximas horas',hours);
   var strip=node('div','hourlyStrip','',hours),times=Array.isArray(hourly.time)?hourly.time:[],key=c.time||'';
   var start=key?times.findIndex(function(t){return t>=key;}):-1;
   if(start>=0)times.slice(start,start+6).forEach(function(t,i){
    var index=start+i,card=node('div','hourCard','',strip);node('span','hourLabel',localTime(t),card);
    var mark=node('span','forecastIcon','',card);mark.innerHTML=hooks.glyph(hooks.weatherGlyph((hourly.weather_code||[])[index],(hourly.is_day||[])[index]));
    node('strong','hourTemperature',temperature((hourly.temperature_2m||[])[index],unit),card);
    var rain=(hourly.precipitation_probability||[])[index];node('span','hourRain',finite(rain)?Math.round(rain)+' % lluvia':'Sin dato de lluvia',card);
   });else node('p','detailMuted','Previsión horaria no disponible en los datos guardados.',strip);
   var days=node('section','weatherDays','',body);node('h3','detailSectionTitle','Los próximos días',days);
   var grid=node('div','dailyGrid','',days);
   (daily.time||[]).slice(0,5).forEach(function(date,i){
    var card=node('div','dayCard','',grid),label=i===0?'Hoy':i===1?'Mañana':new Date(date+'T12:00:00').toLocaleDateString('es-ES',{weekday:'long'});
    node('span','dayLabel',label,card);
    var mark=node('span','forecastIcon','',card);mark.innerHTML=hooks.glyph(hooks.weatherGlyph((daily.weather_code||[])[i],1));
    node('strong','dayTemperature',temperature((daily.temperature_2m_max||[])[i],unit)+' / '+temperature((daily.temperature_2m_min||[])[i],unit),card);
    var rain=(daily.precipitation_probability_max||[])[i];node('span','hourRain',finite(rain)?'Lluvia '+Math.round(rain)+' %':'Lluvia sin confirmar',card);
   });
   if(!(daily.time||[]).length)node('p','detailMuted','Previsión diaria no disponible.',grid);
   body.scrollTop=top;
  }
 };
})();
