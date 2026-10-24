/* Recommendations use TMDB's ES watch-provider data, not guessed platform names. */
(function () {
    'use strict';
    var api = window.Inicio, key = INICIO_CONFIG.tmdbKey || '', inflight = null;
    var cacheKey = 'inicio.recommendations.v2';
    function json(url, authenticated) {
        var controller = typeof AbortController === 'function' ? new AbortController() : null;
        var timeout;
        var headers = authenticated && key.length > 40 ? {Authorization:'Bearer ' + key} : {};
        if (authenticated && key.length <= 40) url += '&api_key=' + encodeURIComponent(key);
        var network = fetch(url, {headers:headers,signal:controller ? controller.signal : undefined}).then(function (reply) {
            if (!reply.ok) throw new Error('No se pudo consultar el servicio');
            return reply.json();
        });
        var deadline = new Promise(function (_,reject) { timeout=setTimeout(function () { if(controller)controller.abort();reject(new Error('Tiempo de espera agotado')); },12000); });
        return Promise.race([network,deadline]).then(function (data) { clearTimeout(timeout);return data; },function (error) { clearTimeout(timeout);throw error; });
    }
    api.fetchJSON = function (url) { return json(url, false); };
    function tmdb(path) { return json('https://api.themoviedb.org/3/' + path + (path.indexOf('?') < 0 ? '?' : '&') + 'language=es-ES',true); }
    function formatNames(raw,prefix) {
        var names=[];
        raw.forEach(function(name){var label=name.replace(/^Amazon Prime Video/,'Prime Video').replace(/ Standard with Ads$/,' (con anuncios)').replace(/ with Ads$/,' (con anuncios)').replace(/ Amazon Channel$/,' (canal de Amazon)');if(names.indexOf(label)<0)names.push(label);});
        names=names.filter(function(name){var base=name.replace(/ \((con anuncios|canal de Amazon)\)$/,'');return base===name||names.indexOf(base)<0;});
        return names.length ? (prefix||'')+names.slice(0,4).join(' · ')+(names.length>4?' · +'+(names.length-4):'') : 'Disponibilidad en España no confirmada';
    }
    api.cachedRecommendations = function () {
        try {
            var cached=JSON.parse(localStorage.getItem(cacheKey));
            if(cached && cached.fingerprint===key.slice(-8) && Array.isArray(cached.items) && cached.items.length>=16 && cached.items.every(function(i){return i&&typeof i.title==='string'&&typeof i.image==='string'&&(i.type==='movie'||i.type==='tv')&&typeof i.providers==='string';}) && Date.now()-cached.at<7*86400000) {
                cached.items.forEach(function(i){if(Array.isArray(i.providerNames))i.providers=formatNames(i.providerNames,i.providers.indexOf('Alquiler / compra:')===0?'Alquiler / compra: ':'');});
                return cached;
            }
        } catch(error) {}
        return null;
    };
    api.loadPickDetails = function(item) {
        if(['movie','tv'].indexOf(item.type)<0||!/^\d+$/.test(String(item.id)))return Promise.reject(new Error('Título inválido'));
        var storage='inicio.detail.'+item.type+'.'+item.id,cached;
        try{cached=JSON.parse(localStorage.getItem(storage));if(cached&&cached.data&&Array.isArray(cached.data.genres)&&Array.isArray(cached.data.cast)&&Date.now()-cached.at<86400000)return Promise.resolve(cached.data);}catch(error){}
        return tmdb(item.type+'/'+item.id+'?append_to_response=credits').then(function(data){
            var result={year:(data.release_date||data.first_air_date||'').slice(0,4),runtime:item.type==='movie'?data.runtime:null,
                seasons:item.type==='tv'?data.number_of_seasons:null,
                poster:data.poster_path?'https://image.tmdb.org/t/p/w500'+data.poster_path:null,
                genres:(data.genres||[]).map(function(g){return g.name;}).filter(Boolean),
                cast:((data.credits||{}).cast||[]).slice(0,6).map(function(c){return c.name;}).filter(Boolean)};
            try{localStorage.setItem(storage,JSON.stringify({at:Date.now(),data:result}));}catch(error){}
            return result;
        });
    };
    function providers(result) {
        var es=result.results && result.results.ES;
        if(!es)return {text:'Disponibilidad en España no confirmada',names:[],confirmed:false};
        var list=(es.flatrate||[]).concat(es.free||[],es.ads||[]),prefix='';
        if(!list.length) { list=(es.rent||[]).concat(es.buy||[]);prefix='Alquiler / compra: '; }
        var names=[];
        list.forEach(function(p) { if(p.provider_name && names.indexOf(p.provider_name)<0)names.push(p.provider_name); });
        return {text:formatNames(names,prefix),names:names,confirmed:!!names.length};
    }
    function mapPool(list, worker) {
        var next=0,out=new Array(list.length);
        function run() { var i=next++;if(i>=list.length)return Promise.resolve();return worker(list[i]).then(function(v){out[i]=v;}).then(run); }
        return Promise.all([run(),run(),run(),run()]).then(function(){return out;});
    }
    api.loadRecommendations = function (force) {
        var cached=api.cachedRecommendations();
        if(!force && cached && Date.now()-cached.at<6*3600000)return Promise.resolve({items:cached.items,cached:true});
        if(inflight)return inflight;
        if(!key)return Promise.reject(new Error('Falta la configuración de TMDB'));
        var query='?watch_region=ES&with_watch_monetization_types=flatrate%7Cfree%7Cads&sort_by=popularity.desc&include_adult=false';
        inflight=Promise.all([tmdb('discover/movie'+query),tmdb('discover/tv'+query)]).then(function(results){
            var movies=(results[0].results||[]).filter(function(i){return i.backdrop_path||i.poster_path;}).slice(0,10).map(function(i){return {raw:i,type:'movie'};});
            var shows=(results[1].results||[]).filter(function(i){return i.backdrop_path||i.poster_path;}).slice(0,6).map(function(i){return {raw:i,type:'tv'};});
            if(movies.length<10 || shows.length<6)throw new Error('No hay suficientes recomendaciones disponibles');
            var mixed=[];
            for(var i=0;i<10;i++){mixed.push(movies[i]);if(i<shows.length)mixed.push(shows[i]);}
            return mapPool(mixed,function(entry){
                return tmdb(entry.type+'/'+entry.raw.id+'/watch/providers').then(providers).catch(function(){return {text:'Disponibilidad en España no confirmada',names:[],confirmed:false};}).then(function(p){
                    var item=entry.raw;
                    return {id:item.id,type:entry.type,title:item.title||item.name||item.original_title||item.original_name,
                        overview:item.overview||'Sin sinopsis en español.',rating:item.vote_average,
                        year:(item.release_date||item.first_air_date||'').slice(0,4),poster:item.poster_path?'https://image.tmdb.org/t/p/w500'+item.poster_path:null,
                        image:'https://image.tmdb.org/t/p/w780'+(item.backdrop_path||item.poster_path),
                        providers:p.text,providerNames:p.names,confirmed:p.confirmed};
                });
            });
        }).then(function(items){
            try{localStorage.setItem(cacheKey,JSON.stringify({at:Date.now(),fingerprint:key.slice(-8),items:items}));}catch(error){}
            inflight=null;return {items:items,cached:false};
        },function(error){inflight=null;if(cached)return {items:cached.items,cached:true,stale:true};throw error;});
        return inflight;
    };
})();
