const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const fields={},requests=[],events={};let page='home';
class Element{
 constructor(){this.children=[];this.value='';this.disabled=false;this.hidden=false;}
 set textContent(v){this.text=v;this.children=[];}
 get textContent(){return this.text||'';}
 appendChild(v){this.children.push(v);}
 setAttribute(k,v){this[k]=v;}
 get firstChild(){return this.children[0];}
 focus(){}
}
function el(id){return fields[id]||(fields[id]=new Element());}
const player={currentTime:0,duration:500,src:'',pause(){},load(){this.currentTime=0;},addEventListener:(n,f)=>events[n]=f,removeEventListener:n=>delete events[n],removeAttribute(){}};
class XHR{open(method,url){this.url=url;this.headers={};requests.push(this);}setRequestHeader(k,v){this.headers[k]=v;}send(v){this.body=JSON.parse(v);}respond(data){this.status=200;this.responseText=JSON.stringify(data);this.onload();}}
const context={window:{},XMLHttpRequest:XHR,Date,JSON,Number,String,isFinite,document:{createElement(tag){if(tag!=='a')return new Element();let u;return {set href(v){u=new URL(v);},get protocol(){return u.protocol;},get username(){return u.username;},get password(){return u.password;},get host(){return u.host;},get pathname(){return u.pathname;},get search(){return u.search;},get hash(){return u.hash;}};}},localStorage:{getItem:k=>({'rtl-backend-url':'https://test.ngrok-free.dev','rtl-backend-token':'t'.repeat(43)})[k]||null,setItem(){}}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../notebook.js','utf8'),context);
const n=context.window.Notebook;n.init({el,text:(id,v)=>el(id).textContent=v,show:v=>{page=v;},getPage:()=>page,collect(){},player,isVideo:()=>page==='video'});
const url='https://rezka.ag/series/thriller/123-test.html';
const movie={url,title:'Тестовый сериал',type:'series',translators:[{id:'20',name:'Дубляж',default:true},{id:'30',name:'Другая'},{id:'40',name:'Платная',premium:true}]};
const seasons=[{id:'1',title:'Сезон 1',episodes:[{id:'1',title:'Серия 1'},{id:'2',title:'Серия 2'}]},{id:'2',title:'Сезон 2',episodes:[{id:'1',title:'Серия 1'}]}];
function take(route){let r=requests.shift();assert.ok(r);assert.ok(r.url.endsWith(route),r.url);return r;}
function resolveReply(){return {movie,selected_translation:'20',sources:[{url:'https://cdn.example.invalid/2160.mp4',label:'2160p MP4',quality:'2160p',resolution:2160,kind:'MP4'},{url:'https://cdn.example.invalid/720.mp4',label:'720p MP4',quality:'720p',resolution:720,kind:'MP4'}]};}
assert.equal(n.isMovie(url),true);assert.equal(n.isMovie(url.replace('/series/','/animation/')),true);
n.movie(url);take('/api/movie').respond({movie});take('/api/episodes').respond({seasons});
assert.equal(el('movie-episodes').hidden,false);assert.equal(el('movie-play').disabled,true);assert.equal(requests.length,0);
n.seasons();assert.equal(page,'seasons');assert.equal(el('season-list').children.length,2);
n.selectSeason(1);assert.equal(page,'episodes');assert.equal(el('episode-list').children.length,1);
n.selectEpisode(0);let r=take('/api/resolve');assert.equal(r.body.season,'2');assert.equal(r.body.episode,'1');assert.equal(r.body.translator_id,'20');r.respond(resolveReply());
assert.equal(el('movie-play').disabled,false);assert.match(el('movie-episode-label').textContent,/Сезон 2/);
n.playSelected();assert.equal(page,'video');assert.match(el('video-title').textContent,/серия 1/);assert.equal(el('video-episodes').hidden,false);events.loadedmetadata();
player.currentTime=125;n.qualities();n.selectQuality(1);events.loadedmetadata();assert.equal(player.currentTime,125);
n.seasons();n.selectSeason(0);n.selectEpisode(1);r=take('/api/resolve');assert.equal(r.body.season,'1');assert.equal(r.body.episode,'2');r.respond(resolveReply());n.playSelected();events.loadedmetadata();assert.equal(player.currentTime,0);
n.voices();n.selectVoice(2);assert.equal(requests.length,0);assert.equal(page,'voices');
n.selectVoice(1);r=take('/api/episodes');assert.equal(r.body.translator_id,'30');r.respond({seasons});
assert.equal(el('movie-play').disabled,true);assert.equal(el('movie-episode-label').textContent,'');assert.equal(n.active,false);
n.seasons();n.selectSeason(0);n.selectEpisode(0);assert.equal(take('/api/resolve').body.translator_id,'30');
console.log('PASS: series metadata, seasons, episodes, correct stream coordinates, quality resume, episode reset, premium protection, voice-specific list request');
