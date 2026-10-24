const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function composeCommand() {
  const candidates = ['docker'];
  // Existing VS Code terminals may retain the PATH from before Desktop installation.
  if (process.platform === 'win32') {
    candidates.push(path.join(process.env.LOCALAPPDATA || '', 'Programs/DockerDesktop/resources/bin/docker.exe'));
    candidates.push(path.join(process.env.ProgramFiles || 'C:/Program Files', 'Docker/Docker/resources/bin/docker.exe'));
  }
  for (const binary of candidates) {
    const docker = spawnSync(binary, ['compose', 'version'], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    if (docker.status === 0) return { binary, prefix: ['compose'] };
  }
  const standalone = path.join(root, '.runtime/tools/docker-compose.exe');
  if (process.platform === 'win32' && fs.existsSync(standalone)) return { binary: standalone, prefix: [] };
  throw new Error('Không tìm thấy Docker Compose. Cài Docker Desktop và mở lại terminal.');
}
function compose(args, options = {}) {
  const { binary, prefix } = composeCommand();
  const env = { ...process.env };
  if (path.isAbsolute(binary)) {
    const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
    env[pathKey] = path.dirname(binary) + path.delimiter + (env[pathKey] || '');
  }
  return spawnSync(binary, [...prefix, '-f', path.join(root, 'compose.yaml'), ...args],
    { cwd: root, encoding: 'utf8', windowsHide: true, env, maxBuffer: 8 * 1024 * 1024, ...options });
}
module.exports = { compose, composeCommand };
