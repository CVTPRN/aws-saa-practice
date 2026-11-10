import csv
import io
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import pytest
from werkzeug.security import generate_password_hash
import app as module

@pytest.fixture
def app(tmp_path):
    return module.create_app({'TESTING':True,'DATABASE':str(tmp_path/'test.db'),'SECRET_KEY':'test-only','SETUP_TOKEN':'test-setup','SESSION_COOKIE_SECURE':False})

@pytest.fixture
def client(app): return app.test_client()

def post(c,path,data=None):
    c.get('/login')
    with c.session_transaction() as s: token=s['csrf']
    return c.post(path,data={'csrf':token,**(data or {})})

def register(c,name='tester'):
    return post(c,'/register',{'username':name,'password':'test-password-1234'})

def connection(app):
    conn=sqlite3.connect(app.config['DATABASE']); conn.row_factory=sqlite3.Row; return conn

def test_seed_validation_and_idempotence(app):
    with connection(app) as db:
        total=db.execute('SELECT COUNT(*) FROM questions').fetchone()[0]
        active=db.execute('SELECT COUNT(*) FROM questions WHERE active=1').fetchone()[0]
        assert total>900 and 900<active<total
        assert db.execute('SELECT COUNT(*) FROM questions WHERE issue!="" AND active=1').fetchone()[0]==0
    module.create_app(dict(app.config))
    with connection(app) as db: assert db.execute('SELECT COUNT(*) FROM questions').fetchone()[0]==total

def test_auth_csrf_and_admin(app,client):
    assert client.post('/register',data={'username':'bad'}).status_code==400
    assert register(client).status_code==302
    assert client.get('/').status_code==200
    assert client.get('/admin').status_code==403
    assert client.get('/admin/export').status_code==403
    assert post(client,'/admin/import').status_code==403
    with connection(app) as db:
        user=db.execute('SELECT * FROM users').fetchone()
        assert user['is_admin']==0 and user['password']!='test-password-1234'
    post(client,'/logout')
    assert post(client,'/login',{'username':'tester','password':'wrong'}).status_code==200
    assert post(client,'/login',{'username':'tester','password':'test-password-1234'}).status_code==302

def test_setup_requires_token_and_closes(app,client):
    assert post(client,'/setup',{'username':'owner','password':'long-password-123','setup_token':'wrong'}).status_code==403
    assert post(client,'/setup',{'username':'owner','password':'long-password-123','setup_token':'test-setup'}).status_code==302
    assert client.get('/admin').status_code==200
    assert client.get('/setup').status_code==404
    assert client.get('/admin/questions/new').status_code==200

def test_daily_scoring_resume_ownership_and_stats(app,client):
    register(client)
    first=post(client,'/practice/start',{'mode':'daily'}).location
    assert post(client,'/practice/start',{'mode':'daily'}).location==first
    aid=first.rsplit('/',1)[1]
    with connection(app) as db: snapshot=json.loads(db.execute('SELECT snapshot FROM attempts WHERE id=?',(aid,)).fetchone()[0])
    assert len(snapshot)==30 and len({q['id'] for q in snapshot})==30
    # Bad and absent answers cannot consume a question.
    assert post(client,first,{'index':'0','answer':'999'}).status_code==200
    for i,q in enumerate(snapshot):
        if i==0:
            html=client.get(first).get_data(as_text=True)
            assert 'correct_answer' not in html and '"correct"' not in html
        answer=[str(x) for x in q['correct']]
        assert post(client,first,{'index':str(i),'answer':answer}).status_code==302
        if i==0: # Stale duplicate submission must not answer the next question.
            post(client,first,{'index':'0','answer':answer})
            with connection(app) as db: assert len(json.loads(db.execute('SELECT answers FROM attempts WHERE id=?',(aid,)).fetchone()[0]))==1
    page=client.get('/results/'+aid)
    assert page.status_code==200 and '100<span>%' in page.get_data(as_text=True)
    with connection(app) as db:
        a=db.execute('SELECT * FROM attempts WHERE id=?',(aid,)).fetchone()
        assert a['score']==30 and a['completed_day']==module.today()
    assert client.get('/').status_code==200
    assert post(client,'/practice/start',{'mode':'daily'}).location==first
    other=app.test_client(); register(other,'another')
    assert other.get(first).status_code==404
    assert other.get('/results/'+aid).status_code==404
    assert post(other,first,{'index':'0','answer':'0'}).status_code==404

def test_free_random_sets_and_snapshot(app,client):
    register(client)
    a=post(client,'/practice/start',{'mode':'free'}).location
    b=post(client,'/practice/start',{'mode':'free'}).location
    assert a!=b
    with connection(app) as db:
        rows=db.execute('SELECT snapshot FROM attempts').fetchall()
        assert rows[0][0]!=rows[1][0]
        q=json.loads(rows[0][0])[0]
        db.execute('UPDATE questions SET question="Changed" WHERE id=?',(q['id'],)); db.commit()
    assert q['question'][:40] in client.get(a).get_data(as_text=True)

def test_import_edit_export_and_escaping(app,client):
    post(client,'/setup',{'username':'owner','password':'long-password-123','setup_token':'test-setup'})
    data={'question':'<script>alert(1)</script> New question','option0':'Alpha','option1':'Beta','correct':'1','active':'on'}
    assert post(client,'/admin/questions/new',data).status_code==302
    with connection(app) as db: qid=db.execute('SELECT MAX(id) FROM questions').fetchone()[0]
    html=client.get('/admin/questions/'+str(qid)).get_data(as_text=True)
    assert '&lt;script&gt;' in html and '<script>alert(1)</script>' not in html
    exported=client.get('/admin/export').get_data(as_text=True)
    parsed=module.parse_csv(exported)
    assert any(r['question']==data['question'] and r['correct']==[1] for r in parsed)
    data['question']='Multi (Choose two.)'; data['correct']='0'
    assert post(client,'/admin/questions/new',data).status_code==200
    raw='question,correct_answer,option1,option2\nImported,Yes,Yes,No\n'
    res=post(client,'/admin/import',{'file':(io.BytesIO(raw.encode()),'test.csv')})
    assert res.status_code==302
    with connection(app) as db: assert db.execute('SELECT COUNT(*) FROM questions WHERE question="Imported"').fetchone()[0]==1

def test_semicolon_parser():
    raw='question,correct_answer,option1,option2,option3\n"Pick (Choose two.)","A; B; C","A; B",C,D\n'
    q=module.parse_csv(raw)[0]
    assert q['correct']==[0,1] and not q['issue']

def test_daily_rollover_and_concurrency(app,client,monkeypatch):
    register(client)
    monkeypatch.setattr(module,'today',lambda:'2026-11-10')
    first=post(client,'/practice/start',{'mode':'daily'}).location
    monkeypatch.setattr(module,'today',lambda:'2026-11-11')
    second=post(client,'/practice/start',{'mode':'daily'}).location
    assert first!=second
    def create_daily(_):
        c=app.test_client()
        with c.session_transaction() as s: s['uid']=1; s['csrf']='token'
        return c.post('/practice/start',data={'csrf':'token','mode':'daily'}).location
    with ThreadPoolExecutor(max_workers=4) as pool: assert set(pool.map(create_daily,range(4)))=={second}

def test_health_headers_and_rate_limit(client):
    r=client.get('/health'); assert r.json=={'status':'ok'}
    assert r.headers['X-Frame-Options']=='DENY'
    for _ in range(12): post(client,'/login',{'username':'nope','password':'nope'})
    assert post(client,'/login',{'username':'nope','password':'nope'}).status_code==429

def test_multi_answer_exact_match_and_no_partial_credit(app,client):
    register(client)
    path=post(client,'/practice/start',{'mode':'free'}).location
    aid=path.rsplit('/',1)[1]
    # Deterministic fixture guarantees the multi-answer branch, then completes a round.
    questions=[{'id':i,'question':'Choose two.','options':['A','B','C'],'correct':[0,1],'explanation':''} for i in range(30)]
    with connection(app) as db:
        db.execute('UPDATE attempts SET snapshot=? WHERE id=?',(json.dumps(questions),aid)); db.commit()
    assert post(client,path,{'index':'0','answer':['0']}).status_code==200
    with connection(app) as db: assert db.execute('SELECT answers FROM attempts WHERE id=?',(aid,)).fetchone()[0]=='{}'
    for i in range(30): post(client,path,{'index':str(i),'answer':['0','2'] if i==0 else ['1','0']})
    with connection(app) as db: assert db.execute('SELECT score FROM attempts WHERE id=?',(aid,)).fetchone()[0]==29
    html=client.get('/results/'+aid).get_data(as_text=True)
    assert 'is-wrong' in html and '97<span>%' in html

def test_restarts_preserve_users_progress_and_admin_edits(app,client):
    register(client)
    path=post(client,'/practice/start',{'mode':'daily'}).location
    with connection(app) as db:
        a=db.execute('SELECT * FROM attempts').fetchone()
        first=json.loads(a['snapshot'])[0]
        db.execute('UPDATE questions SET active=0,explanation="Persist this" WHERE id=2'); db.commit()
    post(client,path,{'index':'0','answer':[str(i) for i in first['correct']]})
    module.create_app(dict(app.config))
    with connection(app) as db:
        assert db.execute('SELECT COUNT(*) FROM users').fetchone()[0]==1
        assert len(json.loads(db.execute('SELECT answers FROM attempts').fetchone()[0]))==1
        q=db.execute('SELECT active,explanation FROM questions WHERE id=2').fetchone()
        assert tuple(q)==(0,'Persist this')
