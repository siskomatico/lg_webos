// Local HTTP fixture: stable origin for storage tests across Chromium/OS versions.
// Never serves the user's real private-config.js or files outside the generated app.
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
exports.start=async function(directory){
 const root=path.resolve(directory);
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
 const server=http.createServer(async(req,res)=>{
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const filename=path.resolve(root,'.'+pathname);
   if(!filename.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   res.setHeader('Cache-Control','no-store');
   res.setHeader('Content-Type',types[path.extname(filename)]||'application/octet-stream');
   if(filename===path.join(root,'private-config.js')){res.end('window.INICIO_CONFIG = {};');return;}
   res.end(await fs.readFile(filename));
  }catch(error){res.writeHead(404);res.end();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {url:'http://127.0.0.1:'+server.address().port,close(){return new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}};
};
