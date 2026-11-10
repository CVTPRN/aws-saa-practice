import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {parseCSV,csvRows,exportCSV,questionId,questionIssue,dayKey,makeAttempt,answerAttempt,score,statistics,validateBackup,FORMAT,VERSION,escape} from '../web/core.mjs';
export const fixture=()=>Array.from({length:40},(_,i)=>({id:'q'+i,question:`Question ${i} (Choose two.)`,options:['Alpha','Beta','Gamma'],correct:[0,2],issue:'',active:true,explanation:'',rawKey:'',sourceLine:null}));
const makeBackup=(questions,attempts=[])=>({format:FORMAT,version:VERSION,questions,attempts});
test('original CSV produces the reviewed question bank',async()=>{
 const result=parseCSV(await readFile(new URL('../data/questions.csv',import.meta.url),'utf8'));
 assert.equal(result.questions.length,982);assert.equal(result.questions.filter(q=>q.active).length,972);assert.equal(result.questions.filter(q=>q.issue).length,10);assert.equal(result.empty,37);assert.equal(result.duplicates,6);
});
test('CSV handles BOM, quotes, commas, multiline options and semicolons inside answers',()=>{
 const raw='\uFEFFquestion,correct_answer,option1,option2,option3\r\n"Pick (Choose two.)","A; B; C","A; B",C,"Line 1,\nLine ""2"""\r\n';
 const q=parseCSV(raw).questions[0];assert.deepEqual(q.correct,[0,1]);assert.equal(q.options[2],'Line 1,\nLine "2"');assert.equal(q.issue,'');
 assert.throws(()=>csvRows('a,b\n"broken'));
});
test('CSV roundtrip includes activation and explanations',()=>{
 const questions=fixture();questions[2].active=false;questions[3].explanation='More detail, with "quotes"';
 const result=parseCSV(exportCSV(questions)).questions;
 assert.equal(result[2].active,false);assert.equal(result[3].explanation,questions[3].explanation);assert.deepEqual(result[4].correct,[0,2]);
});
test('Budapest days across UTC midnight and DST transitions',()=>{
 assert.equal(dayKey(new Date('2026-11-10T23:30:00Z')),'2026-11-11');
 assert.equal(dayKey(new Date('2026-07-01T22:30:00Z')),'2026-07-02');
 assert.equal(dayKey(new Date('2026-03-29T00:30:00Z')),'2026-03-29');
 assert.equal(dayKey(new Date('2026-10-25T01:30:00Z')),'2026-10-25');
});
test('30 distinct random active questions and independent snapshots',()=>{
 const qs=fixture();qs[0].active=false;qs[1].issue='Review';const a=makeAttempt(qs,'free'),b=makeAttempt(qs,'free');
 assert.equal(a.snapshot.length,30);assert.equal(new Set(a.snapshot.map(q=>q.id)).size,30);assert.ok(a.snapshot.every(q=>q.id!=='q0'&&q.id!=='q1'));assert.notDeepEqual(a.snapshot,b.snapshot);assert.notEqual(a.id,b.id);
 qs.forEach(q=>q.question='Edited');assert.notEqual(a.snapshot[0].question,'Edited');assert.throws(()=>makeAttempt(qs.slice(0,29),'daily'));
});
test('exact multi-answer grading, stale replay prevention and completion day',()=>{
 const now=new Date('2026-11-10T22:59:00Z');let a=makeAttempt(fixture(),'daily',now);
 assert.throws(()=>answerAttempt(a,0,[0],now));assert.throws(()=>answerAttempt(a,0,[0,9],now));assert.throws(()=>answerAttempt(a,0,[0,0],now));
 a=answerAttempt(a,0,[0,1],now);a=answerAttempt(a,0,[0,2],now);assert.equal(a.answers.length,1);assert.equal(score(a),0);
 for(let i=1;i<30;i++)a=answerAttempt(a,i,[2,0],new Date('2026-11-10T23:01:00Z'));
 assert.equal(score(a),29);assert.equal(a.day,'2026-11-10');assert.equal(a.completedDay,'2026-11-11');assert.equal(answerAttempt(a,30,[0,2]),a);
 const s=statistics([a],a.completedDay);assert.equal(s.accuracy,97);assert.equal(s.days[0].day,'2026-11-11');assert.equal(s.streak,1);
});
test('backup validation normalizes data and rejects corrupt attempts before mutation',()=>{
 let a=makeAttempt(fixture(),'daily');a=answerAttempt(a,0,[2,0]);
 const backup=makeBackup(fixture(),[a]);assert.equal(validateBackup(backup).attempts[0].answers.length,1);
 for(const modify of [v=>v.version=99,v=>v.attempts.push(v.attempts[0]),v=>v.questions.push(v.questions[0]),v=>v.attempts[0].answers[0]=[99],v=>v.attempts[0].snapshot.pop(),v=>v.attempts[0].completedAt=new Date().toISOString(),v=>v.attempts[0].startedAt='invalid']){const broken=structuredClone(backup);modify(broken);assert.throws(()=>validateBackup(broken));}
 const other=structuredClone(a);other.id='different';assert.throws(()=>validateBackup(makeBackup(fixture(),[a,other])));
});
test('HTML text is escaped and question IDs stable',async()=>{
 assert.equal(escape('<script>"&'), '&lt;script&gt;&quot;&amp;');assert.equal(await questionId('same'),await questionId('same'));assert.notEqual(await questionId('same'),await questionId('other'));
 assert.ok(questionIssue({...fixture()[0],correct:[0]}));
});
