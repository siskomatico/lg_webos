/* Retail webOS adapters. Shell commands are fixed or contain validated app IDs only. */
(function () {
    'use strict';
    var api = window.Inicio = window.Inicio || {};
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
        return request('luna://com.webos.applicationManager', 'listLaunchPoints', {}).then(function (reply) {
            if (!Array.isArray(reply.launchPoints)) throw new Error('Sin lista');
            return reply.launchPoints;
        }).catch(function () {
            return privilegedRead('com.webos.applicationManager/listApps').then(function (reply) { return reply.apps; });
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
        return request('luna://com.webos.service.eim', 'getAllInputStatus', {}).catch(function () {
            return privilegedRead('com.webos.service.eim/getAllInputStatus');
        }).then(function (reply) {
            if (!Array.isArray(reply.devices)) throw new Error('Sin entradas');
            return [{id:'com.webos.app.livetv',title:'TV en vivo',status:'Antena / canales',connected:null}].concat(reply.devices.filter(function (d) { return d.appId; }).map(function (d) {
                var status=d.hdmiSignalExist===true?'Señal activa':d.hdmiPlugIn===true?'Dispositivo conectado':(d.hdmiSignalExist===false||d.hdmiPlugIn===false)?'Sin señal detectada':d.connected?'Disponible':'Sin conexión';
                return {id:d.appId,title:d.label || ('HDMI ' + d.port),status:status,connected:d.hdmiPlugIn==null?d.connected:d.hdmiPlugIn};
            }));
        });
    };
    api.launch = function (id) {
        if (!/^[a-zA-Z0-9._-]+$/.test(id)) return Promise.reject(new Error('Aplicación inválida'));
        return request('luna://com.webos.applicationManager', 'launch', {id:id});
    };
    api.poweroff = function () {
        // /sbin/poweroff on this TV is a symlink to systemctl. No force, no suspend.
        // ONLY invoked after the separate, explicit confirmation in the UI.
        return request('luna://org.webosbrew.hbchannel.service', 'exec', {command:'/bin/systemctl --no-block poweroff'}).then(function (reply) {
            if (reply.stderrString && /failed|denied|error/i.test(reply.stderrString)) throw new Error('Apagado rechazado');
            return reply;
        });
    };
})();
