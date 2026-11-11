(function(root){
 'use strict';
 var sdk,base='',token='',sources=[],premiumQualities=[],sourceIndex=0,generation=0,busy=false;
 var currentURL='',movieData=null,voiceId='',movieMessage='',resumeAt=0,loadedKey='',seekHandler=null;
 var seasonsData=[],seasonId='',episodeId='',episodeVoice='',pendingSeason='';
 var prefs={voice:'',quality:'best'};
 var SAMPLE='https://rezka.ag/films/fantasy/85038-odisseya-2026-latest.html';
 function el(id){return sdk.el(id);}
 function text(id,value){sdk.text(id,value);}
 function safe(value){return String(value||'').replace(/https?:\/\/[^\s"']+/g,'[ссылка]');}
 function validBase(value){var a=document.createElement('a');a.href=value;return a.protocol==='https:'&&/^[a-z0-9-]+\.(trycloudflare\.com|ngrok-free\.(dev|app))$/.test(a.host)&&!a.username&&!a.password&&(a.pathname==='/'||a.pathname==='')&&!a.search&&!a.hash;}
 function isMovie(url){return typeof url==='string'&&/^https:\/\/rezka\.ag\/(films|series|cartoons|animation)\/[a-z0-9-]+\/\d+-[^\s/?#]+\.html$/.test(url);}
 function save(){try{localStorage.setItem('rtl-backend-url',base);localStorage.setItem('rtl-backend-token',token);localStorage.setItem('rtl-movie-prefs',JSON.stringify(prefs));}catch(ignore){}}
 function connected(){return !!(base&&token);}
 function request(path,body,secret,done){
  var xhr=new XMLHttpRequest();xhr.open('POST',base+path,true);xhr.timeout=65000;xhr.setRequestHeader('Content-Type','application/json');if(/\.ngrok-free\.(dev|app)$/.test(base)){xhr.setRequestHeader('ngrok-skip-browser-warning','1');}if(secret){xhr.setRequestHeader('X-Rezka-Test',secret);}
  xhr.onload=function(){var data;try{data=JSON.parse(xhr.responseText);}catch(ignore){done('Ответ backend не распознан.');return;}
   if(xhr.status!==200){if(xhr.status===401&&path!=='/api/pair'){token='';save();}done(xhr.status===404?'Обнови backend на ноутбуке до версии 0.4.':safe(data.error||('HTTP '+xhr.status)));return;}done(null,data);
  };
  xhr.onerror=function(){done('Нет связи с ноутбуком. Проверь backend и туннель.');};xhr.ontimeout=function(){done('Нет ответа за 65 секунд. Попробуй ещё раз.');};
  try{xhr.send(JSON.stringify(body));}catch(ignore){done('Не удалось отправить запрос.');}
 }
 function screen(){
  el('backend-url').value=base;text('notebook-status',connected()?'Ноутбук подключён. Можно искать фильмы, сериалы и мультфильмы.':'Введи адрес backend и шестизначный код с ноутбука.');
  var xhr=new XMLHttpRequest();xhr.open('GET','backend.json?_='+new Date().getTime(),true);xhr.timeout=10000;
  xhr.onload=function(){try{var data=JSON.parse(xhr.responseText);if(data.url&&validBase(data.url)&&data.url.replace(/\/$/,'')!==base&&(el('backend-url').value===base||!el('backend-url').value)){base=data.url.replace(/\/$/,'');token='';save();el('backend-url').value=base;text('notebook-status','Адрес обновлён. Введи новый код с ноутбука.');}}catch(ignore){}};
  try{xhr.send(null);}catch(ignore){}
 }
 function pair(){
  var value=el('backend-url').value.replace(/^\s+|\s+$/g,'').replace(/\/$/,'');var code=el('backend-code').value.replace(/\s/g,'');
  if(!validBase(value)){text('notebook-status','Нужен HTTPS-адрес ngrok или Cloudflare с экрана ноутбука.');return;}
  if(!/^[0-9]{6}$/.test(code)){text('notebook-status','Введи шесть цифр кода.');return;}
  base=value;text('notebook-status','Подключаю ноутбук…');el('pair-button').disabled=true;
  request('/api/pair',{code:code},'',function(error,data){el('pair-button').disabled=false;if(error){text('notebook-status',error);return;}
   if(!data||typeof data.access_token!=='string'||data.access_token.length<32){text('notebook-status','Некорректный ответ подключения.');return;}
   token=data.access_token;save();el('backend-code').value='';text('notebook-status','Ноутбук подключён. Открой каталог или поиск.');sdk.collect();
  });
 }
 function capturePosition(){if(Notebook.active&&sdk.player.currentTime>0){resumeAt=sdk.player.currentTime;}}
 function voice(){var list=movieData?movieData.translators:[],i;for(i=0;i<list.length;i++){if(list[i].id===voiceId){return list[i];}}return null;}
 function renderMovie(){
  text('movie-name',movieData?movieData.title:'Получаю фильм…');text('movie-status',movieMessage||'Загрузка…');
  var selected=voice();text('movie-voice-label','Озвучка: '+(selected?selected.name:'—'));
  text('movie-quality-label','Качество: '+(sources[sourceIndex]?sources[sourceIndex].label:'—')+(prefs.quality==='best'&&sources.length?' · максимум доступного':''));
  el('movie-play').disabled=busy||!sources.length;el('movie-voices').disabled=busy||!movieData;el('movie-qualities').disabled=busy||!sources.length;
  el('movie-episodes').hidden=!isSeries();el('movie-episodes').disabled=busy||!seasonsData.length;
  text('movie-episode-label',episodeLabel());
  if(sdk.getPage()==='movie'){sdk.collect();}
 }
 function sourceKey(s){return s.quality+'|'+s.kind;}
 function preferredSource(){var i;if(prefs.quality!=='best'){for(i=0;i<sources.length;i++){if(sourceKey(sources[i])===prefs.quality){return i;}}}return 0;}
 function getSources(force,returnToVideo){
  var current=++generation;busy=true;sources=[];premiumQualities=[];movieMessage='Получаю варианты качества…';renderMovie();
  if(returnToVideo){text('media-status','Обновляю источник…');}
  request('/api/resolve',{url:currentURL,translator_id:voiceId,season:seasonId,episode:episodeId,force:!!force},token,function(error,data){
   if(current!==generation){return;}busy=false;
   if(error){movieMessage=error;renderMovie();if(returnToVideo){text('media-status',error);}return;}
   var incoming=data.sources||[],i,a,item;
   for(i=0;i<incoming.length&&sources.length<32;i++){
    item=incoming[i];if(!item||typeof item.url!=='string'||typeof item.label!=='string'||item.premium){continue;}
    a=document.createElement('a');a.href=item.url;if((a.protocol==='https:'||a.protocol==='http:')&&!a.username&&!a.password){sources.push(item);}
   }
   sources.sort(function(a,b){var difference=(Number(b.resolution)||0)-(Number(a.resolution)||0);return difference||((a.kind==='MP4'?0:1)-(b.kind==='MP4'?0:1));});
   premiumQualities=data.premium_qualities||[];if(data.movie&&data.movie.url===currentURL){movieData=data.movie;}
   if(data.selected_translation){voiceId=String(data.selected_translation);}
   if(!sources.length){movieMessage=safe(data.report&&data.report.message?data.report.message:'Источник недоступен. Выбери другую озвучку.');renderMovie();if(returnToVideo){text('media-status',movieMessage);}return;}
   sourceIndex=preferredSource();movieMessage='Готово. Максимум выбирается из доступных вариантов этой озвучки.';renderMovie();
   if(returnToVideo&&sdk.getPage()==='video'){playSelected();}
  });
 }
 function movie(url){
  url=typeof url==='string'&&url?url:(currentURL||SAMPLE);
  if(!isMovie(url)){sdk.show('catalog');text('catalog-status','Эта ссылка не относится к поддерживаемым разделам Rezka.');return;}
  if(url!==currentURL){resumeAt=0;loadedKey='';seasonId=episodeId=episodeVoice='';}else{capturePosition();}
  currentURL=url;if(!connected()){sdk.show('notebook');return;}
  var current=++generation;Notebook.active=false;busy=true;sources=[];seasonsData=[];movieData=null;movieMessage='Загружаю фильм и список озвучек…';sdk.show('movie');renderMovie();
  request('/api/movie',{url:currentURL},token,function(error,data){
   if(current!==generation){return;}busy=false;
   if(error||!data.movie){movieMessage=error||safe(data.report&&data.report.message?data.report.message:'Не удалось получить карточку фильма.');renderMovie();return;}
   movieData=data.movie;var list=movieData.translators||[],chosen=null,i;
   for(i=0;i<list.length;i++){if(list[i].id===prefs.voice&&!list[i].premium){chosen=list[i];break;}}
   if(!chosen){for(i=0;i<list.length;i++){if(list[i].default&&!list[i].premium){chosen=list[i];break;}}}
   if(!chosen){for(i=0;i<list.length;i++){if(!list[i].premium){chosen=list[i];break;}}}
   voiceId=chosen?chosen.id:'';
   if(movieData.restriction){movieMessage=movieData.restriction;renderMovie();return;}
   if(!chosen){movieMessage='Доступных без подписки озвучек не найдено. Можно открыть фильм на сайте.';renderMovie();return;}
   if(isSeries()){loadEpisodes();}else{seasonId=episodeId='';getSources(false,false);}
  });
 }
 function isSeries(){return !!(movieData&&movieData.type==='series');}
 function episodeLabel(){return isSeries()&&seasonId!==''&&episodeId!==''?'Сезон '+seasonId+' · серия '+episodeId:'';}
 function selectedEpisode(){
  for(var i=0;i<seasonsData.length;i++){if(seasonsData[i].id===seasonId){for(var j=0;j<seasonsData[i].episodes.length;j++){if(seasonsData[i].episodes[j].id===episodeId){return true;}}}}
  return false;
 }
 function loadEpisodes(){
  if(episodeVoice!==voiceId){Notebook.active=false;resumeAt=0;loadedKey='';}
  var current=++generation;busy=true;sources=[];seasonsData=[];movieMessage='Получаю сезоны и серии этой озвучки…';renderMovie();
  request('/api/episodes',{url:currentURL,translator_id:voiceId},token,function(error,data){
   if(current!==generation){return;}busy=false;
   if(error){movieMessage=error;renderMovie();return;}
   var list=data.seasons||[];
   for(var i=0;i<list.length&&i<200;i++){var item=list[i];if(item&&typeof item.id==='string'&&item.episodes&&item.episodes.length){seasonsData.push(item);}}
   if(!seasonsData.length){movieMessage=safe(data.report&&data.report.message?data.report.message:'Нет доступных серий в этой озвучке.');seasonId=episodeId='';renderMovie();return;}
   if(episodeVoice===voiceId&&selectedEpisode()){getSources(false,false);return;}
   seasonId=episodeId='';resumeAt=0;loadedKey='';movieMessage='Выбери озвучку, затем сезон и серию.';renderMovie();
  });
 }
 function seasons(){
  if(!isSeries()||!seasonsData.length||busy){return;}
  capturePosition();sdk.show('seasons');text('seasons-title',movieData.title+' · сезоны');var list=el('season-list');list.textContent='';
  for(var i=0;i<seasonsData.length;i++){button(list,(seasonsData[i].id===seasonId?'✓ ':'')+seasonsData[i].title+' · серий: '+seasonsData[i].episodes.length,'season-select',i);}
  sdk.collect();
 }
 function selectSeason(index){
  var season=seasonsData[Number(index)];if(!season){return;}pendingSeason=season.id;sdk.show('episodes');text('episodes-title',movieData.title+' · '+season.title);var list=el('episode-list');list.textContent='';
  for(var i=0;i<season.episodes.length;i++){var episode=season.episodes[i];button(list,(seasonId===season.id&&episodeId===episode.id?'✓ ':'')+episode.title,'episode-select',i);}
  sdk.collect();
 }
 function selectEpisode(index){
  var season=null;for(var i=0;i<seasonsData.length;i++){if(seasonsData[i].id===pendingSeason){season=seasonsData[i];break;}}
  var episode=season&&season.episodes[Number(index)];if(!episode){return;}
  if(seasonId!==season.id||episodeId!==episode.id||episodeVoice!==voiceId){resumeAt=0;loadedKey='';Notebook.active=false;}
  seasonId=season.id;episodeId=episode.id;episodeVoice=voiceId;sdk.show('movie');getSources(false,false);
 }
 function button(list,label,action,index){var b=document.createElement('button');b.textContent=label;b.setAttribute('data-action',action);b.setAttribute('data-index',String(index));list.appendChild(b);return b;}
 function voices(){
  capturePosition();sdk.show('voices');var list=el('voice-list');list.textContent='';text('voices-title',movieData?movieData.title+' · озвучка':'Озвучка');
  var choices=movieData?movieData.translators:[];
  for(var i=0;i<choices.length;i++){var v=choices[i];button(list,(v.id===voiceId?'✓ ':'')+v.name+(v.premium?' · нужна подписка':'')+(v.default?' · по умолчанию на сайте':''),'voice-select',i);}
  text('voice-status','Выбери озвучку. Платные варианты отмечены.');sdk.collect();
 }
 function selectVoice(index){
  var selected=movieData&&movieData.translators[Number(index)];if(!selected){return;}
  if(selected.premium){text('voice-status','Эта озвучка требует подписки. Вход в аккаунт в Lite пока не подключён; её можно открыть на сайте Rezka.');return;}
  voiceId=selected.id;prefs.voice=voiceId;save();sdk.show('movie');if(isSeries()){loadEpisodes();}else{getSources(false,false);}
 }
 function qualities(){
  capturePosition();sdk.show('qualities');var list=el('quality-list');list.textContent='';text('qualities-title',(movieData?movieData.title+' · ':'')+'качество');
  button(list,'Максимум доступного'+(sources[0]?' · '+sources[0].label:''),'quality-select',-1);
  for(var i=0;i<sources.length;i++){button(list,(sourceIndex===i?'✓ ':'')+sources[i].label,'quality-select',i);}
  for(i=0;i<premiumQualities.length;i++){button(list,premiumQualities[i].quality+' · нужна подписка','quality-premium',i);}
  text('quality-status','Выбери вариант. MP4 и HLS — форматы потока; поддержка высокого разрешения зависит от телевизора.');sdk.collect();
 }
 function selectQuality(index){
  index=Number(index);if(index===-1){prefs.quality='best';sourceIndex=0;}else if(sources[index]){sourceIndex=index;prefs.quality=sourceKey(sources[index]);}else{return;}
  save();renderMovie();playSelected();
 }
 function playSelected(){
  if(!sources.length||busy){return;}var source=sources[sourceIndex],key=currentURL+'|'+voiceId+'|'+seasonId+'|'+episodeId+'|'+source.url;
  Notebook.active=true;el('test-controls').hidden=true;el('movie-controls').hidden=false;text('video-title',movieData.title+(episodeLabel()?' · '+episodeLabel():''));text('movie-quality',voice().name+' · '+source.label);el('video-episodes').hidden=!isSeries();
  sdk.show('video');
  if(loadedKey!==key){
   sdk.player.pause();if(seekHandler){sdk.player.removeEventListener('loadedmetadata',seekHandler);}
   var point=resumeAt;seekHandler=function(){try{if(point>0){sdk.player.currentTime=isFinite(sdk.player.duration)?Math.min(point,Math.max(0,sdk.player.duration-1)):point;}}catch(ignore){}sdk.player.removeEventListener('loadedmetadata',seekHandler);seekHandler=null;};
   sdk.player.addEventListener('loadedmetadata',seekHandler);sdk.player.src=source.url;sdk.player.load();loadedKey=key;
  }
  text('media-status',source.label+' · '+voice().name+'. Нажми «Пуск / пауза» или 5.');sdk.collect();
 }
 function prepareTest(){capturePosition();generation++;Notebook.active=false;loadedKey='';sdk.player.pause();sdk.player.removeAttribute('src');sdk.player.load();el('test-controls').hidden=false;el('movie-controls').hidden=true;text('video-title','Тест HTML5-видео');}
 function search(){
  var query=el('search-query').value.replace(/^\s+|\s+$/g,'');if(query.length<2||query.length>100){text('catalog-status','Введите от 2 до 100 символов.');return;}
  if(!connected()){sdk.show('notebook');return;}
  if(sdk.beginSearch){sdk.beginSearch();}text('catalog-status','Ищу «'+query+'»…');el('search-button').disabled=true;
  request('/api/search',{query:query},token,function(error,data){el('search-button').disabled=false;
   if(error){text('catalog-status',error);return;}var items=data.items||[],list=el('catalog-list'),count=0;list.textContent='';
   for(var i=0;i<items.length&&count<48;i++){var item=items[i];if(!item||typeof item.title!=='string'||!isMovie(item.url)){continue;}
    var b=document.createElement('button'),name=document.createElement('strong'),details=document.createElement('span');b.setAttribute('data-action','open-title');b.setAttribute('data-url',item.url);name.textContent=item.title;details.textContent=item.details||'';b.appendChild(name);b.appendChild(details);list.appendChild(b);count++;
   }
   text('catalog-status',count?'Найдено: '+count+'. Показана первая страница результатов.':safe(data.report&&data.report.message?data.report.message:'Ничего не найдено. Попробуй другое название.'));
   if(sdk.getPage()==='catalog'){sdk.collect();if(list.firstChild){list.firstChild.focus();}}
  });
 }
 var Notebook={active:false,init:function(api){sdk=api;try{var url=localStorage.getItem('rtl-backend-url')||'';if(validBase(url)){base=url;token=localStorage.getItem('rtl-backend-token')||'';}var saved=JSON.parse(localStorage.getItem('rtl-movie-prefs')||'{}');if(typeof saved.voice==='string'){prefs.voice=saved.voice;}if(typeof saved.quality==='string'){prefs.quality=saved.quality;}}catch(ignore){}},
  screen:screen,pair:pair,movie:movie,isMovie:isMovie,isOdyssey:isMovie,prepareTest:prepareTest,voices:voices,selectVoice:selectVoice,qualities:qualities,selectQuality:selectQuality,search:search,playSelected:playSelected,
  qualityPremium:function(){text('quality-status','Этот вариант требует подписки. Вход в аккаунт в Lite пока не подключён; открой фильм на сайте.');},
  info:function(){capturePosition();sdk.show('movie');renderMovie();},refresh:function(){capturePosition();if(isSeries()&&!episodeId){loadEpisodes();}else{getSources(true,sdk.isVideo());}},
  original:function(){root.location.href=isMovie(currentURL)?currentURL:'https://rezka.ag/';},title:function(){return movieData?movieData.title:'Фильм';},
  seasons:seasons,selectSeason:selectSeason,selectEpisode:selectEpisode,episodeBack:function(){seasons();},
  nextQuality:qualities
 };
 root.Notebook=Notebook;
}(window));
