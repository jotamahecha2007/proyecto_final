// npm run doctor → revisa que todo esté listo antes de arrancar y dice cómo arreglar lo que falte.

import { existsSync, statSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  c,
  emulatorPorts,
  fail,
  FUNCTIONS,
  info,
  lanCandidates,
  ok,
  parseEnv,
  portIsFree,
  readEnv,
  ROOT,
  title,
  versionOf,
  warn,
  whoUsesPort,
} from './_lib.mjs';

function newestMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(p) : statSync(p).mtimeMs);
  }
  return newest;
}

/**
 * Revisa el entorno. Devuelve { ok, problems } donde problems son los errores que impiden arrancar.
 * @param {{ quiet?: boolean, checkPorts?: boolean }} opts
 */
export async function doctor({ quiet = false, checkPorts = true } = {}) {
  const problems = [];
  const log = quiet ? () => {} : console.log;
  const pass = (m) => !quiet && ok(m);
  const bad = (m, fix) => {
    problems.push(m);
    if (!quiet) {
      fail(m);
      if (fix) console.log(`  ${c.dim('Solución:')} ${fix}`);
    }
  };
  const soft = (m, fix) => {
    if (!quiet) {
      warn(m);
      if (fix) console.log(`  ${c.dim('Sugerencia:')} ${fix}`);
    }
  };

  if (!quiet) title('Revisando el entorno de TeAyudo');

  // 1. Programas
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor >= 20) pass(`Node.js ${process.versions.node}`);
  else bad(`Node.js ${process.versions.node} es muy viejo (se necesita 20 o superior).`, 'Instala la versión LTS desde https://nodejs.org');

  const java = versionOf('java', ['-version']);
  const javaMajor = java ? Number(java.match(/version "(\d+)/)?.[1] ?? java.match(/(\d+)\.\d+\.\d+/)?.[1] ?? 0) : 0;
  if (!java) bad('No encontré Java (lo necesita el emulador de la base de datos).', 'Instala Java 21 o superior desde https://adoptium.net y vuelve a abrir la terminal.');
  else if (javaMajor && javaMajor < 21) bad(`Java ${javaMajor} es muy viejo (se necesita 21 o superior).`, 'Instala Java 21 desde https://adoptium.net');
  else pass(`Java ${javaMajor || ''}`.trim());

  // La Firebase CLI viene incluida en el proyecto (devDependency): no hace falta instalarla aparte.
  if (existsSync(join(ROOT, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js'))) pass('Firebase CLI (incluida en el proyecto)');
  else bad('Falta la Firebase CLI del proyecto.', 'npm run setup');

  // 2. Dependencias del proyecto
  if (existsSync(join(ROOT, 'node_modules', 'expo'))) pass('Dependencias de la app instaladas');
  else bad('Faltan las dependencias de la app.', 'npm run setup');

  if (existsSync(join(FUNCTIONS, 'node_modules', 'firebase-functions'))) pass('Dependencias del servidor instaladas');
  else bad('Faltan las dependencias del servidor (carpeta functions).', 'npm run setup');

  const lib = join(FUNCTIONS, 'lib', 'index.js');
  if (!existsSync(lib)) bad('El servidor no está compilado.', 'npm run setup');
  else if (newestMtime(join(FUNCTIONS, 'src')) > statSync(lib).mtimeMs) soft('El servidor cambió desde la última compilación.', 'npm run dev lo recompila solo; o corre: npm --prefix functions run build');
  else pass('Servidor compilado');

  // 3. .env
  const env = parseEnv(readEnv());
  if (!readEnv()) soft('No hay archivo .env todavía.', 'npm run ip   (o npm run dev, que lo crea solo)');
  else {
    const ip = env.EXPO_PUBLIC_EMULATOR_HOST;
    const current = lanCandidates()[0]?.address;
    if (env.EXPO_PUBLIC_USE_EMULATORS !== 'true') soft('El .env no está en modo emuladores.', 'npm run ip');
    else if (!ip) soft('El .env no tiene la IP del computador.', 'npm run ip');
    else if (current && ip !== current && ip !== 'localhost' && ip !== '10.0.2.2') soft(`La IP del .env (${ip}) no es la de tu red actual (${current}).`, 'npm run ip   (npm run dev lo corrige solo)');
    else pass(`.env en modo emuladores con IP ${ip}`);
  }

  // 4. Red
  const nets = lanCandidates();
  if (!nets.length) bad('El computador no está conectado a ninguna red.', 'Conéctate al wifi o al hotspot del celular.');
  else if (/usab|campus|eduroam|universidad/i.test(nets[0].name)) soft('Parece una red de la universidad: suelen bloquear la conexión entre el celular y el computador.', 'Si el celular no conecta, usa el hotspot del celular.');

  // 5. Puertos
  if (checkPorts) {
    const ports = emulatorPorts();
    const needed = [
      ['base de datos (Firestore)', ports.firestore],
      ['cuentas (Auth)', ports.auth],
      ['funciones', ports.functions],
      ['archivos (Storage)', ports.storage],
      ['panel de los emuladores', ports.ui],
      ['coordinador de emuladores', ports.hub],
      ['Expo (Metro)', 8081],
    ];
    let allFree = true;
    for (const [label, port] of needed) {
      if (await portIsFree(port)) continue;
      allFree = false;
      const who = whoUsesPort(port);
      bad(
        `El puerto ${port} (${label}) está ocupado${who ? ` por ${who.name} (PID ${who.pid})` : ''}.`,
        who
          ? `Si es un TeAyudo anterior que quedó abierto, ciérralo con: ${who.kill}`
          : 'Cierra el programa que lo usa o reinicia el computador.',
      );
    }
    if (allFree) pass('Puertos libres');
  }

  if (!quiet) {
    log('');
    if (problems.length) fail(`${problems.length} ${problems.length === 1 ? 'problema' : 'problemas'} por resolver.`);
    else ok(c.bold('Todo listo. Arranca con: npm run dev'));
  }
  return { ok: problems.length === 0, problems };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/doctor.mjs')) {
  const { ok: allGood } = await doctor();
  if (!allGood) info('Arregla lo de arriba y vuelve a correr: npm run doctor');
  process.exit(allGood ? 0 : 1);
}
