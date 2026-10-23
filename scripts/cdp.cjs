// Connect only through the loopback SSH tunnel. Closing this socket does not close TV apps.
exports.connect = async function(appId) {
 const pages=await(await fetch('http://127.0.0.1:19998/json/list')).json();
 const page=pages.find(p=>p.url.includes('/'+appId+'/'));if(!page)throw Error('Target unavailable: '+appId);
 const u=new URL(page.webSocketDebuggerUrl);u.host='127.0.0.1:19998';
 const ws=new WebSocket(u);let seq=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){const p=pending.get(m.id);clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 const c={send(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(Error('Timeout: '+method));},25000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});},async evaluate(expression){const r=await this.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;},close(){ws.close();}};
 return c;
};
