import 'fake-indexeddb/auto';import {test} from 'node:test';import assert from 'node:assert/strict';
import * as storage from '../web/db.mjs';import {score,questionIssue} from '../web/core.mjs';
const fixture=()=>Array.from({length:40},(_,i)=>({id:'q'+i,question:`Question ${i} (Choose two.)`,options:['Alpha','Beta','Gamma'],correct:[0,2],issue:'',active:true,explanation:'',rawKey:'',sourceLine:null}));
async function fresh(){const name=crypto.randomUUID(),db=await storage.openDB(name);await storage.seed(db,fixture());return {db,name};}
test('concurrent tabs receive the same daily attempt; next day gets another',async()=>{
 const {db}=await fresh();const now=new Date('2026-11-10T10:00:00Z');
 const [a,b,c]=await Promise.all(Array.from({length:3},()=>storage.start(db,'daily',now)));assert.equal(a.id,b.id);assert.equal(b.id,c.id);
 const next=await storage.start(db,'daily',new Date('2026-11-11T10:00:00Z'));assert.notEqual(next.id,a.id);assert.equal((await storage.all(db,'attempts')).length,2);db.close();
});
test('concurrent identical submissions consume only one answer',async()=>{
 const {db}=await fresh(),a=await storage.start(db,'free');
 await Promise.all([storage.answer(db,a.id,0,[0,2]),storage.answer(db,a.id,0,[0,2])]);const saved=await storage.get(db,'attempts',a.id);assert.equal(saved.answers.length,1);db.close();
});
test('reopening storage preserves progress and edited questions; seed never overwrites',async()=>{
 let {db,name}=await fresh();const a=await storage.start(db,'daily');await storage.answer(db,a.id,0,[0,2]);
 const q=fixture()[0];q.question='My edited question (Choose two.)';q.active=false;await storage.saveQuestion(db,q);db.close();db=await storage.openDB(name);await storage.seed(db,fixture());
 assert.equal((await storage.get(db,'questions','q0')).question,q.question);assert.equal((await storage.get(db,'attempts',a.id)).answers.length,1);db.close();
});
test('existing daily remains available when bank has too few active questions',async()=>{
 const {db}=await fresh(),a=await storage.start(db,'daily');for(const q of fixture())await storage.saveQuestion(db,{...q,active:false});assert.equal((await storage.start(db,'daily')).id,a.id);await assert.rejects(()=>storage.start(db,'free'));db.close();
});
test('backup restores full records atomically and invalid restore leaves old records intact',async()=>{
 const {db}=await fresh();let a=await storage.start(db,'free');for(let i=0;i<30;i++)a=await storage.answer(db,a.id,i,[0,2]);
 const old=await storage.backup(db),other=await fresh();await storage.restore(other.db,old);const restored=await storage.backup(other.db);assert.deepEqual(restored.attempts,old.attempts);assert.equal(score(restored.attempts[0]),30);
 const bad=structuredClone(old);bad.attempts[0].answers[0]=[77,88];assert.throws(()=>storage.restore(other.db,bad));assert.deepEqual((await storage.backup(other.db)).attempts,old.attempts);db.close();other.db.close();
});
test('imports skip duplicates and keep invalid new questions inactive',async()=>{
 const {db}=await fresh(),q={...fixture()[0],id:'new',question:'A new question (Choose three.)'};q.issue=questionIssue(q);q.active=false;
 const r=await storage.importQuestions(db,[fixture()[0],q]);assert.deepEqual(r,{added:1,skipped:1,review:1});assert.equal((await storage.all(db,'questions')).length,41);db.close();
});
