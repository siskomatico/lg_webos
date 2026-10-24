/* Retail webOS adapters. Shell commands are fixed or contain validated app IDs only. */
(function () {
    'use strict';
    var api = window.Inicio = window.Inicio || {};
    var rootEnabled=INICIO_CONFIG.installMode!=='noroot';
    api.capabilities={rootEnabled:rootEnabled,catalog:'system',inputs:'system'};
    function manualApps(){
        api.capabilities.catalog='manual';
        return (Array.isArray(INICIO_CONFIG.apps)?INICIO_CONFIG.apps:[]).filter(function(a){return a&&typeof a.id==='string'&&/^[a-zA-Z0-9._-]+$/.test(a.id);}).map(function(a){return {id:a.id,title:a.title||a.id,icon:a.icon||'',iconColor:a.color,visible:true};});
    }
    function manualInputs(){
        api.capabilities.inputs='manual';
        var list=Array.isArray(INICIO_CONFIG.inputs)?INICIO_CONFIG.inputs:[1,2,3].map(function(n){return {id:'com.webos.app.hdmi'+n,title:'HDMI '+n};});
        return {manual:true,devices:list.filter(function(a){return a&&/^com\.webos\.app\.hdmi\d+$/.test(a.id);}).map(function(a){return {appId:a.id,label:a.title||a.id};})};
    }
    function request(service, method, params) {
        return new Promise(function (resolve, reject) {
            var settled = false;
            var timer = setTimeout(function () { done(false, new Error('La TV no responde')); }, 12000);
            function done(ok, value) {
                if (settled) return;
                settled = true; clearTimeout(timer);
                if (ok) resolve(value); else reject(value);
            }
            if (!window.webOS || !webOS.service) { done(false, new Error('Solo disponible en la TV')); return; }
            try {
                webOS.service.request(service, {
                    method: method, parameters: params || {},
                    onSuccess: function (reply) { done(!reply || reply.returnValue !== false, reply); },
                    onFailure: function (error) { done(false, error); }
                });
            } catch (error) { done(false, error); }
        });
    }
    function quote(value) { return "'" + value.replace(/'/g, "'\\''") + "'"; }
    function privilegedRead(uri) {
        if(!rootEnabled)return Promise.reject(new Error('Esta instalación no utiliza root'));
        // No arbitrary API or shell command can enter this path.
        if (['com.webos.applicationManager/listApps', 'com.webos.service.eim/getAllInputStatus'].indexOf(uri) < 0) return Promise.reject(new Error('Método no permitido'));
        var command = 'script -q -c ' + quote('luna-send -n 1 luna://' + uri + " '{}'") + ' /dev/null';
        return request('luna://org.webosbrew.hbchannel.service', 'exec', {command: command}).then(function (reply) {
            var value = JSON.parse(reply.stdoutString || reply.stdout || '');
            if (value.returnValue === false) throw new Error('Consulta rechazada');
            return value;
        });
    }
    api.getApps = function () {
        api.capabilities.catalog='system';
        return request('luna://com.webos.applicationManager', 'listLaunchPoints', {}).then(function (reply) {
            if (!Array.isArray(reply.launchPoints)) throw new Error('Sin lista');
            return reply.launchPoints;
        }).catch(function () {
            return request('luna://com.webos.applicationManager','listApps',{}).then(function(reply){
                if(!Array.isArray(reply.apps))throw new Error('Sin lista');return reply.apps;
            }).catch(function(){
                if(!rootEnabled)return manualApps();
                return privilegedRead('com.webos.applicationManager/listApps').then(function(reply){return reply.apps;});
            });
        }).then(function (list) {
            if (!Array.isArray(list)) throw new Error('Lista de aplicaciones inválida');
            var seen = {};
            return list.filter(function (app) {
                var id = app.appId || app.id;
                if (!id || seen[id] || id === 'org.kagev.inicio' || app.visible === false || app.isHidden) return false;
                if (/^com\.webos\.(service\.|app\.(home$|livetv$|hdmi\d$|screensaver$))/.test(id)) return false;
                seen[id] = true; return true;
            }).map(function (app) {
                var id = app.appId || app.id, bundled = (window.INICIO_ICONS || {})[id];
                var icon = app.extraLargeIcon || app.largeIcon || app.icon || '';
                if (icon && !/^(file:|https?:|data:image\/)/i.test(icon)) icon = 'file://' + (icon.charAt(0) === '/' ? icon : (app.folderPath || '').replace(/\/$/, '') + '/' + icon);
                return {id:id, title:app.title || id, icon:bundled ? bundled.icon : icon, color:(bundled && bundled.color) || app.iconColor || '#24252b',brand:!!(bundled && bundled.brand)};
            }).sort(function (a,b) { return a.title.localeCompare(b.title, 'es'); });
        });
    };
    api.getInputs = function () {
        api.capabilities.inputs='system';
        return request('luna://com.webos.service.eim', 'getAllInputStatus', {}).catch(function () {
            return rootEnabled?privilegedRead('com.webos.service.eim/getAllInputStatus'):manualInputs();
        }).then(function (reply) {
            if (!Array.isArray(reply.devices)) throw new Error('Sin entradas');
            return [{id:'com.webos.app.livetv',title:'TV en vivo',status:'Antena / canales',connected:null}].concat(reply.devices.filter(function (d) { return d.appId; }).map(function (d) {
                var status=reply.manual?'Acceso manual · Estado sin confirmar':d.hdmiSignalExist===true?'Señal activa':d.hdmiPlugIn===true?'Dispositivo conectado':(d.hdmiSignalExist===false||d.hdmiPlugIn===false)?'Sin señal detectada':d.connected?'Disponible':'Sin conexión';
                return {id:d.appId,title:d.label || ('HDMI ' + d.port),status:status,connected:d.hdmiPlugIn==null?d.connected:d.hdmiPlugIn};
            }));
        });
    };
    api.launch = function (id) {
        if (!/^[a-zA-Z0-9._-]+$/.test(id)) return Promise.reject(new Error('Aplicación inválida'));
        return request('luna://com.webos.applicationManager', 'launch', {id:id});
    };
    api.poweroff = function () {
        if(!rootEnabled)return Promise.reject(new Error('El apagado completo requiere Homebrew con root'));
        // /sbin/poweroff on this TV is a symlink to systemctl. No force, no suspend.
        // ONLY invoked after the separate, explicit confirmation in the UI.
        return request('luna://org.webosbrew.hbchannel.service', 'exec', {command:'/bin/systemctl --no-block poweroff'}).then(function (reply) {
            if (reply.stderrString && /failed|denied|error/i.test(reply.stderrString)) throw new Error('Apagado rechazado');
            return reply;
        });
    };
})();
