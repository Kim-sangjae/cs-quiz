#!/usr/bin/env python3
"""PreToolUse hook: Bash 명령어에서 위험한 패턴을 감지하면 차단한다."""
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

DANGEROUS = re.compile(
    r'rm\s+-rf|git\s+push\s+--force|git\s+reset\s+--hard|DROP\s+TABLE',
    re.IGNORECASE,
)

tool_input = os.environ.get('CLAUDE_TOOL_INPUT', '')
if DANGEROUS.search(tool_input):
    print('BLOCKED: 위험한 명령어가 감지되었습니다.', file=sys.stderr)
    sys.exit(1)
