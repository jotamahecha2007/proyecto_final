// npm run dev           → arranca todo en una sola terminal: Firebase + datos de prueba + Expo.
// npm run dev:reset     → igual, pero borra los datos guardados y vuelve a cargar los de prueba.
// npm run dev -- --ip 10.0.2.2   → fuerza una IP (p. ej. emulador de Android).
//
// Los datos (cuentas, solicitudes, chats…) se guardan en .emulator-data al cerrar con Ctrl + C,
// así que no se pierden entre una sesión y otra.

import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { c, emulatorPorts, fail, FUNCTIONS, info, IS_WIN, ok, portIsOpen, PROJECT_ID, ROOT, run, sleep, title, warn } from './_lib.mjs';
import { doctor } from './doctor.mjs';
import { configureEnv } from './ip.mjs';

const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const FORCE_SEED = args.includes('--seed');
const ipIdx = args.indexOf('--ip');
const MANUAL_IP = ipIdx >= 0 ? args[ipIdx + 1] : undefined;

const DATA_DIR = join(ROOT, '.emulator-data');
const LOG_DIR = join(ROOT, '.dev-logs');
// TEAYUDO_FIREBASE_BIN solo se usa para probar este script sin emuladores reales.
const FIREBASE_BIN = process.env.TEAYUDO_FIREBASE_BIN ?? join(ROOT, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const EXPO_BIN = join(ROOT, 'node_modules', 'expo', 'bin', 'cli');
const TSX_BIN = join(FUNCTIONS, 'node_modules', 'tsx', 'dist', 'cli.mjs');

// Se ejecutan con "node <archivo>" en vez de "firebase"/"npx": así no aparece en Windows
// el aviso «¿Desea terminar el trabajo por lotes (S/N)?» al presionar Ctrl + C.
const node = (file, fileArgs, opts) => spawn(process.execPath, [file, ...fileArgs], { cwd: ROOT, ...opts });

function newestMtime(dir) {
  let newest = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    newest = Math.max(newest, e.isDirectory() ? newestMtime(p) : statSync(p).mtimeMs);
  }
  return newest;
}

// Estado del proceso (declarado arriba para poder cerrar bien en cualquier momento).
let firebase = null;
let expo = null;
let shuttingDown = false;

// ---------------------------------------------------------------------------
title('TeAyudo · arranque automático');

// 1. IP y .env (se corrige solo si cambiaste de red)
const ip = configureEnv(MANUAL_IP);
if (!ip) process.exit(1);

// 2. Revisión previa
const check = await doctor({ quiet: true });
if (!check.ok) {
  await doctor(); // repite mostrando el detalle y la solución de cada problema
  process.exit(1);
}
ok('Entorno revisado: programas, dependencias y puertos en orden');

// 3. Recompila el servidor si cambió
const lib = join(FUNCTIONS, 'lib', 'index.js');
if (!existsSync(lib) || newestMtime(join(FUNCTIONS, 'src')) > statSync(lib).mtimeMs) {
  info('El servidor cambió: recompilando…');
  if ((await run('npm', ['run', 'build'], { cwd: FUNCTIONS })) !== 0) {
    fail('No se pudo compilar el servidor. Revisa el error de arriba.');
    process.exit(1);
  }
  ok('Servidor compilado');
}

// 4. Datos guardados
if (RESET && existsSync(DATA_DIR)) {
  rmSync(DATA_DIR, { recursive: true, force: true });
  info('Borré los datos guardados (--reset).');
}
const hasSavedData = existsSync(join(DATA_DIR, 'firebase-export-metadata.json'));

// 5. Firebase (su salida completa va a .dev-logs/emulators.log; aquí solo lo importante)
title('Arrancando Firebase');
mkdirSync(LOG_DIR, { recursive: true });
const logFile = join(LOG_DIR, 'emulators.log');
const log = createWriteStream(logFile);
const fbArgs = ['emulators:start', '--project', PROJECT_ID, `--export-on-exit=${DATA_DIR}`];
if (hasSavedData) fbArgs.push(`--import=${DATA_DIR}`);
firebase = node(FIREBASE_BIN, fbArgs, { stdio: ['ignore', 'pipe', 'pipe'] });

let firebaseReady = false;
let waitingDots = false;
const NOISE = /MOTD|MetadataLookupWarning|EAFNOSUPPORT|not a fatal error|^\s*at |Unable to fetch|deprecat/i;

const onFirebaseOutput = (buf) => {
  const text = buf.toString();
  log.write(text);
  for (const line of text.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    if (/All emulators ready/i.test(l)) firebaseReady = true;
    // Solo errores reales; los avisos de red y de IPv6 se quedan en el log.
    if (NOISE.test(l)) continue;
    if (/^Error:|✖|failed to load|could not start|port taken|no se pudo/i.test(l)) {
      if (waitingDots) {
        process.stdout.write('\n');
        waitingDots = false;
      }
      console.log(`${c.red('[firebase]')} ${l}`);
      if (/storage\.googleapis\.com|Failed to make request/i.test(l)) {
        console.log(`  ${c.dim('La primera vez Firebase descarga los emuladores (~100 MB): revisa tu conexión a internet.')}`);
      }
    } else if (/Exporting data|Export complete|Importing data/i.test(l)) {
      console.log(`${c.dim('[firebase]')} ${l}`);
    }
  }
};
firebase.stdout.on('data', onFirebaseOutput);
firebase.stderr.on('data', onFirebaseOutput);

firebase.on('exit', (code) => {
  log.end();
  if (shuttingDown) return;
  fail(`Firebase se cerró inesperadamente (código ${code}). Revisa el detalle en ${logFile}`);
  expo?.kill('SIGINT');
  process.exit(1);
});

// Espera a que Firebase esté listo (máximo 2 minutos; la primera vez descarga los emuladores).
const ports = emulatorPorts();
const started = Date.now();
process.stdout.write(c.dim('  Esperando a los emuladores'));
waitingDots = true;
while (!firebaseReady) {
  if (Date.now() - started > 120_000) {
    console.log('');
    fail(`Firebase tardó demasiado en arrancar. Revisa ${logFile}`);
    await shutdown(1);
  }
  await sleep(1000);
  process.stdout.write(c.dim('.'));
}
// Confirmación extra: los puertos responden.
for (const p of [ports.firestore, ports.auth]) {
  while (!(await portIsOpen(p))) await sleep(300);
}
if (waitingDots) console.log('');
waitingDots = false;
ok(`Firebase listo · panel en ${c.bold(`http://localhost:${ports.ui}`)}`);

// 6. Datos de prueba (solo la primera vez, con --reset o con --seed)
if (!hasSavedData || FORCE_SEED) {
  title('Cargando datos de prueba');
  const code = await new Promise((resolve) => {
    const seed = node(TSX_BIN, ['scripts/seed.ts'], {
      cwd: FUNCTIONS,
      stdio: 'inherit',
      env: {
        ...process.env,
        // 127.0.0.1 y no "localhost": en Node, localhost puede resolver a IPv6 y no conectar.
        FIRESTORE_EMULATOR_HOST: `127.0.0.1:${ports.firestore}`,
        FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${ports.auth}`,
        FIREBASE_STORAGE_EMULATOR_HOST: `127.0.0.1:${ports.storage}`,
        GCLOUD_PROJECT: PROJECT_ID,
      },
    });
    seed.on('exit', (c2) => resolve(c2 ?? 1));
  });
  if (code !== 0) warn('No se pudieron cargar los datos de prueba. La app arranca igual; puedes crear cuentas a mano.');
} else {
  ok('Usando los datos guardados de la sesión anterior (para empezar de cero: npm run dev:reset)');
}

// 7. Resumen
console.log(`
${c.bold('┌─ TeAyudo está corriendo ───────────────────────────────')}
│ Celular:    abre Expo Go y escanea el QR de abajo
│             (el celular y el computador en la misma red: ${c.bold(ip)})
│ Base datos: http://localhost:${ports.ui}
│ Cliente:    cliente@teayudo.test  ·  contraseña teayudo123
│ Prestador:  carlos@teayudo.test   ·  contraseña teayudo123
│ Admin:      admin@teayudo.test    ·  contraseña teayudo123
│ Para salir: Ctrl + C (los datos se guardan solos)
${c.bold('└────────────────────────────────────────────────────────')}
`);

// 8. Expo (con la terminal interactiva: QR, tecla r para recargar, etc.)
expo = node(EXPO_BIN, ['start', '-c'], { stdio: 'inherit' });
expo.on('exit', () => {
  if (!shuttingDown) shutdown(0);
});

// ---------------------------------------------------------------------------
// Cierre ordenado: Firebase guarda los datos antes de cerrarse.
async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${c.dim('Cerrando… guardando los datos de Firebase (unos segundos).')}`);
  if (expo && expo.exitCode === null) expo.kill('SIGINT');
  if (firebase && firebase.exitCode === null) {
    // En Windows, Ctrl + C ya le llega a Firebase directamente; en otros sistemas se lo enviamos.
    if (!IS_WIN || !ctrlC) firebase.kill('SIGINT');
    const deadline = Date.now() + 30_000;
    while (firebase.exitCode === null && Date.now() < deadline) await sleep(250);
    if (firebase.exitCode === null) {
      warn('Firebase no cerró a tiempo; lo cierro a la fuerza (puede que no se guarden los últimos cambios).');
      firebase.kill('SIGKILL');
    }
  }
  ok('Listo. Hasta la próxima.');
  process.exit(code);
}

let ctrlC = false;
process.on('SIGINT', () => {
  ctrlC = true;
  shutdown(0);
});
process.on('SIGTERM', () => shutdown(0));
