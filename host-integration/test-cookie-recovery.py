"""Account-free fixture tests for the explicitly approved repair utility."""
import importlib.util
import sqlite3
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('repair', Path(__file__).with_name('recover-loopback-cookies.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as folder:
    source = Path(folder) / 'Cookies'
    backup = Path(folder) / 'backup.sqlite'
    rows = [('127.0.0.1','dsh-auth-test','fixture',''),('kimi.com','dsh-auth-test','website',''),('127.0.0.1','other','keep',''),('localhost','dsh-auth-test','keep',''),('127.0.0.1','dsh-authXtest','keep','')]
    db = sqlite3.connect(source)
    db.execute('create table cookies(host_key text,name text,value text,encrypted_value blob)')
    db.executemany('insert into cookies values(?,?,?,?)',rows)
    db.commit()
    db.close()
    assert module.repair(source, backup) == 1
    db = sqlite3.connect(source)
    assert db.execute('select * from cookies').fetchall() == rows[1:]
    db.close()
    db = sqlite3.connect(backup)
    assert db.execute('select * from cookies').fetchall() == rows
    db.close()
    assert backup.stat().st_mode & 0o777 == 0o600
    unused = Path(folder) / 'unused'
    assert module.repair(source, unused) == 0
    assert not unused.exists()
print('Cookie recovery: exact scope, unrelated cookies, complete/private backup and no-op checks passed.')
