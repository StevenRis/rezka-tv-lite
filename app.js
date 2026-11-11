(function () {
  'use strict';
  var page='home', index=0, buttons=[], custom={}, seen={}, steps=['up','down','left','right','ok','back'], step=-1, pending={};
  var player=document.getElementById('player'), storage='недоступно', probe=null, catalogLoaded=false, catalogRequest=null;
  function el(id){return document.getElementById(id);}
  function text(id,value){el(id).textContent=value;}
  try { localStorage.setItem('rtl-test','1'); if(localStorage.getItem('rtl-test')==='1'){storage='работает';}localStorage.removeItem('rtl-test');custom=JSON.parse(localStorage.getItem('rtl-keys')||'{}');if(!custom||typeof custom!=='object'){custom={};} } catch(ignore){custom={};}
  function save(){try{localStorage.setItem('rtl-keys',JSON.stringify(custom));}catch(ignore){}}
  function collect(){var all=el(page).getElementsByTagName('button'),i;buttons=[];for(i=0;i<all.length;i++){if(!all[i].disabled&&(all[i].offsetWidth||all[i].offsetHeight)){buttons.push(all[i]);}}index=0;focus();}
  function focus(){var i;for(i=0;i<buttons.length;i++){buttons[i].className=i===index?'selected':'';}if(buttons[index]){buttons[index].focus();var rect=buttons[index].getBoundingClientRect(),footer=document.getElementsByTagName('footer')[0],limit=window.innerHeight-16;if(footer){limit=Math.min(limit,footer.getBoundingClientRect().top-16);}if(rect.bottom>limit){window.scrollBy(0,rect.bottom-limit);}else if(rect.top<16){window.scrollBy(0,rect.top-16);}}}
  function show(name){var all=document.querySelectorAll('.screen'),i;step=-1;for(i=0;i<all.length;i++){all[i].hidden=all[i].id!==name;}if(page==='video'&&name!=='video'){player.pause();}page=name;document.body.className=name==='home'?'':'detail-screen';collect();if(name==='diagnostics'){report();}if(name==='notebook'){Notebook.screen();}if(name==='catalog'&&!catalogLoaded){loadCatalog();}}
  function support(type){return player.canPlayType ? (player.canPlayType(type)||'нет'):'нет API';}
  function report(){text('report','Rezka TV Lite 0.1.4\nЦель: Philips 55PUS7607/12 · SAPHI\nПрошивка (указана пользователем): TPN226E_V226.003.087.001\nРазмер окна: '+window.innerWidth+' × '+window.innerHeight+'\nЭкран: '+screen.width+' × '+screen.height+'\nlocalStorage: '+storage+'\nMP4 / H.264 + AAC: '+support('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')+'\nHLS native: '+support('application/vnd.apple.mpegurl')+'\nMediaSource API: '+(window.MediaSource?'есть':'нет')+'\nXMLHttpRequest: '+(window.XMLHttpRequest?'есть':'нет')+'\nUser Agent: '+navigator.userAgent+'\nНазначенные коды: '+JSON.stringify(custom)+'\nПолученные действия: '+Object.keys(seen).join(', '));}
  function titleURL(url){
    if(typeof url!=='string'||!/^https:\/\/rezka\.ag\//.test(url)){return false;}
    var link=document.createElement('a');link.href=url;
    return link.protocol==='https:'&&link.host==='rezka.ag'&&/\.html$/.test(link.pathname)&&!link.search&&!link.hash;
  }
  function loadCatalog(){
    if(catalogRequest){return;}
    text('catalog-status','Загружаю подготовленный каталог…');
    var xhr=new XMLHttpRequest();catalogRequest=xhr;
    xhr.open('GET','catalog.json?_='+new Date().getTime(),true);xhr.timeout=12000;
    xhr.onload=function(){
      catalogRequest=null;
      try{
        if(xhr.status!==200){throw new Error('HTTP '+xhr.status);}
        var data=JSON.parse(xhr.responseText),i,item,button,title,details,list=el('catalog-list'),count=0;
        if(data.schema!==1||!data.items||!data.items.length||typeof data.generated_at!=='string'){throw new Error('Некорректный каталог');}
        while(list.firstChild){list.removeChild(list.firstChild);}
        for(i=0;i<data.items.length&&count<24;i++){
          item=data.items[i];if(typeof item.title!=='string'||!titleURL(item.url)){continue;}
          button=document.createElement('button');button.setAttribute('data-action','open-title');button.setAttribute('data-url',item.url);
          title=document.createElement('strong');title.textContent=item.title;
          details=document.createElement('span');details.textContent=typeof item.details==='string'?item.details:'';
          button.appendChild(title);button.appendChild(details);list.appendChild(button);count++;
        }
        if(!count){throw new Error('Нет подходящих карточек');}
        catalogLoaded=true;
        text('catalog-status','Карточек: '+count+' · Снимок каталога: '+data.generated_at.replace('T',' ').substring(0,16)+' UTC.');
        if(page==='catalog'){collect();}
      }catch(error){text('catalog-status','Каталог не загружен: '+error.message+'. Попробуйте обновить позже.');}
    };
    xhr.onerror=function(){catalogRequest=null;text('catalog-status','Ошибка сети при загрузке каталога.');};
    xhr.ontimeout=function(){catalogRequest=null;text('catalog-status','Нет ответа за 12 секунд.');};
    xhr.send(null);
  }
  var mediaLog=[], mediaGeneration=0;
  function safeMessage(value){return String(value||'').replace(/https?:\/\/[^\s"']+/g,'[медиассылка]');}
  function mediaDetail(message){
    var error=player.error;
    mediaLog.push(safeMessage(message));
    if(mediaLog.length>8){mediaLog.shift();}
    text('media-detail','Источник: '+(Notebook.active?'Одиссея · медиассылка скрыта':(player.getAttribute('src')==='media/test-baseline.mp4'?'Тестовый MP4':'Внешний источник'))+'\nreadyState='+player.readyState+' networkState='+player.networkState+' mediaError='+(error?error.code:'нет')+'\n'+mediaLog.join('\n'));
  }
  function loadSample(url){
    mediaGeneration++;
    player.pause();
    mediaLog=[];
    player.src=url;
    player.load();
    text('media-status','Источник выбран. Нажмите «Пуск / пауза» или треугольник на самом видео.');
    mediaDetail('Загрузка запрошена');
  }
  function playError(error,generation){
    if(generation!==mediaGeneration){return;}
    var message=(error&&error.name?error.name:'Ошибка')+': '+(error&&error.message?error.message:'без описания');
    text('media-status','Не удалось запустить видео: '+safeMessage(message));
    mediaDetail(message);
  }
  function toggle(){
    if(!player.getAttribute('src')){text('media-status','Сначала выберите «Тестовый MP4».');return;}
    if(player.paused){
      var generation=mediaGeneration;
      try {var promise=player.play();if(promise&&promise['catch']){promise['catch'](function(error){playError(error,generation);});}}
      catch(error){playError(error,generation);}
    }else{player.pause();}
  }
  function probeRezka(){if(probe){return;}text('network-status','Проверяю HTTPS-запрос…');try{probe=new XMLHttpRequest();probe.open('GET','https://rezka.ag/',true);probe.timeout=12000;probe.onload=function(){text('network-status',probe.status>=200&&probe.status<300?'Ответ читается: HTTP '+probe.status+'. Формат каталога ещё не проверен.':'Получен HTTP '+probe.status+'. Каталог не подключён.');probe=null;};probe.onerror=function(){text('network-status','Ответ недоступен. Возможны CORS, TLS, сеть или ограничения сайта. Откройте сайт отдельно для сравнения.');probe=null;};probe.ontimeout=function(){text('network-status','Нет ответа за 12 секунд. Это не доказывает недоступность сайта на телевизоре.');probe=null;};probe.send(null);}catch(ignore){probe=null;text('network-status','Не удалось начать XMLHttpRequest в этом браузере.');}}
  function run(action,url){if(action==='home'){show('home');}else if(action==='video'){Notebook.prepareTest();show('video');}else if(action==='pair-notebook'){Notebook.pair();}else if(action==='movie'){Notebook.movie();}else if(action==='movie-quality'){Notebook.nextQuality();}else if(action==='original-movie'){window.location.href='https://rezka.ag/films/fantasy/85038-odisseya-2026-latest.html';}else if(action==='remote'||action==='notebook'||action==='diagnostics'||action==='integration'||action==='catalog'){show(action);}else if(action==='catalog-refresh'){loadCatalog();}else if(action==='open-title'){if(titleURL(url)){if(Notebook.isOdyssey(url)){Notebook.movie();}else{window.location.href=url;}}}else if(action==='refresh'){report();}else if(action==='calibrate'){step=0;pending={};text('calibration','Нажмите: '+steps[step]+' (↑). Escape отменяет настройку.');}else if(action==='sample'){loadSample('media/test-baseline.mp4');}else if(action==='external-sample'){loadSample('https://media.w3.org/2010/05/sintel/trailer.mp4');}else if(action==='direct-sample'){window.location.href='media/test-baseline.mp4';}else if(action==='play'){toggle();}else if(action==='fullscreen'){var fn=player.requestFullscreen||player.webkitRequestFullscreen||player.webkitEnterFullscreen;if(fn){try{var p=fn.call(player);if(p&&p['catch']){p['catch'](function(){text('media-status','Полный экран недоступен.');});}}catch(ignore){text('media-status','Полный экран недоступен.');}}else{text('media-status','API полного экрана отсутствует.');}}else if(action==='probe'){probeRezka();}else if(action==='rezka'){window.location.href='https://rezka.ag/';}}
  document.addEventListener('click',function(event){var node=event.target;while(node&&node!==document){if(node.getAttribute&&node.getAttribute('data-action')){if(event.isTrusted!==false){document.body.setAttribute('data-input','pointer');text('last-key','Щелчок / OK: '+node.textContent);text('key-result','Получен щелчок / OK: '+node.textContent);}run(node.getAttribute('data-action'),node.getAttribute('data-url'));return;}node=node.parentNode;}});
  document.addEventListener('mousemove',function(){document.body.setAttribute('data-input','pointer');});
  document.addEventListener('focusin',function(event){var i;for(i=0;i<buttons.length;i++){if(buttons[i]===event.target){index=i;for(var j=0;j<buttons.length;j++){buttons[j].className=j===i?'selected':'';}break;}}});
  document.addEventListener('keydown',function(event){var target=event.target;if(target&&(target.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))){return;}var code=event.keyCode||event.which,action=TVNav.action(code,custom),line='Код '+code+' · '+(event.key||'без имени')+' · '+(action||'не назначено');text('last-key',line);text('key-result',line);
    if(step>=0){event.preventDefault();if(code===27){step=-1;text('calibration','Настройка отменена.');return;}if(event.repeat){return;}if(step>0&&pending[code]){text('calibration','Этот код уже назначен. Нажмите другую кнопку: '+steps[step]);return;}pending[code]=steps[step];step++;if(step===steps.length){step=-1;custom=pending;save();text('calibration','Коды сохранены. Проверьте стрелки и возврат.');}else{text('calibration','Нажмите: '+steps[step]);}return;}
    if(!action){return;}event.preventDefault();document.body.setAttribute('data-input','keys');if(action==='ok'&&event.repeat){return;}seen[action]=true;text('key-progress','Получено: '+Object.keys(seen).join(', '));
    if(action==='back'){if(document.fullscreenElement||document.webkitFullscreenElement){var exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit){exit.call(document);}}else if(page!=='home'){show('home');}return;}
    if(action==='play'||action==='pause'||action==='stop'){if(page==='video'){if(action==='stop'){player.pause();try{player.currentTime=0;}catch(ignore){}}else if(action==='pause'){player.pause();}else{toggle();}}return;}
    if(event.target===player){if(action==='ok'){toggle();}else if(action==='left'||action==='right'){try{player.currentTime=Math.max(0,Math.min(isFinite(player.duration)?player.duration:player.currentTime+10,player.currentTime+(action==='left'?-10:10)));}catch(ignore){}}else if(action==='down'||action==='up'){focus();}return;}
    if(action==='ok'){if(buttons[index]){buttons[index].click();}}else if(page==='video'&&action==='up'){player.focus();}else{index=TVNav.next(index,action,buttons.length,(page==='home'||page==='catalog')&&window.innerWidth>760?2:1);focus();}
  },false);
  player.addEventListener('playing',function(){text('media-status','Видео воспроизводится. Проверьте изображение и звук.');});
  player.addEventListener('pause',function(){mediaDetail('pause');});
  player.addEventListener('error',function(){text('media-status','Ошибка медиа: '+(player.error?player.error.code:'неизвестно')+' · '+safeMessage(player.error&&player.error.message?player.error.message:'без описания'));mediaDetail('error');});
  var mediaEvents=['loadstart','loadedmetadata','loadeddata','canplay','waiting','stalled','playing','ended'];
  for(var m=0;m<mediaEvents.length;m++){(function(name){player.addEventListener(name,function(){mediaDetail(name);});}(mediaEvents[m]));}
  text('codecs','MP4: '+support('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')+' · Native HLS: '+support('application/vnd.apple.mpegurl'));
  Notebook.init({el:el,text:text,show:show,collect:collect,player:player,isVideo:function(){return page==='video';}});
  show('home');
}());
