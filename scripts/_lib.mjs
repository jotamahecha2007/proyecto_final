// Utilidades compartidas por los scripts de arranque (setup, ip, doctor, dev).
// Solo usan módulos de Node, así funcionan igual en Windows (CMD o PowerShell), Mac y Linux.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FUNCTIONS = join(ROOT, 'functions');
export const IS_WIN = process.platform === 'win32';
export const PROJECT_ID = 'demo-teayudo';

// ---------- Mensajes con color ----------
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const c = { green: paint(32), red: paint(31), yellow: paint(33), blue: paint(34), dim: paint(2), bold: paint(1) };
export const ok = (msg) => console.log(`${c.green('✔')} ${msg}`);
export const warn = (msg) => console.log(`${c.yellow('!')} ${msg}`);
export const fail = (msg) => console.log(`${c.red('✖')} ${msg}`);
export const info = (msg) => console.log(`${c.blue('›')} ${msg}`);
export const title = (msg) => console.log(`\n${c.bold(msg)}`);

// ---------- Puertos de los emuladores (se leen de firebase.json) ----------
export function emulatorPorts() {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'firebase.json'), 'utf8')).emulators ?? {};
  return {
    auth: cfg.auth?.port ?? 9099,
    functions: cfg.functions?.port ?? 5001,
    firestore: cfg.firestore?.port ?? 8080,
    storage: cfg.storage?.port ?? 9199,
    ui: cfg.ui?.port ?? 4000,
    hub: cfg.hub?.port ?? 4400,
  };
}

/** ¿El puerto está libre? Intenta abrirlo un instante. */
export function portIsFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '0.0.0.0');
  });
}

/** ¿Hay algo escuchando en el puerto? (para saber cuándo un emulador ya arrancó) */
export function portIsOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const sock = net.connect({ port, host });
    sock.setTimeout(1000);
    sock.once('connect', () => {
      sock.destroy();
      resolve(true);
    });
    sock.once('error', () => resolve(false));
    sock.once('timeout', () => {
      sock.destroy();
      resolve(false);
    });
  });
}

/** Qué programa ocupa un puerto (para decirle a la persona qué cerrar). */
export function whoUsesPort(port) {
  try {
    if (IS_WIN) {
      const out = spawnSync('netstat', ['-ano'], { encoding: 'utf8' }).stdout ?? '';
      const line = out.split(/\r?\n/).find((l) => l.includes(`:${port} `) && /LISTENING|ESCUCHANDO/i.test(l));
      const pid = line?.trim().split(/\s+/).pop();
      if (!pid) return null;
      const task = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8' }).stdout ?? '';
      const name = task.split(',')[0]?.replace(/"/g, '').trim();
      return { pid, name: name || 'desconocido', kill: `taskkill /PID ${pid} /F` };
    }
    const out = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout ?? '';
    const line = out.split('\n')[1];
    if (!line) return null;
    const [name, pid] = line.trim().split(/\s+/);
    return { pid, name, kill: `kill ${pid}` };
  } catch {
    return null;
  }
}

// ---------- IP del computador en la red ----------
const VIRTUAL = /vethernet|virtualbox|vmware|vbox|tailscale|zerotier|docker|wsl|hyper-v|loopback|bluetooth|utun|awdl|llw|bridge|br-|veth|hamachi|radmin|npcap|teredo|isatap/i;

/**
 * Busca la IP de la red wifi o cableada a la que está conectado el computador.
 * Descarta adaptadores virtuales (VirtualBox, Tailscale, WSL…) que no sirven para el celular.
 */
export function lanCandidates() {
  const list = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (a.address.startsWith('169.254.')) continue; // sin red (dirección automática)
      if (a.address.startsWith('192.168.56.')) continue; // red interna de VirtualBox
      if (VIRTUAL.test(name)) continue;
      const octets = a.address.split('.').map(Number);
      if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) continue; // Tailscale / CGNAT
      let score = 0;
      if (/wi-?fi|wlan|wireless|inal[aá]mbrica|^en0$|^wl/i.test(name)) score += 3;
      else if (/ethernet|^eth|^en\d|^enp/i.test(name)) score += 2;
      if (/^(192\.168|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) score += 1;
      list.push({ name, address: a.address, score });
    }
  }
  return list.sort((x, y) => y.score - x.score);
}

// ---------- .env ----------
export const ENV_PATH = join(ROOT, '.env');

export function readEnv() {
  return existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8').replace(/\r\n/g, '\n') : '';
}

export function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/**
 * Pone valores en el .env sin borrar comentarios ni otras variables.
 * Si una variable aparece varias veces (p. ej. vacía arriba y llena abajo), deja una sola.
 */
export function setEnv(values) {
  let lines = readEnv().split('\n');
  for (const [key, value] of Object.entries(values)) {
    const re = new RegExp(`^\\s*${key}\\s*=`);
    let done = false;
    lines = lines.flatMap((l) => {
      if (!re.test(l)) return [l];
      if (done) return [];
      done = true;
      return [`${key}=${value}`];
    });
    if (!done) lines.push(`${key}=${value}`);
  }
  writeFileSync(ENV_PATH, lines.join('\n').replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n'));
}

// ---------- Ejecutar comandos ----------
/** Ejecuta un comando mostrando su salida. Devuelve el código de salida. */
export function run(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: IS_WIN, cwd: ROOT, ...opts });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

/** ¿Existe el programa? Devuelve su salida de versión o null. */
export function versionOf(cmd, args = ['--version']) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: IS_WIN });
  if (r.error || r.status !== 0) return null;
  return `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
