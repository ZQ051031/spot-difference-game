// A tiny static server for game/ (Node 22, standard library only), so an
// entry can be played locally without a build step:
//   node serve.ts [--port 8080]
// It serves only files inside game/, answers with the content type a
// browser game needs, and never caches. This is a development convenience,
// not a server for the open internet.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));

function chosenPort() {
  const flag = process.argv.indexOf('--port');
  const wanted = flag === -1 ? 8080 : Number(process.argv[flag + 1]);
  return Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;
}

const byExtension = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.glb', 'model/gltf-binary'],
  ['.gltf', 'model/gltf+json'],
  ['.bin', 'application/octet-stream'],
  ['.wasm', 'application/wasm'],
  ['.wav', 'audio/wav'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function insideRoot(candidate) {
  return candidate === gameRoot || candidate.startsWith(gameRoot + sep);
}

function failWith(response, code, message) {
  response.writeHead(code, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(message);
}

async function handle(request, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    failWith(response, 400, 'bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(gameRoot, normalize(pathname)));
  if (!insideRoot(file)) {
    failWith(response, 403, 'forbidden');
    return;
  }
  let info;
  try {
    info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
  } catch {
    failWith(response, 404, 'not found');
    return;
  }
  response.writeHead(200);
  response.setHeader('content-type', byExtension.get(extname(file).toLowerCase()) ?? 'application/octet-stream');
  response.setHeader('content-length', info.size);
  response.setHeader('cache-control', 'no-store');
  createReadStream(file).pipe(response);
}

const port = chosenPort();
const server = createServer((request, response) => {
  handle(request, response).catch(() => {
    if (!response.headersSent) response.writeHead(500).end('error');
    else response.end();
  });
});
server.listen(port, '127.0.0.1', () => {
  console.log(`game/ is on http://localhost:${port}`);
});
