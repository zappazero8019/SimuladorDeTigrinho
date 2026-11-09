const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 8080;
const ROOT = __dirname;
const MIME = {
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.ico':'image/x-icon',
};
http.createServer((req,res)=>{
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  const file = path.join(ROOT, url);
  if (!file.startsWith(ROOT)) { res.statusCode=403; res.end(); return; }
  fs.readFile(file, (err,data)=>{
    if (err) { res.statusCode=404; res.end('Not found'); return; }
    const ext = path.extname(file).toLowerCase();
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.end(data);
  });
}).listen(PORT, ()=> console.log('Servidor local em http://localhost:'+PORT));
