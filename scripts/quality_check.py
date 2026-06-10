#!/usr/bin/env python3
"""Stop hook: package.json이 있을 때만 lint/build/test를 모두 실행한다."""
import subprocess
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

ROOT = Path(__file__).resolve().parent.parent

if not (ROOT / 'package.json').exists():
    print('[quality] package.json 없음 - 품질 검사 스킵')
    sys.exit(0)

cmds = ['npm run lint', 'npm run build', 'npm run test']
failed = []

for cmd in cmds:
    result = subprocess.run(cmd, shell=True, cwd=str(ROOT))
    if result.returncode != 0:
        failed.append(cmd)

if failed:
    print(f'\n[quality] 실패한 검사: {", ".join(failed)}')
    sys.exit(1)

print('[quality] 모든 검사 통과')
