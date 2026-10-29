"""Read-only by default. --apply requires explicit user approval and closed desktop apps."""
import argparse
import os
import sqlite3
import subprocess
from datetime import datetime, timezone
from pathlib import Path

HOST = '127.0.0.1'
PREFIX = 'dsh-auth-'

def inventory(db):
    return db.execute('select count(*),coalesce(sum(length(name)+max(length(value),length(encrypted_value))+2),0) from cookies where host_key=? and substr(name,1,?)=?', (HOST, len(PREFIX), PREFIX)).fetchone()

def repair(path, backup):
    """Back up a closed database, then remove only exact loopback auth records."""
    db = sqlite3.connect(str(path))
    try:
        count, size = inventory(db)
        if not count:
            return 0
        fd = os.open(backup, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(fd)
        destination = sqlite3.connect(str(backup))
        try:
            db.backup(destination)
        finally:
            destination.close()
        # Holding a transaction prevents local concurrent writers during verification.
        db.execute('begin immediate')
        before = db.execute('select count(*) from cookies').fetchone()[0]
        db.execute('delete from cookies where host_key=? and substr(name,1,?)=?', (HOST, len(PREFIX), PREFIX))
        after = db.execute('select count(*) from cookies').fetchone()[0]
        if before - after != count or inventory(db)[0] != 0:
            db.rollback()
            raise RuntimeError('Cookie scope verification failed')
        db.commit()
        return count
    finally:
        db.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='Only after explicit user approval')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    path = Path.home() / 'Library/Application Support/@deepseek-ai/dsh-desktop/Cookies'
    db = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
    print(dict(zip(('loopbackAuthCookies', 'approximateHeaderBytes'), inventory(db))))
    db.close()
    if args.apply:
        processes = subprocess.check_output(['/bin/ps', '-axo', 'comm='], text=True).splitlines()
        forbidden = ['/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness', str(root / '.local-host/DeepSeek Harness Workbench.app/Contents/MacOS/Workbench')]
        if any(p.strip() in forbidden for p in processes):
            raise RuntimeError('Quit both original and local desktop apps normally before repair')
        folder = root / '.local-host/recovery'
        folder.mkdir(mode=0o700, parents=True, exist_ok=True)
        backup = folder / ('Cookies-before-loopback-repair-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.sqlite')
        count = repair(path, backup)
        print({'removedLoopbackAuthCookies': count, 'backup': str(backup) if count else None, 'websiteCookiesAndBusinessDataUntouched': True})
