import {escape as e,dayKey,statistics,score,sameAnswer,questionIssue,parseCSV,questionId,exportCSV,validateBackup} from './core.mjs';
import * as storage from './db.mjs';
const main=document.querySelector('#main'),messageBox=document.querySelector('#message');
let db,questions=[],attempts=[],pendingRestore=null,epoch=0;
const letter=i=>'ABCDEFGH'[i];
const route=()=>location.hash.slice(1)||(location.pathname.startsWith('/admin')?'/admin':'/');
const to=path=>{if(route()===path)render();else location.hash=path;};
function message(text,type='success'){messageBox.textContent=text;messageBox.className=`notice ${type}`;messageBox.hidden=false;messageBox.scrollIntoView({block:'nearest',behavior:'smooth'});}
function failure(error){console.error(error.name,error.message);message(error.name==='QuotaExceededError'?'Betelt a böngésző tárhelye. A mostani műveletet nem mentettük. Készíts biztonsági mentést a Mentések oldalon.':error.message||'A művelet nem sikerült. Próbáld újra.','error');}
const link=(path,label,classes='')=>`<a class="${classes}" href="#${e(path)}">${label}</a>`;
const btn=(action,label,classes='button',extra='')=>`<button type="button" class="${classes}" data-action="${action}" ${extra}>${label}</button>`;
const attemptLink=a=>`/practice/${encodeURIComponent(a.id)}`;
const prettyDate=value=>new Intl.DateTimeFormat('hu-HU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const activeQuestion=q=>q.active&&!q.issue&&!questionIssue(q);
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function load(){[questions,attempts]=await Promise.all([storage.all(db,'questions'),storage.all(db,'attempts')]);}
function dashboard(){
  const today=dayKey(),s=statistics(attempts,today),daily=attempts.find(a=>a.mode==='daily'&&a.day===today),active=attempts.filter(a=>!a.completedAt).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
  return `<div class="page-heading"><div><span class="eyebrow">A TE TANULÁSI TERVED</span><h1>Ma is egy lépéssel előrébb<span class="accent">.</span></h1><p class="muted">Napi 30 kérdés. A saját tempódban, a saját célod felé.</p></div><span class="date-pill">◷ ${today} · Budapest</span></div>
  <div class="stats"><div class="stat"><span>Összesített pontosság</span><strong>${s.accuracy===null?'—':s.accuracy+'%'}</strong><small>Befejezett gyakorlások alapján</small></div><div class="stat"><span>Megválaszolt kérdések</span><strong>${s.total}</strong><small>Befejezett feladatsorokban</small></div><div class="stat"><span>Gyakorlási sorozat</span><strong>${s.streak} <i>nap</i></strong><small>Egymást követő aktív napok</small></div><div class="stat"><span>Aktív kérdésbank</span><strong>${questions.filter(activeQuestion).length}</strong><small>Gyakorlásra kész kérdések</small></div></div>
  <div class="practice-cards"><section class="daily-card"><div class="card-top"><span class="pill">NAPI KIHÍVÁS</span><span>01 / FÓKUSZ</span></div><h2>30 kérdés.<br>Egy lépés előre.</h2><p>Mai saját feladatsorod. Minden választ mentünk,<br class="desktop"> így bármikor visszatérhetsz.</p><div class="card-bottom"><span>30 kérdés <b>·</b> Napi 1 feladatsor</span>${daily?link(attemptLink(daily),daily.completedAt?'Mai eredmény ↗':'Folytatás ↗','button cream'):btn('start-daily','Kezdjük el ↗','button cream')}</div><div class="rings" aria-hidden="true"></div></section>
  <section class="free-card"><div class="card-top"><span class="pill pale">SZABAD GYAKORLÁS</span><span>02 / FELFEDEZÉS</span></div><h2>A saját<br>tempódban.</h2><p>Új kör, új lehetőségek. 30 véletlen kérdés,<br class="desktop"> ahányszor csak szeretnéd.</p><div class="card-bottom"><span>30 random kérdés <b>·</b> Korlátlan kör</span>${btn('start-free','Új gyakorlás ↗')}</div></section></div>
  <div class="local-note"><span>◉ A gyakorlásaid ebben a böngészőben maradnak. A böngészőadatok törlése előtt készíts mentést.</span>${link('/settings','Biztonsági mentés →')}</div>
  ${active.length?`<div class="resume-list"><span class="eyebrow">FOLYTATÁSRA VÁR</span>${active.slice(0,6).map(a=>link(attemptLink(a),`${a.mode==='daily'?'Napi kihívás':'Szabad gyakorlás'} · ${a.day} · ${a.answers.length}/30 <span>Folytatás →</span>`)).join('')}${active.length>6?link('/history',`Összes (${active.length}) →`):''}</div>`:''}
  <div class="section-heading"><div><span class="eyebrow">LÁTHATÓ FEJLŐDÉS</span><h2>A kitartásod nyoma</h2></div><span class="muted">Az elmúlt 28 nap</span></div><section class="card activity"><div class="activity-days">${s.calendar.map(d=>`<div class="day-cell ${d.sessions?(d.percent>=80?'great':d.percent>=60?'good':'learning'):''}" title="${d.day}: ${d.sessions?d.percent+'%':'nincs befejezett gyakorlás'}"><span>${d.day.slice(8)}</span><strong>${d.sessions?d.percent+'%':'·'}</strong></div>`).join('')}</div><div class="activity-legend"><span>A befejezés napja szerint · Europe/Budapest</span><span>○ Nincs gyakorlás <b class="legend-learning">●</b> &lt;60% <b class="legend-good">●</b> 60–79% <b class="legend-great">●</b> ≥80%</span></div></section>
  <div class="section-heading"><h2>Napi teljesítmény</h2><span class="muted">Helyes válaszok / összes kérdés</span></div><section class="card table-wrap"><table><thead><tr><th>Dátum</th><th>Gyakorlások</th><th>Helyes válaszok</th><th>Pontosság</th><th>Napi kihívás</th></tr></thead><tbody>${s.days.map(d=>`<tr><td>${d.day}</td><td>${d.sessions}</td><td>${d.correct} / ${d.total}</td><td><strong>${d.percent}%</strong></td><td>${d.daily?'✓ Teljesítve':'—'}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Az első befejezett gyakorlás után itt jelenik meg a fejlődésed.</td></tr>'}</tbody></table></section>
  ${s.finished.length?`<div class="section-heading"><h2>Legutóbbi gyakorlások</h2>${link('/history','Összes gyakorlás →')}</div><div class="history-list">${s.finished.slice(0,6).map(historyItem).join('')}</div>`:''}`;
}
function historyItem(a){return link(attemptLink(a),`<div><strong>${a.mode==='daily'?'Napi kihívás':'Szabad gyakorlás'}</strong><small>${e(prettyDate(a.completedAt||a.startedAt))}</small></div><span>${a.completedAt?score(a)+' / 30':a.answers.length+' / 30 mentve'} <b>→</b></span>`,'card history-item');}
function practice(id){
  const a=attempts.find(a=>a.id===id);if(!a)throw Error('Ez a gyakorlás nem található ebben a böngészőben.');
  if(a.completedAt)return result(a);
  const index=a.answers.length,q=a.snapshot[index];
  return `<div class="quiz-shell"><div class="quiz-nav">${link('/','← Vissza az áttekintéshez')}<span class="pill pale">${a.mode==='daily'?'NAPI KIHÍVÁS':'SZABAD GYAKORLÁS'}</span></div><div class="section-heading"><h2>${index+1}<span class="muted"> / 30</span></h2><span class="muted">${index} válasz elmentve</span></div><progress value="${index}" max="30">${index}/30</progress><section class="card question-card"><span class="eyebrow">AWS SOLUTIONS ARCHITECT · SAA-C03</span><h1 class="question-text" lang="en">${e(q.question)}</h1><p class="selection-hint">${q.correct.length>1?`Többválaszos kérdés · Jelölj meg pontosan ${q.correct.length} választ.`:'Egyválaszos kérdés · Jelöld meg a helyes választ.'}</p><form data-form="answer" data-id="${e(id)}" data-index="${index}" data-count="${q.correct.length}"><fieldset><legend class="sr-only">Válaszlehetőségek</legend>${q.options.map((o,i)=>`<label class="answer"><input type="${q.correct.length>1?'checkbox':'radio'}" name="answer" value="${i}"><span class="answer-letter">${letter(i)}</span><span lang="en">${e(o)}</span></label>`).join('')}</fieldset><div class="quiz-actions"><span class="muted" id="selected-count" aria-live="polite">0 / ${q.correct.length} válasz kijelölve · A kiértékelés a kör végén jelenik meg.</span><button class="button" disabled>${index===29?'Befejezés és kiértékelés':'Válasz mentése'} →</button></div></form></section></div>`;
}
function result(a){
  const points=score(a);
  return `<div class="quiz-shell">${link('/','← Vissza az áttekintéshez')}<section class="result-hero"><span class="eyebrow">GYAKORLÁS TELJESÍTVE · ${a.completedDay}</span><h1>Ez is egy lépés előre.</h1><div class="result-score">${Math.round(points*100/30)}<span>%</span></div><p><strong>${points} / 30 helyes válasz</strong> · ${a.mode==='daily'?'Napi kihívás':'Szabad gyakorlás'}</p><p class="muted">Gyakorlási pontosság, nem az AWS vizsga skálázott pontszáma.</p>${btn('start-free','Új szabad gyakorlás ↗')}</section><div class="section-heading"><h2>Nézzük át a válaszokat</h2><label class="filter-check"><input type="checkbox" id="mistakes-only"> Csak a hibásak</label></div>${a.snapshot.map((q,index)=>{
    const selected=a.answers[index],ok=sameAnswer(selected,q.correct);
    return `<details class="card review-item ${ok?'is-correct':'is-wrong'}" ${ok?'':'open'}><summary><span class="status-dot ${ok?'ok':'wrong'}">${ok?'✓':'×'}</span><strong>${index+1}. kérdés</strong><span>${ok?'Helyes':'Átismétlendő'}</span></summary><div class="review-content"><p class="question-text" lang="en">${e(q.question)}</p>${q.options.map((o,i)=>`<div class="review-answer ${q.correct.includes(i)?'right':selected.includes(i)?'wrong-answer':''}"><strong>${letter(i)}</strong><span lang="en">${e(o)}</span><small>${q.correct.includes(i)?'Helyes válasz':''}${selected.includes(i)?' · Te választottad':''}</small></div>`).join('')}${q.explanation?`<div class="explanation"><strong>Magyarázat</strong><p>${e(q.explanation)}</p></div>`:''}</div></details>`;
  }).join('')}</div>`;
}
function admin(params){
  const search=params.get('q')||'',status=params.get('status')||'all';
  const filtered=questions.filter(q=>q.question.toLowerCase().includes(search.toLowerCase())&&(status==='review'?q.issue:status==='active'?activeQuestion(q):true));
  const pages=Math.max(1,Math.ceil(filtered.length/30)),page=Math.min(pages,Math.max(1,Number(params.get('page'))||1));
  const pageURL=p=>'/admin?'+new URLSearchParams({q:search,status,page:p});
  return `<div class="page-heading"><div><span class="eyebrow">SAJÁT TUDÁSBÁZIS</span><h1>Kérdésbank<span class="accent">.</span></h1><p class="muted">Bővítsd, javítsd és tartsd naprakészen a feladatsorokat.</p></div>${link('/question/new','+ Új kérdés','button')}</div><div class="stats three"><div class="stat"><span>Összes kérdés</span><strong>${questions.length}</strong></div><div class="stat"><span>Aktív kérdések</span><strong>${questions.filter(activeQuestion).length}</strong></div><div class="stat"><span>Javítást igényel</span><strong>${questions.filter(q=>q.issue).length}</strong></div></div><div class="notice">A módosítások csak ebben a böngészőben érvényesek. A hibás válaszkulcsú sorok javításig kimaradnak a gyakorlásból. A formátumellenőrzés nem ellenőrzi a válaszok szakmai helyességét.</div><section class="card import-card"><div><h2>CSV importálás</h2><p class="muted">Az eredeti táblázat formátuma támogatott. Az azonos kérdések kimaradnak.</p>${btn('export-csv','Kérdésbank exportálása CSV-be ↓','text-button')}</div><form data-form="import" class="import-form"><label class="sr-only" for="csv">CSV fájl</label><input id="csv" type="file" name="file" accept=".csv,text/csv" required><button class="button secondary">Importálás</button></form></section><form class="filters" data-form="search"><label class="sr-only" for="search">Keresés a kérdésekben</label><input id="search" name="q" value="${e(search)}" placeholder="Keresés a kérdésekben…"><label class="sr-only" for="status">Állapot</label><select id="status" name="status">${[['all','Minden kérdés'],['review','Javítandó'],['active','Aktív']].map(([v,label])=>`<option value="${v}" ${v===status?'selected':''}>${label}</option>`).join('')}</select><button class="button secondary">Szűrés</button></form><section class="card admin-list">${filtered.slice((page-1)*30,page*30).map(q=>link('/question/'+encodeURIComponent(q.id),`<span class="question-id">${q.sourceLine?'#'+q.sourceLine:'Új'}</span><div><p lang="en">${e(q.question.slice(0,210))}${q.question.length>210?'…':''}</p>${q.issue?`<small class="error-text">${e(q.issue)}</small>`:''}</div><span class="badge ${q.issue?'warning':''}">${q.issue?'Javítandó':q.active?'Aktív':'Inaktív'}</span><span>↗</span>`,'admin-row')).join('')||'<p class="empty">Nincs ilyen kérdés.</p>'}</section><div class="pagination">${page>1?link(pageURL(page-1),'← Előző'):''}<span>${page} / ${pages}. oldal</span>${page<pages?link(pageURL(page+1),'Következő →'):''}</div>`;
}
function editor(id){
  const q=id==='new'?{question:'',options:[],correct:[],explanation:'',active:true}:questions.find(q=>q.id===id);
  if(!q)throw Error('A kérdés nem található.');
  return `<div class="quiz-shell">${link('/admin','← Vissza a kérdésbankhoz')}<div class="section-heading"><h1>${id==='new'?'Új kérdés':'Kérdés szerkesztése'}</h1></div>${q.issue?`<div class="notice error">${e(q.issue)}${q.rawKey?`<details><summary>Eredeti válaszkulcs</summary><p>${e(q.rawKey)}</p></details>`:''}</div>`:''}<form data-form="question" data-id="${e(id)}" class="card stack edit-form"><label>Kérdés<textarea name="question" rows="7" required maxlength="20000">${e(q.question)}</textarea></label><p class="muted">Jelöld be a helyes válaszokat. Legalább 2 lehetőség szükséges, az üres mezők kimaradnak.</p>${Array.from({length:8},(_,i)=>`<div class="option-editor"><label class="correct-choice"><input type="checkbox" name="correct" value="${i}" ${q.correct.includes(i)?'checked':''}> ${letter(i)} helyes</label><label class="sr-only" for="opt${i}">${letter(i)} válasz</label><textarea id="opt${i}" name="option${i}" rows="3" maxlength="10000">${e(q.options[i]||'')}</textarea></div>`).join('')}<label>Magyarázat (opcionális)<textarea name="explanation" rows="4" maxlength="20000">${e(q.explanation)}</textarea></label><label class="filter-check"><input type="checkbox" name="active" ${q.active?'checked':''}> Szerepeljen a gyakorlásokban</label><div class="quiz-actions"><span class="muted">A mentés helyi. A már elkezdett gyakorlások megőrzik a saját kérdésváltozatukat.</span><button class="button">Kérdés mentése →</button></div></form></div>`;
}
async function settings(){
  const last=await storage.get(db,'meta','lastExport');
  return `<div class="page-heading"><div><span class="eyebrow">A TUDÁSOD VELED MARAD</span><h1>Mentések és adatok<span class="accent">.</span></h1><p class="muted">Mentsd le a haladásod, vagy vidd át egy másik böngészőbe.</p></div></div><div class="notice">Nincs fiók vagy felhőszinkron. Az adatok ehhez a böngészőhöz és a weboldal címéhez tartoznak. Privát böngészés, tárhelytisztítás vagy böngészőadat-törlés esetén elveszhetnek. Használd normál böngészőlapon, és időnként tölts le mentést.</div><div class="settings-grid"><section class="card settings-card"><span class="eyebrow">01 / TELJES MENTÉS</span><h2>Minden egy fájlban</h2><p>A kérdések, a saját módosításaid, az eredmények és a félbehagyott gyakorlások is belekerülnek.</p><div class="backup-counts"><strong>${questions.length}</strong> kérdés <span>·</span> <strong>${attempts.length}</strong> gyakorlás</div>${btn('export-backup','Biztonsági mentés letöltése ↓')}<small>Utolsó export: ${last?e(prettyDate(last.value)):'még nem készült'}</small></section><section class="card settings-card"><span class="eyebrow">02 / VISSZATÖLTÉS</span><h2>Folytasd, ahol tartottál</h2><p>Válassz egy korábban letöltött SAA Studio JSON mentést. Először ellenőrizzük; a csere csak külön megerősítéssel történik.</p><form data-form="restore-preview" class="stack"><label>Mentésfájl<input type="file" name="file" accept=".json,application/json" required></label><button class="button secondary">Mentés ellenőrzése</button></form></section></div>${pendingRestore?`<section class="card restore-confirm"><h2>Visszatöltés előnézete</h2><p>A kiválasztott fájl <strong>${pendingRestore.questions.length} kérdést</strong> és <strong>${pendingRestore.attempts.length} gyakorlást</strong> tartalmaz.</p><p>A visszatöltés lecseréli az ebben a böngészőben tárolt kérdéseket és eredményeket. Előtte töltsd le a jelenlegi adataidat.</p><div class="action-row">${btn('export-backup','Jelenlegi adatok mentése ↓','button secondary')}${btn('restore-confirm','Igen, lecserélem és visszatöltöm','button')}${btn('restore-cancel','Mégse','text-button')}</div></section>`:''}<section class="card settings-card storage-help"><h2>Hogyan maradnak meg az adataim?</h2><p>Az alkalmazás minden beküldött válasz után helyben ment. Az oldal bezárása és a frissítés nem törli a mentést. A még be nem küldött válaszkijelölés nem kerül mentésre.</p><p>A „Tárhely megőrzésének kérése” segíthet csökkenteni az automatikus törlés esélyét, ha a böngésződ támogatja. A kézi törlés ellen ez sem véd.</p>${btn('persist','Tárhely megőrzésének kérése','button secondary')}<p>A CSV export csak a kérdésbankot menti. A statisztikákhoz mindig a teljes JSON mentést használd.</p></section>`;
}
async function render(){
  if(!db)return;const current=++epoch;const r=route(),[path,query='']=r.split('?');
  try{
    await load();let html;
    if(path==='/')html=dashboard();
    else if(path==='/admin')html=admin(new URLSearchParams(query));
    else if(path==='/settings')html=await settings();
    else if(path==='/history')html=`<div class="page-heading"><div><span class="eyebrow">A TE HALADÁSOD</span><h1>Gyakorlási előzmények</h1></div>${link('/','← Áttekintés')}</div><div class="history-list">${[...attempts].sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).map(historyItem).join('')||'<p>Még nincs elkezdett gyakorlás.</p>'}</div>`;
    else if(path.startsWith('/practice/'))html=practice(decodeURIComponent(path.slice(10)));
    else if(path.startsWith('/question/'))html=editor(decodeURIComponent(path.slice(10)));
    else html=`<section class="card empty"><h1>Ez az oldal nem található.</h1>${link('/','Vissza a főoldalra →','button')}</section>`;
    if(current!==epoch)return;main.innerHTML=html;
    document.querySelectorAll('[data-nav]').forEach(a=>{const on=a.dataset.nav===(path.startsWith('/admin')||path.startsWith('/question')?'admin':path==='/settings'?'settings':'home');if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  }catch(error){if(current===epoch)failure(error);}
}
main.addEventListener('change',event=>{
  if(event.target.name==='answer'){
    const form=event.target.form,count=form.querySelectorAll('[name="answer"]:checked').length,wanted=Number(form.dataset.count);
    form.querySelector('button').disabled=count!==wanted;document.querySelector('#selected-count').textContent=`${count} / ${wanted} válasz kijelölve · Kiértékelés a kör végén.`;
  }
  if(event.target.id==='mistakes-only')document.querySelectorAll('.review-item.is-correct').forEach(item=>item.hidden=event.target.checked);
});
main.addEventListener('submit',async event=>{
  const form=event.target;if(!form.dataset.form)return;event.preventDefault();messageBox.hidden=true;const submit=form.querySelector('button');if(submit.disabled)return;submit.disabled=true;
  try{
    const data=new FormData(form);
    if(form.dataset.form==='answer'){
      await storage.answer(db,form.dataset.id,Number(form.dataset.index),data.getAll('answer').map(Number));await render();window.scrollTo({top:0});
    }else if(form.dataset.form==='search')to('/admin?'+new URLSearchParams({q:data.get('q'),status:data.get('status')}));
    else if(form.dataset.form==='question'){
      const id=form.dataset.id,q=id==='new'?{}:questions.find(q=>q.id===id);const raw=Array.from({length:8},(_,i)=>String(data.get('option'+i)||'').trim());
      const indexes=raw.map((o,i)=>o?i:-1).filter(i=>i>=0),selected=data.getAll('correct').map(Number);
      if(selected.some(i=>!raw[i]))throw Error('Üres válaszlehetőség nem jelölhető helyesnek.');
      const next={...q,id:id==='new'?crypto.randomUUID():id,question:String(data.get('question')).trim(),options:indexes.map(i=>raw[i]),correct:selected.map(i=>indexes.indexOf(i)),explanation:String(data.get('explanation')).trim(),active:data.has('active'),rawKey:q.rawKey||''};
      await storage.saveQuestion(db,next);to('/admin');message('Kérdés elmentve ebben a böngészőben.');
    }else if(form.dataset.form==='import'){
      const file=data.get('file');if(file.size>10*1024*1024)throw Error('A CSV legfeljebb 10 MB lehet.');
      const parsed=parseCSV(await file.text());const rows=await Promise.all(parsed.questions.map(async q=>({...q,id:await questionId(q.question)})));
      const result=await storage.importQuestions(db,rows);await render();message(`Importálva: ${result.added}. Ismétlődés kihagyva: ${result.skipped+parsed.duplicates}. Üres sor: ${parsed.empty}. Javítandó új kérdés: ${result.review}.`);
    }else if(form.dataset.form==='restore-preview'){
      const file=data.get('file');if(file.size>100*1024*1024)throw Error('A mentésfájl legfeljebb 100 MB lehet.');
      let value;try{value=JSON.parse(await file.text());}catch{throw Error('Nem olvasható JSON mentés. Az adataid változatlanok.');}
      pendingRestore=validateBackup(value);await render();document.querySelector('.restore-confirm').scrollIntoView({behavior:'smooth'});
    }
  }catch(error){failure(error);}finally{submit.disabled=false;}
});
main.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;messageBox.hidden=true;button.disabled=true;
  try{
    switch(button.dataset.action){
      case 'start-daily':case 'start-free':{
        const a=await storage.start(db,button.dataset.action==='start-daily'?'daily':'free');to(attemptLink(a));break;
      }
      case 'export-csv':download('saa-c03-kerdesek.csv',exportCSV(await storage.all(db,'questions')),'text/csv;charset=utf-8');message('A CSV export elkészült. A statisztikákat a teljes JSON mentés tartalmazza.');break;
      case 'export-backup':{
        const data=await storage.backup(db);download(`saa-studio-mentes-${dayKey()}-${Date.now()}.json`,JSON.stringify(data),'application/json');await storage.setMeta(db,'lastExport',new Date().toISOString());if(route()==='/settings')await render();message('A mentésfájl letöltése elindult. Őrizd meg a Letöltések között.');break;
      }
      case 'restore-confirm':if(pendingRestore){await storage.restore(db,pendingRestore);pendingRestore=null;await render();message('A mentés sikeresen visszatöltve.');}break;
      case 'restore-cancel':pendingRestore=null;await render();break;
      case 'persist':{
        if(!navigator.storage?.persist){message('Ez a böngésző nem támogatja a külön tárhelymegőrzési kérést. A fájlos biztonsági mentés továbbra is használható.');break;}
        const ok=await navigator.storage.persist();message(ok?'A böngésző engedélyezte a tárhely megőrzését. A biztonsági mentés továbbra is ajánlott.':'A böngésző nem adott külön tárhelymegőrzési engedélyt. Használd a letölthető biztonsági mentést.');break;
      }
    }
  }catch(error){failure(error);}finally{button.disabled=false;}
});
document.querySelector('.skip').addEventListener('click',event=>{event.preventDefault();main.focus();});
window.addEventListener('hashchange',()=>{render();window.scrollTo({top:0});});
window.addEventListener('pageshow',event=>{if(event.persisted)render();});
async function init(){
  try{
    if(!globalThis.indexedDB)throw Error('Ez a böngésző nem engedélyezi a helyi adatmentést. Nyisd meg normál Safari, Chrome vagy Firefox böngészőlapon.');
    db=await storage.openDB();
    if(!await storage.get(db,'meta','seeded')){
      const response=await fetch('/questions.json');if(!response.ok)throw Error('A kérdésbank nem tölthető be. Frissítsd az oldalt.');
      const bank=await response.json();await storage.seed(db,bank.questions);
    }
    await render();
  }catch(error){main.innerHTML=`<section class="card error-card"><h1>Nem sikerült megnyitni a gyakorlást.</h1><p>${e(error.message)}</p><p>Az alkalmazás nem folytatja a gyakorlást mentés nélkül. Próbáld meg normál böngészőlapon, engedélyezett webhelytárhellyel.</p><a class="button" href="/">Újrapróbálás</a></section>`;}
}
init();
