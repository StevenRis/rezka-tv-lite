(function(root){
 'use strict';
 var sdk,base='',token='',sources=[],sourceIndex=0,generation=0;
 function el(id){return sdk.el(id);}
 function text(id,value){sdk.text(id,value);}
 function validBase(value){var a=document.createElement('a');a.href=value;return a.protocol==='https:'&&/^[a-z0-9-]+\.trycloudflare\.com$/.test(a.host)&&!a.username&&!a.password&&(a.pathname==='/'||a.pathname==='')&&!a.search&&!a.hash;}
 function save(){try{localStorage.setItem('rtl-backend-url',base);localStorage.setItem('rtl-backend-token',token);}catch(ignore){}}
 function request(path,body,secret,done){
  var xhr=new XMLHttpRequest();xhr.open('POST',base+path,true);xhr.timeout=65000;
  xhr.setRequestHeader('Content-Type','application/json');if(secret){xhr.setRequestHeader('X-Rezka-Test',secret);}
  xhr.onload=function(){var data;try{data=JSON.parse(xhr.responseText);}catch(ignore){done('Ответ backend не распознан.');return;}if(xhr.status!==200){done(data.error||('HTTP '+xhr.status),null,xhr.status);return;}done(null,data);};
  xhr.onerror=function(){done('Нет связи с ноутбуком. Проверь, что backend и туннель запущены.');};
  xhr.ontimeout=function(){done('Backend не ответил за 65 секунд. Попробуй ещё раз.');};
  try{xhr.send(JSON.stringify(body));}catch(ignore){done('Не удалось отправить запрос.');}
 }
 function screen(){
  el('backend-url').value=base;
  text('notebook-status',token?'Ноутбук подключён для этого запуска. Можно открыть «Одиссею».':'Введи адрес backend и шестизначный код с экрана ноутбука.');
  {var xhr=new XMLHttpRequest();xhr.open('GET','backend.json?_='+new Date().getTime(),true);xhr.timeout=10000;xhr.onload=function(){try{var data=JSON.parse(xhr.responseText);if(data.url&&validBase(data.url)&&data.url.replace(/\/$/,'')!==base&&(el('backend-url').value===base||!el('backend-url').value)){base=data.url.replace(/\/$/,'');token='';save();el('backend-url').value=base;text('notebook-status','Адрес backend обновлён. Введи новый код с ноутбука.');}}catch(ignore){}};try{xhr.send(null);}catch(ignore){}}
 }
 function pair(){
  var value=el('backend-url').value.replace(/^\s+|\s+$/g,'').replace(/\/$/,'');
  var code=el('backend-code').value.replace(/\s/g,'');
  if(!validBase(value)){text('notebook-status','Нужен HTTPS-адрес вида https://название.trycloudflare.com с экрана ноутбука.');return;}
  if(!/^[0-9]{6}$/.test(code)){text('notebook-status','Введи шесть цифр кода с экрана ноутбука.');return;}
  base=value;text('notebook-status','Подключаю ноутбук…');el('pair-button').disabled=true;
  request('/api/pair',{code:code},'',function(error,data){el('pair-button').disabled=false;
   if(error){text('notebook-status',error);return;}
   if(!data||typeof data.access_token!=='string'||data.access_token.length<32){text('notebook-status','Некорректный ответ подключения.');return;}
   token=data.access_token;save();el('backend-code').value='';text('notebook-status','Ноутбук подключён. Выбери «Запустить Одиссею» или открой её в каталоге.');sdk.collect();
  });
 }
 function prepareTest(){generation++;Notebook.active=false;sdk.player.pause();sdk.player.removeAttribute('src');sdk.player.load();el('test-controls').hidden=false;el('movie-controls').hidden=true;text('video-title','Тест HTML5-видео');}
 function selectSource(index){
  sourceIndex=index%sources.length;var source=sources[sourceIndex];
  sdk.player.pause();sdk.player.src=source.url;sdk.player.load();
  text('media-status','«Одиссея» · '+source.label+'. Нажми 5 на «Пуск / пауза» или треугольник на видео.');
  text('movie-quality','Качество: '+source.label);sdk.collect();
 }
 function movie(){
  if(!base||!token){sdk.show('notebook');return;}
  var current=++generation;Notebook.active=true;sources=[];sdk.player.pause();sdk.player.removeAttribute('src');sdk.player.load();
  el('test-controls').hidden=true;el('movie-controls').hidden=false;text('video-title','Одиссея · источник с ноутбука');text('movie-quality','Запрашиваю источник…');sdk.show('video');text('media-status','Получаю видео с помощью ноутбука…');
  request('/api/resolve',{id:'85038'},token,function(error,data,status){
   if(current!==generation||!Notebook.active||!sdk.isVideo()){return;}
   if(error){text('media-status',error);if(status===401){token='';save();}return;}
   var incoming=data.sources||[],i,a,source;
   for(i=0;i<incoming.length&&sources.length<16;i++){source=incoming[i];if(!source||typeof source.url!=='string'||typeof source.label!=='string'){continue;}a=document.createElement('a');a.href=source.url;if((a.protocol==='https:'||a.protocol==='http:')&&!a.username&&!a.password){sources.push(source);}}
   if(!sources.length){text('media-status',data.report&&data.report.message?data.report.message:'Источник не найден.');text('movie-quality','Качество недоступно');return;}
   var chosen=-1;for(i=0;i<sources.length;i++){if(sources[i].kind==='MP4'&&sources[i].quality==='480p'){chosen=i;break;}}
   if(chosen<0){for(i=0;i<sources.length;i++){if(sources[i].kind==='MP4'){chosen=i;break;}}}
   selectSource(chosen<0?0:chosen);
  });
 }
 var Notebook={active:false,init:function(api){sdk=api;try{var url=localStorage.getItem('rtl-backend-url')||'';if(validBase(url)){base=url;token=localStorage.getItem('rtl-backend-token')||'';}}catch(ignore){}},screen:screen,pair:pair,movie:movie,prepareTest:prepareTest,nextQuality:function(){if(sources.length){selectSource(sourceIndex+1);}},isOdyssey:function(url){return typeof url==='string'&&/^https:\/\/rezka\.ag\/films\/fantasy\/85038-/.test(url);}};
 root.Notebook=Notebook;
}(window));
