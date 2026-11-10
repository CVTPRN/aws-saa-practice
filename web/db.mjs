import {makeAttempt,answerAttempt,validateBackup,FORMAT,VERSION,questionIssue,dayKey} from './core.mjs';
export function openDB(name='saa-studio-personal-v1') {
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(name,1);
    r.onupgradeneeded=()=>{
      const db=r.result;
      db.createObjectStore('questions',{keyPath:'id'});
      const a=db.createObjectStore('attempts',{keyPath:'id'});a.createIndex('dailyKey','dailyKey',{unique:true});
      db.createObjectStore('meta',{keyPath:'key'});
    };
    r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Zárd be az alkalmazás többi lapját, majd frissíts.'));
    r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};
  });
}
const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function transaction(db,names,mode,fn){
  const tx=db.transaction(names,mode);const done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('A mentés megszakadt.'));tx.onerror=()=>{};});done.catch(()=>{});
  try{const result=await fn(tx);await done;return result;}catch(e){try{tx.abort();}catch{} await done.catch(()=>{});throw e;}
}
export const all=(db,store)=>transaction(db,[store],'readonly',tx=>req(tx.objectStore(store).getAll()));
export const get=(db,store,key)=>transaction(db,[store],'readonly',tx=>req(tx.objectStore(store).get(key)));
export const setMeta=(db,key,value)=>transaction(db,['meta'],'readwrite',tx=>req(tx.objectStore('meta').put({key,value})));
export async function seed(db,questions){
  return transaction(db,['questions','meta'],'readwrite',async tx=>{
    const meta=tx.objectStore('meta');if(await req(meta.get('seeded')))return;
    const q=tx.objectStore('questions');for(const row of questions)q.put(row);
    meta.put({key:'seeded',value:true});
  });
}
export function start(db,mode,now=new Date()){
  return transaction(db,['questions','attempts'],'readwrite',async tx=>{
    const attempts=tx.objectStore('attempts');
    // Candidate is made inside the transaction: multiple tabs cannot create two daily rounds.
    if(mode==='daily'){const existing=await req(attempts.index('dailyKey').get(dayKey(now)));if(existing)return existing;}
    const questions=await req(tx.objectStore('questions').getAll());
    const candidate=makeAttempt(questions,mode,now);
    await req(attempts.add(candidate));return candidate;
  });
}
export const answer=(db,id,index,selected,now=new Date())=>transaction(db,['attempts'],'readwrite',async tx=>{
  const store=tx.objectStore('attempts'),a=await req(store.get(id));if(!a)throw Error('Ez a gyakorlás nem található.');
  const next=answerAttempt(a,index,selected,now);await req(store.put(next));return next;
});
export const saveQuestion=(db,q)=>transaction(db,['questions'],'readwrite',async tx=>{
  const issue=questionIssue(q);if(issue)throw Error(issue);
  const store=tx.objectStore('questions');const existing=await req(store.getAll());
  if(existing.some(row=>row.id!==q.id&&row.question===q.question))throw Error('Ez a kérdés már szerepel a kérdésbankban.');
  await req(store.put({...q,issue:''}));
});
export const importQuestions=(db,rows)=>transaction(db,['questions'],'readwrite',async tx=>{
  const store=tx.objectStore('questions'),existing=await req(store.getAll());const texts=new Set(existing.map(q=>q.question)),ids=new Set(existing.map(q=>q.id));let added=0,skipped=0,review=0;
  for(const q of rows){if(texts.has(q.question)||ids.has(q.id)){skipped++;continue;}store.add(q);texts.add(q.question);ids.add(q.id);added++;review+=Boolean(q.issue);}
  return {added,skipped,review};
});
export const backup=db=>transaction(db,['questions','attempts'],'readonly',async tx=>({format:FORMAT,version:VERSION,exportedAt:new Date().toISOString(),questions:await req(tx.objectStore('questions').getAll()),attempts:await req(tx.objectStore('attempts').getAll())}));
export function restore(db,input){
  const clean=validateBackup(input); // Validate the entire document before touching storage.
  return transaction(db,['questions','attempts','meta'],'readwrite',async tx=>{
    for(const name of ['questions','attempts']){const s=tx.objectStore(name);s.clear();for(const row of clean[name])s.add(row);}
    tx.objectStore('meta').put({key:'seeded',value:true});
    tx.objectStore('meta').put({key:'lastRestore',value:new Date().toISOString()});
  });
}
