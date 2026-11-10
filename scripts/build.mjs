import {readFile,mkdir,writeFile,cp,rm} from 'node:fs/promises';
import {parseCSV,questionId} from '../web/core.mjs';
const {questions,empty,duplicates}=parseCSV(await readFile(new URL('../data/questions.csv',import.meta.url),'utf8'));
for(const q of questions)q.id=await questionId(q.question);
const out=new URL('../dist/',import.meta.url);await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
await cp(new URL('../web/',import.meta.url),out,{recursive:true});
await writeFile(new URL('questions.json',out),JSON.stringify({version:1,questions}));
await mkdir(new URL('admin/',out),{recursive:true});await cp(new URL('index.html',out),new URL('admin/index.html',out));
console.log(`Built: ${questions.length} questions, ${questions.filter(q=>q.active).length} active, ${questions.filter(q=>q.issue).length} review; ${empty} empty rows, ${duplicates} duplicates skipped.`);
