#!/usr/bin/env node
// PostToolUse hook: git push origin master 감지 → 자동 semver 태그 (minor 증가)
const chunks = [];
process.stdin.on('data', d => chunks.push(d));
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(Buffer.concat(chunks).toString());
    const cmd = (j.tool_input && j.tool_input.command) || '';

    if (!/git push\b/.test(cmd) || !/\bmaster\b/.test(cmd) || /--tags\b/.test(cmd)) {
      process.exit(0);
    }

    const { execSync } = require('child_process');
    const opts = { encoding: 'utf8', cwd: 'C:/Users/kimsa/OneDrive/Desktop/cs-quiz' };

    const raw = execSync('git tag -l', opts);
    const tags = raw.split('\n')
      .map(t => t.trim())
      .filter(t => /^v\d+\.\d+\.\d+$/.test(t))
      .sort((a, b) => {
        const pa = a.slice(1).split('.').map(Number);
        const pb = b.slice(1).split('.').map(Number);
        for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
        return 0;
      });

    const lat = tags[tags.length - 1] || 'v1.0.0';
    const [maj, min] = lat.slice(1).split('.').map(Number);
    const nt = `v${maj}.${min + 1}.0`;

    execSync(`git tag ${nt} HEAD`, opts);
    execSync(`git push origin ${nt}`, opts);
    process.stdout.write(JSON.stringify({ systemMessage: `Auto-tagged ${nt} on master` }));
  } catch (e) {
    process.exit(0);
  }
});
