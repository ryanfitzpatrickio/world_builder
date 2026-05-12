import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { defineConfig } from 'vite';
import { WebSocketServer } from 'ws';

const LEVEL_SAVE_DIR = resolve(process.cwd(), 'saved-levels');

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readRequestJson(req) {
  return new Promise((resolveRequest, rejectRequest) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024 * 8) {
        rejectRequest(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolveRequest(body ? JSON.parse(body) : {});
      } catch {
        rejectRequest(new Error('Invalid JSON body'));
      }
    });
    req.on('error', rejectRequest);
  });
}

function ensureSaveDir() {
  if (!existsSync(LEVEL_SAVE_DIR)) mkdirSync(LEVEL_SAVE_DIR, { recursive: true });
}

function safeLevelFilename(name) {
  const raw = basename(String(name || '').trim());
  const base = raw.replace(/\.json$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${base || `level-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}`}.json`;
}

function uniqueLevelFilename(name) {
  const filename = safeLevelFilename(name);
  const ext = extname(filename) || '.json';
  const base = filename.slice(0, -ext.length);
  let candidate = filename;
  let suffix = 2;
  while (existsSync(resolve(LEVEL_SAVE_DIR, candidate))) {
    candidate = `${base}-${suffix}${ext}`;
    suffix += 1;
  }
  return candidate;
}

function levelPathFor(name) {
  const filename = safeLevelFilename(name);
  const filePath = resolve(LEVEL_SAVE_DIR, filename);
  if (!filePath.startsWith(`${LEVEL_SAVE_DIR}/`) && filePath !== LEVEL_SAVE_DIR) {
    throw new Error('Invalid level filename');
  }
  return { filename, filePath };
}

function levelMetadata(filename) {
  const { filePath } = levelPathFor(filename);
  const stats = statSync(filePath);
  let parsed = {};
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    parsed = {};
  }
  const shapes = Array.isArray(parsed.shapes) ? parsed.shapes : [];
  const floors = [...new Set(shapes.map((shape) => shape.floor).filter((floor) => Number.isFinite(floor)))].sort((a, b) => a - b);
  return {
    filename,
    name: parsed.name || filename.replace(/\.json$/i, ''),
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    createdAt: parsed.createdAt || null,
    updatedAt: parsed.updatedAt || null,
    shapeCount: shapes.length,
    floors,
    source: parsed.source || null,
  };
}

function listSavedLevels() {
  ensureSaveDir();
  return readdirSync(LEVEL_SAVE_DIR)
    .filter((file) => extname(file).toLowerCase() === '.json')
    .map((file) => levelMetadata(file))
    .sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
}

function levelFilesMiddleware() {
  return async (req, res) => {
    try {
      ensureSaveDir();
      if (req.method === 'GET') {
        const url = new URL(req.url || '/', 'http://level-maker.local');
        const filename = url.searchParams.get('file');
        if (!filename) {
          sendJson(res, 200, { levels: listSavedLevels(), directory: LEVEL_SAVE_DIR });
          return;
        }

        const { filePath } = levelPathFor(filename);
        if (!existsSync(filePath)) {
          sendJson(res, 404, { error: 'Level file not found' });
          return;
        }
        sendJson(res, 200, {
          metadata: levelMetadata(filename),
          level: JSON.parse(readFileSync(filePath, 'utf8')),
        });
        return;
      }

      if (req.method === 'POST') {
        const body = await readRequestJson(req);
        const level = body.level;
        if (!level || !Array.isArray(level.shapes)) {
          sendJson(res, 400, { error: 'Level payload must include a shapes array' });
          return;
        }

        const now = new Date().toISOString();
        const filename = body.filename ? safeLevelFilename(body.filename) : uniqueLevelFilename(level.name);
        const { filePath } = levelPathFor(filename);
        const existing = existsSync(filePath) ? JSON.parse(readFileSync(filePath, 'utf8')) : {};
        const payload = {
          ...level,
          name: level.name || existing.name || filename.replace(/\.json$/i, ''),
          createdAt: existing.createdAt || level.createdAt || now,
          updatedAt: now,
        };
        await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        sendJson(res, 200, { saved: true, metadata: levelMetadata(filename) });
        return;
      }

      res.statusCode = 405;
      res.setHeader('allow', 'GET, POST');
      res.end('Method Not Allowed');
    } catch (error) {
      sendJson(res, 500, { error: error?.message || 'Level file operation failed' });
    }
  };
}

function getCodexEnv() {
  const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin', `${process.env.HOME}/.local/bin`];
  return { ...process.env, PATH: `${process.env.PATH}:${extraPaths.join(':')}` };
}

function checkCodexAvailability() {
  try {
    const version = execSync('codex --version', {
      encoding: 'utf8',
      timeout: 5000,
      env: getCodexEnv(),
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return { available: true, version };
  } catch {
    return { available: false, error: 'Codex CLI not found. Install it and run "codex login".' };
  }
}

function codexStatusMiddleware() {
  return (req, res) => {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('allow', 'GET');
      res.end('Method Not Allowed');
      return;
    }
    sendJson(res, 200, checkCodexAvailability());
  };
}

function registerCodexWebSocket(server) {
  if (!server.httpServer || server.httpServer.__levelMakerCodexBridgeRegistered) return;
  server.httpServer.__levelMakerCodexBridgeRegistered = true;

  const wss = new WebSocketServer({ noServer: true });
  server.httpServer.on('upgrade', (request, socket, head) => {
    if (request.url !== '/ws/codex') return;
    if (!isAllowedCodexBridgeOrigin(request)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    let session = null;

    ws.on('message', async (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        sendWs(ws, { type: 'error', message: 'Invalid Codex bridge message', fatal: false });
        return;
      }

      if (msg.type === 'start') {
        if (session) cleanupCodexSession(session);
        try {
          session = await startCodexSession(ws, msg);
        } catch (error) {
          sendWs(ws, {
            type: 'error',
            message: error?.message || 'Failed to start Codex',
            fatal: true,
          });
        }
        return;
      }

      if (msg.type === 'tool_result' && session) {
        const rpcId = Number(msg.id);
        if (session.pendingToolCalls.has(rpcId)) {
          session.pendingToolCalls.delete(rpcId);
          sendCodex(session, {
            id: rpcId,
            result: {
              contentItems: [{ type: 'inputText', text: msg.result || '' }],
              success: msg.success !== false,
            },
          });
        }
        return;
      }

      if (msg.type === 'abort' && session) {
        cleanupCodexSession(session);
        session = null;
      }
    });

    ws.on('close', () => {
      if (session) cleanupCodexSession(session);
      session = null;
    });
  });
}

function isAllowedCodexBridgeOrigin(request) {
  const origin = request.headers.origin;
  const host = request.headers.host;
  if (!origin || !host) return false;

  try {
    const originUrl = new URL(origin);
    const requestHost = host.split(':')[0];
    const requestPort = host.split(':')[1] || '';
    const allowedHosts = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
    return allowedHosts.has(originUrl.hostname) && allowedHosts.has(requestHost) && String(originUrl.port || '') === requestPort;
  } catch {
    return false;
  }
}

async function startCodexSession(ws, config) {
  sendWs(ws, { type: 'status', status: 'connecting' });
  const proc = spawn('codex', ['app-server'], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: getCodexEnv(),
  });
  const readline = createInterface({ input: proc.stdout });
  const session = {
    process: proc,
    readline,
    ws,
    requestId: 0,
    pendingRequests: new Map(),
    pendingToolCalls: new Map(),
    agentText: '',
    threadId: config.threadId,
  };

  readline.on('line', (line) => {
    try {
      handleCodexMessage(session, JSON.parse(line));
    } catch {
      // Ignore non-JSON app-server logs.
    }
  });

  proc.on('exit', (code) => {
    if (ws.readyState === ws.OPEN) {
      sendWs(ws, { type: 'error', message: `Codex process exited with code ${code}`, fatal: true });
    }
  });

  await sendCodexRequest(session, 'initialize', {
    clientInfo: { name: 'level-maker', title: 'Level Maker', version: '0.1.0' },
    capabilities: { experimentalApi: true },
  });
  sendCodex(session, { method: 'initialized', params: {} });

  const threadResult = await sendCodexRequest(session, session.threadId ? 'thread/resume' : 'thread/start', {
    ...(session.threadId ? { threadId: session.threadId } : {}),
    model: config.model || 'gpt-5.4',
    baseInstructions: config.systemPrompt || '',
    dynamicTools: Array.isArray(config.tools) ? config.tools : [],
    serviceName: 'level-maker-agent',
  });

  session.threadId = threadResult?.thread?.id || session.threadId;
  if (session.threadId) sendWs(ws, { type: 'thread', threadId: session.threadId });
  sendWs(ws, { type: 'status', status: 'thinking' });
  sendCodex(session, {
    method: 'turn/start',
    id: ++session.requestId,
    params: {
      threadId: session.threadId,
      input: [{ type: 'text', text: config.userMessage || '' }],
    },
  });

  return session;
}

function handleCodexMessage(session, msg) {
  if (msg.id !== undefined && !msg.method) {
    const pending = session.pendingRequests.get(msg.id);
    if (pending) {
      session.pendingRequests.delete(msg.id);
      if (msg.error) pending.reject(new Error(JSON.stringify(msg.error)));
      else pending.resolve(msg.result);
    }
    return;
  }

  if (msg.id !== undefined && msg.method === 'item/tool/call') {
    const params = msg.params || {};
    session.pendingToolCalls.set(msg.id, true);
    sendWs(session.ws, {
      type: 'tool_call',
      id: String(msg.id),
      name: params.tool,
      args: params.arguments || {},
    });
    sendWs(session.ws, { type: 'status', status: 'executing' });
    return;
  }

  if (msg.id !== undefined && (msg.method === 'item/commandExecution/requestApproval' || msg.method === 'item/fileChange/requestApproval')) {
    sendCodex(session, { id: msg.id, result: { decision: 'deny' } });
    return;
  }

  if (!msg.method) return;
  const params = msg.params || {};
  if (msg.method === 'item/agentMessage/delta') {
    const delta = params.delta;
    if (delta) {
      session.agentText += delta;
      sendWs(session.ws, { type: 'delta', text: delta });
    }
    return;
  }
  if (msg.method === 'item/started') {
    if (params.item?.type === 'dynamicToolCall') sendWs(session.ws, { type: 'status', status: 'executing' });
    return;
  }
  if (msg.method === 'item/completed') {
    if (params.item?.type === 'dynamicToolCall') sendWs(session.ws, { type: 'status', status: 'thinking' });
    return;
  }
  if (msg.method === 'turn/completed') {
    sendWs(session.ws, { type: 'turn_complete', text: session.agentText });
    cleanupCodexSession(session);
    return;
  }
  if (msg.method === 'turn/failed') {
    sendWs(session.ws, {
      type: 'error',
      message: params.turn?.error?.message || 'Codex turn failed',
      fatal: true,
    });
    cleanupCodexSession(session);
  }
}

function sendCodex(session, msg) {
  if (session.process.stdin?.writable) session.process.stdin.write(`${JSON.stringify(msg)}\n`);
}

function sendCodexRequest(session, method, params) {
  const id = ++session.requestId;
  return new Promise((resolveRequest, rejectRequest) => {
    session.pendingRequests.set(id, { resolve: resolveRequest, reject: rejectRequest });
    sendCodex(session, { method, id, params });
    setTimeout(() => {
      if (!session.pendingRequests.has(id)) return;
      session.pendingRequests.delete(id);
      rejectRequest(new Error(`Codex request ${method} timed out`));
    }, 30000);
  });
}

function sendWs(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function cleanupCodexSession(session) {
  session.readline.close();
  if (!session.process.killed) {
    session.process.kill('SIGTERM');
    setTimeout(() => {
      if (!session.process.killed) session.process.kill('SIGKILL');
    }, 5000);
  }
  session.pendingRequests.forEach(({ reject }) => reject(new Error('Codex session closed')));
  session.pendingRequests.clear();
  session.pendingToolCalls.clear();
}

function codexBridgePlugin() {
  return {
    name: 'level-maker-codex-bridge',
    configureServer(server) {
      server.middlewares.use('/api/levels', levelFilesMiddleware());
      server.middlewares.use('/api/codex/status', codexStatusMiddleware());
      registerCodexWebSocket(server);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/levels', levelFilesMiddleware());
      server.middlewares.use('/api/codex/status', codexStatusMiddleware());
      registerCodexWebSocket(server);
    },
  };
}

export default defineConfig({
  plugins: [codexBridgePlugin()],
  server: {
    host: '127.0.0.1',
    port: 6042,
    strictPort: true,
  },
});
