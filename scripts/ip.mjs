// npm run ip            → detecta la IP del wifi y la escribe en .env
// npm run ip -- 10.0.2.2 → usa la IP que le indiques (p. ej. emulador de Android)

import { existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

import { c, ENV_PATH, fail, info, lanCandidates, ok, parseEnv, PROJECT_ID, readEnv, ROOT, setEnv, warn } from './_lib.mjs';

/** Prepara el .env para los emuladores con la IP indicada o detectada. Devuelve la IP o null. */
export function configureEnv(manual) {
  if (!existsSync(ENV_PATH)) {
    copyFileSync(join(ROOT, '.env.example'), ENV_PATH);
    info('Creé el archivo .env a partir de .env.example.');
  }

  let ip = manual;
  if (!ip) {
    const candidates = lanCandidates();
    if (!candidates.length) {
      fail('No encontré una red wifi o cableada. ¿El computador está conectado a internet o al hotspot del celular?');
      return null;
    }
    ip = candidates[0].address;
    info(`Red detectada: ${c.bold(candidates[0].name)} → ${c.bold(ip)}`);
    if (candidates.length > 1) {
      console.log(c.dim(`  Otras redes: ${candidates.slice(1).map((x) => `${x.name} (${x.address})`).join(', ')}`));
      console.log(c.dim('  Si el celular no conecta, prueba con otra: npm run ip -- <la-ip>'));
    }
  }

  const before = parseEnv(readEnv());
  const hasRealProject = before.EXPO_PUBLIC_FIREBASE_API_KEY && before.EXPO_PUBLIC_USE_EMULATORS !== 'true';
  if (hasRealProject) {
    warn('Tu .env tiene un proyecto real de Firebase. Lo paso a modo emuladores (tus claves se conservan).');
  }

  setEnv({
    EXPO_PUBLIC_USE_EMULATORS: 'true',
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: PROJECT_ID,
    EXPO_PUBLIC_EMULATOR_HOST: ip,
  });

  if (before.EXPO_PUBLIC_EMULATOR_HOST && before.EXPO_PUBLIC_EMULATOR_HOST !== ip) {
    ok(`IP actualizada en .env: ${before.EXPO_PUBLIC_EMULATOR_HOST} → ${c.bold(ip)}`);
  } else {
    ok(`.env listo con la IP ${c.bold(ip)}`);
  }
  return ip;
}

// Ejecución directa: node scripts/ip.mjs [ip]
if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/ip.mjs')) {
  const manual = process.argv[2];
  if (manual && !/^\d{1,3}(\.\d{1,3}){3}$|^localhost$/.test(manual)) {
    fail(`«${manual}» no parece una IP. Ejemplo: npm run ip -- 192.168.1.50`);
    process.exit(1);
  }
  process.exit(configureEnv(manual) ? 0 : 1);
}
