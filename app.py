import csv
import functools
import hashlib
import io
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from flask import Flask, abort, flash, g, redirect, render_template, request, session, url_for, Response
from werkzeug.security import check_password_hash, generate_password_hash

ROOT = Path(__file__).parent
ZONE = ZoneInfo('Europe/Budapest')


def today():
    return datetime.now(ZONE).date().isoformat()


def validate_question(question, options, correct):
    issues = []
    if not question.strip(): issues.append('Hiányzó kérdésszöveg.')
    if len(options) < 2 or len(options) > 8 or any(not x.strip() for x in options): issues.append('2–8 nem üres válasz szükséges.')
    if len(set(options)) != len(options): issues.append('Ismétlődő válaszlehetőség.')
    if not correct or any(type(i) is not int or i < 0 or i >= len(options) for i in correct): issues.append('Hiányzó vagy hibás válaszkulcs.')
    match = re.search(r'(?:choose|select)\s+(two|three|four|five|six|[2-6])', question, re.I)
    if match:
        count = {'two':2,'three':3,'four':4,'five':5,'six':6}.get(match[1].lower(), int(match[1]) if match[1].isdigit() else 0)
        if count != len(correct): issues.append(f'A szöveg {count} választ kér, a kulcsban {len(correct)} van.')
    return ' '.join(issues)


def parse_csv(text):
    reader = csv.DictReader(io.StringIO(text.lstrip('\ufeff')))
    if not {'question','correct_answer','option1','option2'} <= set(reader.fieldnames or []):
        raise ValueError('A CSV fejlécében question, correct_answer, option1 és option2 szükséges.')
    result = []
    for line, row in enumerate(reader, 2):
        if line > 10002: raise ValueError('Legfeljebb 10 000 kérdés importálható egyszerre.')
        question = (row.get('question') or '').strip()
        if not question: continue
        options = [(row.get(f'option{i}') or '').strip() for i in range(1,9) if (row.get(f'option{i}') or '').strip()]
        raw = (row.get('correct_answer') or '').strip()
        # Match whole option texts. Semicolons inside an option remain intact.
        def match_key(rest, used):
            rest = rest.strip()
            if not rest: return used
            for i, option in sorted(enumerate(options), key=lambda x: -len(x[1])):
                if i in used or not rest.startswith(option): continue
                tail = rest[len(option):].strip()
                if tail and not tail.startswith(';'): continue
                found = match_key(tail[1:] if tail else '', used+[i])
                if found is not None: return found
            return None
        matched = match_key(raw, [])
        correct = sorted(matched or [])
        issue = validate_question(question, options, correct)
        if matched is None: issue += ' A válaszkulcs nem illeszthető a lehetőségekhez.'
        result.append(dict(question=question, options=options, correct=correct, issue=issue.strip(), raw=raw, line=line))
    if not result: raise ValueError('A fájl nem tartalmaz kérdéseket.')
    return result


def create_app(config=None):
    app = Flask(__name__)
    production = bool(os.environ.get('RENDER'))
    secret = os.environ.get('SECRET_KEY')
    if production and not secret: raise RuntimeError('SECRET_KEY is required')
    app.config.update(SECRET_KEY=secret or secrets.token_hex(32), DATABASE=os.environ.get('DATABASE_PATH', str(ROOT/'instance/practice.db')),
                      SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='Lax', SESSION_COOKIE_SECURE=production,
                      PERMANENT_SESSION_LIFETIME=timedelta(days=7), MAX_CONTENT_LENGTH=8*1024*1024,
                      SETUP_TOKEN=os.environ.get('ADMIN_SETUP_TOKEN',''), SEED=True)
    if config: app.config.update(config)
    Path(app.config['DATABASE']).parent.mkdir(parents=True, exist_ok=True)

    def db():
        if 'db' not in g:
            g.db = sqlite3.connect(app.config['DATABASE'], timeout=20)
            g.db.row_factory = sqlite3.Row
            g.db.execute('PRAGMA foreign_keys=ON')
        return g.db

    @app.teardown_appcontext
    def close_db(error=None):
        conn = g.pop('db',None)
        if conn: conn.close()

    def import_rows(rows):
        added=skipped=review=0
        for r in rows:
            fingerprint=hashlib.sha256(r['question'].encode()).hexdigest()
            cur=db().execute('INSERT OR IGNORE INTO questions (fingerprint,question,options,correct,issue,active,raw_key,source_line) VALUES (?,?,?,?,?,?,?,?)',
                (fingerprint,r['question'],json.dumps(r['options']),json.dumps(r['correct']),r['issue'],int(not r['issue']),r['raw'],r['line']))
            if cur.rowcount: added+=1; review+=bool(r['issue'])
            else: skipped+=1
        return added,skipped,review

    with app.app_context():
        db().execute('PRAGMA journal_mode=WAL')
        db().executescript('''
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY,value TEXT);
        CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,password TEXT NOT NULL,is_admin INTEGER NOT NULL DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY,fingerprint TEXT UNIQUE NOT NULL,question TEXT NOT NULL,options TEXT NOT NULL,correct TEXT NOT NULL,issue TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1,explanation TEXT NOT NULL DEFAULT '',raw_key TEXT,source_line INTEGER);
        CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),mode TEXT NOT NULL,day TEXT NOT NULL,snapshot TEXT NOT NULL,answers TEXT NOT NULL DEFAULT '{}',started_at REAL NOT NULL,completed_at REAL,completed_day TEXT,score INTEGER);
        CREATE UNIQUE INDEX IF NOT EXISTS one_daily ON attempts(user_id,day) WHERE mode='daily';
        CREATE INDEX IF NOT EXISTS attempts_user ON attempts(user_id,completed_day);
        CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset REAL NOT NULL);
        ''')
        if app.config['SEED'] and not db().execute("SELECT 1 FROM meta WHERE key='seed_v1'").fetchone():
            db().execute('BEGIN IMMEDIATE')
            if not db().execute("SELECT 1 FROM meta WHERE key='seed_v1'").fetchone():
                import_rows(parse_csv((ROOT/'data/questions.csv').read_text(encoding='utf-8-sig')))
                db().execute("INSERT INTO meta VALUES ('seed_v1','done')")
            db().commit()

    @app.before_request
    def before():
        g.user = db().execute('SELECT id,username,is_admin FROM users WHERE id=?',(session.get('uid'),)).fetchone()
        if 'csrf' not in session: session['csrf']=secrets.token_urlsafe(32)
        if request.method == 'POST':
            token=request.form.get('csrf','')
            if not secrets.compare_digest(token,session['csrf']): abort(400, 'A munkamenet lejárt. Frissítsd az oldalt.')

    @app.after_request
    def headers(response):
        response.headers['X-Content-Type-Options']='nosniff'
        response.headers['X-Frame-Options']='DENY'
        response.headers['Referrer-Policy']='same-origin'
        response.headers['Content-Security-Policy']="default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
        if request.path != '/health' and not request.path.startswith('/static/'): response.headers['Cache-Control']='no-store'
        if production: response.headers['Strict-Transport-Security']='max-age=31536000'
        return response

    def auth(admin=False):
        def decorate(fn):
            @functools.wraps(fn)
            def wrapper(*args,**kwargs):
                if not g.user: return redirect(url_for('login'))
                if admin and not g.user['is_admin']: abort(403)
                return fn(*args,**kwargs)
            return wrapper
        return decorate

    def throttle(kind, limit=12, seconds=900):
        # Render app runs one worker; SQLite counters also survive restarts.
        key=hashlib.sha256(f'{kind}:{request.remote_addr}'.encode()).hexdigest()
        now=time.time()
        db().execute('DELETE FROM limits WHERE reset < ?', (now,))
        db().execute('INSERT INTO limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1',(key,now+seconds))
        row=db().execute('SELECT count FROM limits WHERE key=?',(key,)).fetchone()
        db().commit()
        if row['count']>limit: abort(429,'Túl sok próbálkozás. Próbáld újra 15 perc múlva.')

    def credentials():
        username=request.form.get('username','').strip()
        password=request.form.get('password','')
        if not re.fullmatch(r'[a-zA-Z0-9_.-]{3,32}',username): raise ValueError('A felhasználónév 3–32 betű, szám, pont, kötőjel vagy aláhúzás lehet.')
        if not 12<=len(password)<=128: raise ValueError('A jelszó 12–128 karakter legyen.')
        return username,password

    def sign_in(uid):
        session.clear(); session['uid']=uid; session['csrf']=secrets.token_urlsafe(32); session.permanent=True

    @app.route('/login',methods=['GET','POST'])
    def login():
        if request.method=='POST':
            throttle('login')
            user=db().execute('SELECT * FROM users WHERE username=?',(request.form.get('username','').strip(),)).fetchone()
            password=request.form.get('password','')
            if user and len(password)<=128 and check_password_hash(user['password'],password):
                sign_in(user['id']); return redirect(url_for('dashboard'))
            flash('Hibás felhasználónév vagy jelszó.','error')
        return render_template('auth.html',mode='login')

    @app.route('/register',methods=['GET','POST'])
    def register():
        if request.method=='POST':
            throttle('register',6)
            try:
                username,password=credentials()
                cur=db().execute('INSERT INTO users(username,password) VALUES (?,?)',(username,generate_password_hash(password)))
                db().commit(); sign_in(cur.lastrowid); return redirect(url_for('dashboard'))
            except ValueError as e: flash(str(e),'error')
            except sqlite3.IntegrityError: db().rollback(); flash('Ez a felhasználónév már foglalt.','error')
        return render_template('auth.html',mode='register')

    @app.route('/setup',methods=['GET','POST'])
    def setup():
        if db().execute('SELECT 1 FROM users WHERE is_admin=1').fetchone(): abort(404)
        if request.method=='POST':
            throttle('setup',6)
            expected=app.config['SETUP_TOKEN']
            if not expected or not secrets.compare_digest(expected,request.form.get('setup_token','')): abort(403)
            try:
                username,password=credentials()
                db().execute('BEGIN IMMEDIATE')
                if db().execute('SELECT 1 FROM users WHERE is_admin=1').fetchone(): abort(409)
                cur=db().execute('INSERT INTO users(username,password,is_admin) VALUES (?,?,1)',(username,generate_password_hash(password)))
                db().commit(); sign_in(cur.lastrowid); return redirect(url_for('admin'))
            except ValueError as e: flash(str(e),'error')
            except sqlite3.IntegrityError: db().rollback(); flash('Foglalt felhasználónév. Válassz külön adminnevet.','error')
        return render_template('auth.html',mode='setup')

    @app.post('/logout')
    def logout():
        session.clear(); return redirect(url_for('login'))

    @app.route('/account',methods=['GET','POST'])
    @auth()
    def account():
        if request.method=='POST':
            throttle('password')
            user=db().execute('SELECT * FROM users WHERE id=?',(g.user['id'],)).fetchone()
            if not check_password_hash(user['password'],request.form.get('current_password','')): flash('Hibás jelenlegi jelszó.','error')
            elif not 12<=len(request.form.get('password',''))<=128: flash('Az új jelszó 12–128 karakter legyen.','error')
            else:
                db().execute('UPDATE users SET password=? WHERE id=?',(generate_password_hash(request.form['password']),g.user['id']))
                db().commit(); sign_in(g.user['id']); flash('Jelszó módosítva.','success')
        return render_template('account.html')

    @app.get('/')
    @auth()
    def dashboard():
        uid=g.user['id']
        attempts=db().execute('SELECT * FROM attempts WHERE user_id=? AND completed_at IS NOT NULL ORDER BY completed_at DESC',(uid,)).fetchall()
        days={}
        for a in attempts:
            d=days.setdefault(a['completed_day'],{'date':a['completed_day'],'sessions':0,'correct':0,'total':0,'daily':False})
            d['sessions']+=1; d['correct']+=a['score']; d['total']+=len(json.loads(a['snapshot'])); d['daily']|=a['mode']=='daily'
        for d in days.values(): d['percent']=round(100*d['correct']/d['total'])
        calendar=[]
        for offset in range(27,-1,-1):
            day=(datetime.now(ZONE).date()-timedelta(days=offset)).isoformat()
            calendar.append(days.get(day,{'date':day,'sessions':0,'percent':0}))
        streak=0; cursor=datetime.now(ZONE).date()
        if cursor.isoformat() not in days: cursor-=timedelta(days=1)
        while cursor.isoformat() in days: streak+=1; cursor-=timedelta(days=1)
        total=sum(d['total'] for d in days.values()); correct=sum(d['correct'] for d in days.values())
        daily=db().execute("SELECT * FROM attempts WHERE user_id=? AND mode='daily' AND day=?",(uid,today())).fetchone()
        active=db().execute("SELECT * FROM attempts WHERE user_id=? AND completed_at IS NULL ORDER BY started_at DESC LIMIT 5",(uid,)).fetchall()
        return render_template('dashboard.html',attempts=attempts[:12],days=list(days.values()),calendar=calendar,streak=streak,total=total,accuracy=round(100*correct/total) if total else None,daily=daily,active=active,today=today(),bank=db().execute('SELECT COUNT(*) FROM questions WHERE active=1 AND issue=""').fetchone()[0])

    @app.post('/practice/start')
    @auth()
    def start():
        mode=request.form.get('mode')
        if mode not in ('daily','free'): abort(400)
        db().execute('BEGIN IMMEDIATE')
        if mode=='daily':
            existing=db().execute("SELECT id FROM attempts WHERE user_id=? AND mode='daily' AND day=?",(g.user['id'],today())).fetchone()
            if existing: db().commit(); return redirect(url_for('practice',aid=existing['id']))
        pool=db().execute('SELECT * FROM questions WHERE active=1 AND issue=""').fetchall()
        if len(pool)<30:
            db().rollback(); flash('Legalább 30 aktív, ellenőrzött kérdés szükséges.','error'); return redirect(url_for('dashboard'))
        picked=secrets.SystemRandom().sample(pool,30)
        snapshot=[dict(id=q['id'],question=q['question'],options=json.loads(q['options']),correct=json.loads(q['correct']),explanation=q['explanation']) for q in picked]
        aid=secrets.token_urlsafe(18)
        db().execute('INSERT INTO attempts(id,user_id,mode,day,snapshot,started_at) VALUES (?,?,?,?,?,?)',(aid,g.user['id'],mode,today(),json.dumps(snapshot),time.time()))
        db().commit(); return redirect(url_for('practice',aid=aid))

    def get_attempt(aid):
        a=db().execute('SELECT * FROM attempts WHERE id=? AND user_id=?',(aid,g.user['id'])).fetchone()
        if not a: abort(404)
        return a,json.loads(a['snapshot']),json.loads(a['answers'])

    @app.route('/practice/<aid>',methods=['GET','POST'])
    @auth()
    def practice(aid):
        if request.method=='POST': db().execute('BEGIN IMMEDIATE')
        a,questions,answers=get_attempt(aid)
        if a['completed_at'] is not None:
            if request.method=='POST': db().commit()
            return redirect(url_for('result',aid=aid))
        index=len(answers)
        if request.method=='POST':
            if request.form.get('index')!=str(index):
                db().rollback(); return redirect(url_for('practice',aid=aid))
            try: selected=sorted(set(int(x) for x in request.form.getlist('answer')))
            except ValueError: abort(400)
            q=questions[index]
            if len(selected)!=len(q['correct']) or any(i<0 or i>=len(q['options']) for i in selected):
                db().rollback(); flash(f'Pontosan {len(q["correct"])} választ jelölj meg.','error')
            else:
                answers[str(index)]=selected
                db().execute('UPDATE attempts SET answers=? WHERE id=?',(json.dumps(answers),aid))
                if len(answers)==len(questions):
                    score=sum(answers[str(i)]==sorted(q['correct']) for i,q in enumerate(questions))
                    db().execute('UPDATE attempts SET score=?,completed_at=?,completed_day=? WHERE id=?',(score,time.time(),today(),aid))
                db().commit(); return redirect(url_for('practice',aid=aid))
        return render_template('practice.html',a=a,q=questions[index],index=index,total=len(questions))

    @app.get('/results/<aid>')
    @auth()
    def result(aid):
        a,questions,answers=get_attempt(aid)
        if a['completed_at'] is None: return redirect(url_for('practice',aid=aid))
        review=[dict(q=q,selected=answers[str(i)],ok=answers[str(i)]==sorted(q['correct'])) for i,q in enumerate(questions)]
        return render_template('result.html',a=a,review=review,percent=round(a['score']*100/len(questions)))

    @app.get('/admin')
    @auth(True)
    def admin():
        search=request.args.get('q','').strip(); status=request.args.get('status','all')
        where='WHERE question LIKE ?'; params=['%'+search+'%']
        if status=='review': where+=' AND issue!=""'
        if status=='active': where+=' AND active=1 AND issue=""'
        try: page=max(1,int(request.args.get('page',1)))
        except ValueError: page=1
        count=db().execute('SELECT COUNT(*) FROM questions '+where,params).fetchone()[0]
        rows=db().execute('SELECT * FROM questions '+where+' ORDER BY id LIMIT 30 OFFSET ?',params+[(page-1)*30]).fetchall()
        stats=db().execute('SELECT COUNT(*) total,SUM(active=1 AND issue="") active,SUM(issue!="") review FROM questions').fetchone()
        return render_template('admin.html',rows=rows,stats=stats,search=search,status=status,page=page,pages=max(1,(count+29)//30))

    @app.route('/admin/questions/new',methods=['GET','POST'])
    @app.route('/admin/questions/<int:qid>',methods=['GET','POST'])
    @auth(True)
    def edit(qid=None):
        row=db().execute('SELECT * FROM questions WHERE id=?',(qid,)).fetchone() if qid else None
        if qid and not row: abort(404)
        q=dict(row) if row else dict(question='',options='[]',correct='[]',explanation='',active=1,issue='',raw_key='')
        q['options']=json.loads(q['options']); q['correct']=json.loads(q['correct'])
        if request.method=='POST':
            options=[request.form.get(f'option{i}','').strip() for i in range(8)]
            selected=request.form.getlist('correct'); remap={i:j for j,i in enumerate(i for i,o in enumerate(options) if o)}
            correct=sorted({remap[int(i)] for i in selected if i.isdigit() and int(i) in remap})
            options=[o for o in options if o]
            question=request.form.get('question','').strip(); issue=validate_question(question,options,correct)
            q.update(question=question,options=options,correct=correct,explanation=request.form.get('explanation','').strip(),active=int('active' in request.form),issue=issue)
            if len(question)>20000 or any(len(o)>10000 for o in options): issue='Túl hosszú kérdés vagy válasz.'
            if issue: flash(issue,'error')
            else:
                fingerprint=hashlib.sha256(question.encode()).hexdigest()
                values=(fingerprint,question,json.dumps(options),json.dumps(correct),q['explanation'],q['active'])
                try:
                    if qid: db().execute('UPDATE questions SET fingerprint=?,question=?,options=?,correct=?,explanation=?,active=?,issue="" WHERE id=?',values+(qid,))
                    else: db().execute('INSERT INTO questions(fingerprint,question,options,correct,explanation,active) VALUES (?,?,?,?,?,?)',values)
                    db().commit(); flash('Kérdés elmentve.','success'); return redirect(url_for('admin'))
                except sqlite3.IntegrityError: db().rollback(); flash('Ez a kérdés már szerepel a kérdésbankban.','error')
        return render_template('edit.html',q=q,qid=qid)

    @app.post('/admin/import')
    @auth(True)
    def upload():
        file=request.files.get('file')
        if not file: abort(400)
        try:
            rows=parse_csv(file.read().decode('utf-8-sig'))
            added,skipped,review=import_rows(rows); db().commit()
            flash(f'Importálva: {added}. Ismétlődés kihagyva: {skipped}. Javítandó: {review}.','success')
        except (UnicodeError,ValueError,csv.Error) as e: db().rollback(); flash(f'Sikertelen import: {e}','error')
        return redirect(url_for('admin'))

    @app.get('/admin/export')
    @auth(True)
    def export():
        output=io.StringIO(); writer=csv.writer(output)
        writer.writerow(['question','correct_answer']+[f'option{i}' for i in range(1,9)])
        for q in db().execute('SELECT * FROM questions ORDER BY id'):
            options=json.loads(q['options']); correct=json.loads(q['correct'])
            writer.writerow([q['question'],q['raw_key'] if q['issue'] else '; '.join(options[i] for i in correct)]+options+['']*(8-len(options)))
        return Response('\ufeff'+output.getvalue(),mimetype='text/csv',headers={'Content-Disposition':'attachment; filename=questions.csv'})

    @app.get('/health')
    def health():
        db().execute('SELECT 1').fetchone(); return {'status':'ok'}

    @app.errorhandler(400)
    @app.errorhandler(403)
    @app.errorhandler(404)
    @app.errorhandler(409)
    @app.errorhandler(413)
    @app.errorhandler(429)
    def error(e): return render_template('error.html',code=e.code,message=e.description),e.code

    return app

if __name__=='__main__':
    create_app().run(host='0.0.0.0',port=int(os.environ.get('PORT',5000)))
