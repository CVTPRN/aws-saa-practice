export const FORMAT = 'saa-studio-backup';
export const VERSION = 1;
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const dayKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Budapest', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date);
  const part = name => parts.find(p => p.type === name).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
export function addDays(day, n) { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
export const sameAnswer = (a,b) => a.length===b.length && [...a].sort((x,y)=>x-y).every((v,i)=>v===[...b].sort((x,y)=>x-y)[i]);
export const score = attempt => attempt.snapshot.reduce((sum,q,i)=>sum+Number(sameAnswer(attempt.answers[i] || [],q.correct)),0);
export function questionIssue(q) {
  const errors=[];
  if (!q.question?.trim()) errors.push('Hiányzó kérdésszöveg.');
  if (q.options.length<2 || q.options.length>8 || q.options.some(v=>!v.trim())) errors.push('2–8 nem üres válasz szükséges.');
  if (new Set(q.options).size!==q.options.length) errors.push('Ismétlődő válaszlehetőség.');
  if (!q.correct.length || new Set(q.correct).size!==q.correct.length || q.correct.some(i=>!Number.isInteger(i)||i<0||i>=q.options.length)) errors.push('Hiányzó vagy hibás válaszkulcs.');
  const match=q.question.match(/(?:choose|select)\s+(two|three|four|five|six|[2-6])/i);
  if (match) {
    const count=({two:2,three:3,four:4,five:5,six:6})[match[1].toLowerCase()] || Number(match[1]);
    if (count!==q.correct.length) errors.push(`A szöveg ${count} választ kér, a kulcsban ${q.correct.length} van.`);
  }
  return errors.join(' ');
}
export function csvRows(text) {
  const rows=[]; let row=[], value='', quoted=false, closed=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) {
      if(c==='"' && text[i+1]==='"'){value+='"';i++;}
      else if(c==='"'){quoted=false;closed=true;} else value+=c;
    } else if(c==='"' && !value && !closed) quoted=true;
    else if(c===',' || c==='\n' || c==='\r') {
      row.push(value);value='';closed=false;
      if(c!==','){rows.push(row);row=[];if(c==='\r' && text[i+1]==='\n')i++;}
    } else {
      if(closed && c.trim()) throw Error('Hibás CSV: váratlan karakter az idézőjel után.');
      if(!closed)value+=c;
    }
  }
  if(quoted)throw Error('Hibás CSV: lezáratlan idézőjel.');
  if(value || row.length || closed){row.push(value);rows.push(row);}
  return rows;
}
export function parseCSV(text) {
  const [headers,...rows]=csvRows(text);
  if(!headers || !['question','correct_answer','option1','option2'].every(k=>headers.includes(k))) throw Error('Hiányzó fejléc: question, correct_answer, option1, option2 szükséges.');
  if(rows.length>10000)throw Error('Egyszerre legfeljebb 10 000 sor importálható.');
  const questions=[]; let empty=0,duplicates=0; const seen=new Set();
  rows.forEach((row,index)=>{
    if(row.every(v=>!v.trim())){empty++;return;}
    const data=Object.fromEntries(headers.map((h,i)=>[h,(row[i]||'').trim()]));
    if(seen.has(data.question)){duplicates++;return;} seen.add(data.question);
    const options=Array.from({length:8},(_,i)=>data[`option${i+1}`]||'').filter(Boolean);
    function matchKey(rest,used=[]){
      rest=rest.trim();if(!rest)return used;
      for(const i of options.map((_,i)=>i).sort((a,b)=>options[b].length-options[a].length)){
        if(used.includes(i)||!rest.startsWith(options[i]))continue;
        const tail=rest.slice(options[i].length).trim(); if(tail && !tail.startsWith(';'))continue;
        const found=matchKey(tail?tail.slice(1):'',[...used,i]);if(found)return found;
      }
      return null;
    }
    const matches=matchKey(data.correct_answer);
    const q={question:data.question,options,correct:(matches||[]).sort((a,b)=>a-b),explanation:data.explanation||'',rawKey:data.correct_answer,sourceLine:index+2};
    q.issue=questionIssue(q)+(matches===null?' A válaszkulcs nem illeszthető a lehetőségekhez.':'');
    q.issue=q.issue.trim();q.active=!q.issue && data.active!=='false';questions.push(q);
  });
  if(!questions.length)throw Error('Nincs importálható kérdés.');
  return {questions,empty,duplicates};
}
export async function questionId(text) {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return 'q-'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export function exportCSV(questions) {
  const quote=s=>'"'+String(s??'').replaceAll('"','""')+'"';
  return '\uFEFF'+[['question','correct_answer',...Array.from({length:8},(_,i)=>`option${i+1}`),'explanation','active'],...questions.map(q=>[q.question,q.issue?q.rawKey:q.correct.map(i=>q.options[i]).join('; '),...Array.from({length:8},(_,i)=>q.options[i]||''),q.explanation,String(q.active)])].map(row=>row.map(quote).join(',')).join('\r\n');
}
function randomIndex(max) {
  const limit=2**32-(2**32%max);const buf=new Uint32Array(1);
  do{crypto.getRandomValues(buf);}while(buf[0]>=limit);
  return buf[0]%max;
}
export function makeAttempt(questions,mode,now=new Date()) {
  if(!['daily','free'].includes(mode))throw Error('Ismeretlen gyakorlási mód.');
  const pool=questions.filter(q=>q.active && !questionIssue(q) && !q.issue);
  if(pool.length<30)throw Error('Legalább 30 aktív, érvényes kérdés szükséges.');
  for(let i=pool.length-1;i>0;i--){const j=randomIndex(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
  const day=dayKey(now);
  return {id:crypto.randomUUID(),mode,day,...(mode==='daily'?{dailyKey:day}:{}),snapshot:structuredClone(pool.slice(0,30)),answers:[],startedAt:now.toISOString(),completedAt:null,completedDay:null};
}
export function answerAttempt(attempt,index,selected,now=new Date()) {
  if(attempt.completedAt || attempt.answers.length!==index)return attempt; // Replay/stale tab: never consume the next question.
  const q=attempt.snapshot[index];
  if(!Array.isArray(selected)||new Set(selected).size!==selected.length||selected.length!==q.correct.length||selected.some(i=>!Number.isInteger(i)||i<0||i>=q.options.length))throw Error(`Pontosan ${q.correct.length} választ jelölj meg.`);
  const next=structuredClone(attempt);next.answers.push([...selected].sort((a,b)=>a-b));
  if(next.answers.length===30){next.completedAt=now.toISOString();next.completedDay=dayKey(now);}
  return next;
}
export function statistics(attempts,today=dayKey()) {
  const finished=attempts.filter(a=>a.completedAt).sort((a,b)=>b.completedAt.localeCompare(a.completedAt));const map=new Map();
  for(const a of finished){
    const d=map.get(a.completedDay)||{day:a.completedDay,sessions:0,correct:0,total:0,daily:false};
    d.sessions++;d.correct+=score(a);d.total+=a.snapshot.length;d.daily||=a.mode==='daily';map.set(d.day,d);
  }
  const days=[...map.values()].sort((a,b)=>b.day.localeCompare(a.day)).map(d=>({...d,percent:Math.round(d.correct*100/d.total)}));
  let streak=0, cursor=map.has(today)?today:addDays(today,-1);
  while(map.has(cursor)){streak++;cursor=addDays(cursor,-1);}
  const total=days.reduce((n,d)=>n+d.total,0),correct=days.reduce((n,d)=>n+d.correct,0);
  const calendar=Array.from({length:28},(_,i)=>{const day=addDays(today,i-27);return days.find(d=>d.day===day)||{day,sessions:0,percent:0};});
  return {days,finished,calendar,streak,total,accuracy:total?Math.round(correct*100/total):null};
}
const fail=()=>{throw Error('Hibás vagy nem támogatott biztonsági mentés. Az adataid változatlanok.');};
const text=(s,max=20000)=>typeof s==='string' && s.length<=max;
const iso=s=>text(s,40)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&Number.isFinite(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
export function normalizeQuestion(q) {
  if(!q || !text(q.id,100)||!q.id||!text(q.question)||!Array.isArray(q.options)||q.options.length>8||q.options.some(o=>!text(o,10000))||!Array.isArray(q.correct)||q.correct.length>8||q.correct.some(i=>!Number.isInteger(i)||i<0||i>=q.options.length)||new Set(q.correct).size!==q.correct.length||!text(q.explanation||'',20000)||!text(q.rawKey||'',100000)||typeof q.active!=='boolean')fail();
  const clean={id:q.id,question:q.question,options:[...q.options],correct:[...q.correct],explanation:q.explanation||'',rawKey:q.rawKey||'',sourceLine:Number.isInteger(q.sourceLine)?q.sourceLine:null,active:q.active};
  clean.issue=questionIssue(clean);if(clean.issue)clean.active=false;
  return clean;
}
export function validateBackup(value) {
  if(!value||value.format!==FORMAT||value.version!==VERSION||!Array.isArray(value.questions)||value.questions.length<1||value.questions.length>10000||!Array.isArray(value.attempts)||value.attempts.length>10000)fail();
  const questions=value.questions.map(normalizeQuestion),ids=new Set(),dailies=new Set();
  if(new Set(questions.map(q=>q.id)).size!==questions.length)fail();
  const attempts=value.attempts.map(a=>{
    if(!a||!text(a.id,100)||!a.id||ids.has(a.id)||!['daily','free'].includes(a.mode)||!date(a.day)||!iso(a.startedAt)||dayKey(new Date(a.startedAt))!==a.day||!Array.isArray(a.snapshot)||a.snapshot.length!==30||!Array.isArray(a.answers)||a.answers.length>30)fail();ids.add(a.id);
    if(a.mode==='daily'){if(dailies.has(a.day))fail();dailies.add(a.day);}
    const snapshot=a.snapshot.map(normalizeQuestion);if(snapshot.some(q=>q.issue)||new Set(snapshot.map(q=>q.id)).size!==30)fail();
    const answers=a.answers.map((selected,i)=>{if(!Array.isArray(selected)||selected.length!==snapshot[i].correct.length||new Set(selected).size!==selected.length||selected.some(v=>!Number.isInteger(v)||v<0||v>=snapshot[i].options.length))fail();return [...selected].sort((x,y)=>x-y);});
    if(answers.length===30){if(!iso(a.completedAt)||Date.parse(a.completedAt)<Date.parse(a.startedAt)||a.completedDay!==dayKey(new Date(a.completedAt)))fail();}
    else if(a.completedAt!=null||a.completedDay!=null)fail();
    return {id:a.id,mode:a.mode,day:a.day,...(a.mode==='daily'?{dailyKey:a.day}:{}),snapshot,answers,startedAt:a.startedAt,completedAt:a.completedAt||null,completedDay:a.completedDay||null};
  });
  return {format:FORMAT,version:VERSION,questions,attempts};
}
