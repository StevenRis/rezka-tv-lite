const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const URLBase='https://grimace-hypnotize-anywhere.ngrok-free.dev';
const requests=[];
const fields={};
const saved={'rtl-backend-url':'https://old.trycloudflare.com','rtl-backend-token':'old-token'};
function field(id){return fields[id]||(fields[id]={value:'',textContent:'',disabled:false});}
class XHR {
 open(method,url){this.method=method;this.url=url;this.headers={};requests.push(this);}
 setRequestHeader(k,v){this.headers[k]=v;}
 send(body){this.body=body;}
 respond(status,data){this.status=status;this.responseText=JSON.stringify(data);this.onload();}
}
const context={window:{},XMLHttpRequest:XHR,Date,JSON,Number,String,isFinite,
 document:{createElement(tag){assert.equal(tag,'a');let u;return {set href(v){u=new URL(v);},get protocol(){return u.protocol;},get host(){return u.host;},get username(){return u.username;},get password(){return u.password;},get pathname(){return u.pathname;},get search(){return u.search;},get hash(){return u.hash;}};}},
 localStorage:{getItem:k=>saved[k]||null,setItem:(k,v)=>{saved[k]=v;}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../notebook.js','utf8'),context);
const notebook=context.window.Notebook;
notebook.init({el:field,text:(id,v)=>field(id).textContent=v,collect(){},show(){},getPage(){return 'notebook';}});
notebook.screen();
requests.pop().respond(200,{url:URLBase});
assert.equal(field('backend-url').value,URLBase);
assert.equal(saved['rtl-backend-token'],'');
field('backend-code').value='123456';
notebook.pair();
const pair=requests.pop();
assert.equal(pair.url,URLBase+'/api/pair');
assert.equal(pair.headers['ngrok-skip-browser-warning'],'1');
assert.equal(pair.headers['X-Rezka-Test'],undefined);
pair.respond(200,{access_token:'t'.repeat(43)});
assert.equal(saved['rtl-backend-token'],'t'.repeat(43));
assert.equal(field('backend-code').value,'');
notebook.movie('https://rezka.ag/films/drama/123-test.html');
const movie=requests.pop();
assert.equal(movie.headers['X-Rezka-Test'],'t'.repeat(43));
assert.equal(movie.headers['ngrok-skip-browser-warning'],'1');
movie.respond(401,{error:'Подключите ноутбук заново.'});
assert.equal(saved['rtl-backend-token'],'');
for(const invalid of ['https://evil.test','https://host.ngrok-free.dev.evil.test','https://user:pass@host.ngrok-free.dev','http://host.ngrok-free.dev',URLBase+'/path',URLBase+'?token=x',URLBase+'#x']) {
 field('backend-url').value=invalid;field('backend-code').value='123456';
 const count=requests.length;notebook.pair();assert.equal(requests.length,count,invalid);
}
field('backend-url').value='https://legacy.trycloudflare.com';notebook.pair();
assert.equal(requests.pop().headers['ngrok-skip-browser-warning'],undefined);
console.log('PASS: ngrok migration, pairing, API headers, stale session, URL rejection, Cloudflare compatibility');
