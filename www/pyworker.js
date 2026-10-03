/* OneDSA Python runner: runs inside a Web Worker so an endless loop never freezes the app. */
let py = null;
const dec = new TextDecoder();
self.onmessage = async (e) => {
  const { id, code, stdin } = e.data;
  try {
    if (!py) {
      postMessage({ id, type: 'status', text: 'Starting Python (first run only)…' });
      importScripts('pyodide/pyodide.js');
      py = await loadPyodide({ indexURL: new URL('pyodide/', self.location.href).href });
    }
    const lines = stdin ? stdin.split('\n') : [];
    let li = 0;
    const send = (buf) => { postMessage({ id, type: 'out', text: dec.decode(buf) }); return buf.length; };
    py.setStdout({ write: send });
    py.setStderr({ write: send });
    py.setStdin({ stdin: () => (li < lines.length ? lines[li++] : undefined) });
    postMessage({ id, type: 'running' });
    const ns = py.globals.get('dict')();
    try { await py.runPythonAsync(code, { globals: ns }); } finally { ns.destroy(); }
    postMessage({ id, type: 'done' });
  } catch (err) {
    let msg = String(err && err.message ? err.message : err);
    const ls = msg.split('\n');
    const i = ls.findIndex((l) => l.includes('File "<exec>"'));
    if (i >= 0) msg = 'Traceback (most recent call last):\n' + ls.slice(i).join('\n');
    msg = msg.replace(/File "<exec>"/g, 'File "your code"').trim();
    postMessage({ id, type: 'err', text: msg + '\n' });
  }
};
