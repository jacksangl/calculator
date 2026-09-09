const { spawn } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function launchSolver(request, { resources, signal, timeout = 12000 } = {}) {
  const windows = process.platform === 'win32';
  const executable = resources
    ? path.join(resources, 'equation-solver', `equation-solver${windows ? '.exe' : ''}`)
    : path.join(root, '.venv', windows ? 'Scripts/python.exe' : 'bin/python');
  const args = resources ? [] : [path.join(root, 'solver/engine.py')];
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let output = '', settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      error ? reject(error) : resolve(value);
    };
    const cancel = () => { child.kill(); finish(new Error('Calculation cancelled.')); };
    const timer = setTimeout(() => { child.kill(); finish(new Error('Calculation timed out. Try numerical mode or a simpler expression.')); }, timeout);
    signal?.addEventListener('abort', cancel, { once: true });
    child.on('error', error => finish(new Error(error.code === 'ENOENT' ? 'Math engine is missing. Run npm run setup:solver during development.' : error.message)));
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.length > 2_000_000) { child.kill(); finish(new Error('The result is too large to display.')); }
    });
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.on('close', () => {
      if (settled) return;
      try {
        const result = JSON.parse(output);
        if (!result.ok) throw new Error(result.error);
        finish(null, result.data);
      } catch (error) { finish(new Error(error.message || 'Math engine stopped unexpectedly.')); }
    });
    child.stdin.end(JSON.stringify(request));
    if (signal?.aborted) cancel();
  });
}
class SolverWorker {
  constructor({ resources } = {}) {
    this.resources = resources;
    this.child = null;
    this.pending = null;
    this.tail = Promise.resolve();
    this.closed = false;
  }

  start() {
    if (this.child) return;
    if (this.closed) throw new Error('Math engine is closed.');
    const windows = process.platform === 'win32';
    const executable = this.resources
      ? path.join(this.resources, 'equation-solver', `equation-solver${windows ? '.exe' : ''}`)
      : path.join(root, '.venv', windows ? 'Scripts/python.exe' : 'bin/python');
    const args = this.resources ? ['--server'] : [path.join(root, 'solver/engine.py'), '--server'];
    const child = this.child = spawn(executable, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    let buffer = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      if (this.child !== child) return;
      buffer += chunk;
      if (buffer.length > 2_000_000) { this.reset(new Error('The result is too large to display.')); return; }
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        try {
          const result = JSON.parse(line);
          this.pending?.(result.ok ? null : new Error(result.error), result.data);
        } catch { this.reset(new Error('The math engine returned an invalid response.')); }
      }
    });
    child.stderr.resume();
    child.stdin.on('error', () => {});
    child.on('error', error => { if (this.child === child) this.reset(new Error(error.code === 'ENOENT' ? 'Math engine is missing. Run npm run setup:solver.' : error.message)); });
    child.on('close', () => { if (this.child === child) this.reset(new Error('The math engine stopped. Please try again.')); });
  }

  reset(error) {
    const child = this.child; this.child = null;
    child?.kill(); this.pending?.(error);
  }

  request(request, { signal, timeout = 12000 } = {}) {
    // ponytail: one serial worker; add a worker pool only for concurrent worksheets.
    const next = this.tail.then(() => {
      if (signal?.aborted) throw new Error('Calculation cancelled.');
      this.start();
      return new Promise((resolve, reject) => {
        const abort = () => this.reset(new Error('Calculation cancelled.'));
        const timer = setTimeout(() => this.reset(new Error('Calculation timed out. Try numerical mode or a simpler expression.')), timeout);
        const done = (error, value) => {
          if (this.pending !== done) return;
          this.pending = null; clearTimeout(timer); signal?.removeEventListener('abort', abort);
          error ? reject(error) : resolve(value);
        };
        this.pending = done;
        signal?.addEventListener('abort', abort, { once: true });
        try {
          const input = JSON.stringify(request);
          if (input.length > 100000) throw new Error('Request too large.');
          this.child.stdin.write(input + '\n');
        } catch (error) { done(error); }
      });
    });
    this.tail = next.catch(() => {});
    return next;
  }

  close() { this.closed = true; this.reset(new Error('Math engine closed.')); }
}
module.exports = { launchSolver, SolverWorker };
