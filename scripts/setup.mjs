// npm run setup → instala todo (app + servidor), compila el servidor y prepara el .env.

import { c, fail, FUNCTIONS, ok, run, title } from './_lib.mjs';
import { configureEnv } from './ip.mjs';
import { doctor } from './doctor.mjs';

title('1/4 · Instalando dependencias de la app');
if ((await run('npm', ['install'])) !== 0) {
  fail('Falló la instalación de la app. Revisa tu conexión a internet y vuelve a intentar.');
  process.exit(1);
}

title('2/4 · Instalando dependencias del servidor');
if ((await run('npm', ['install'], { cwd: FUNCTIONS })) !== 0) {
  fail('Falló la instalación del servidor (carpeta functions).');
  process.exit(1);
}

title('3/4 · Compilando el servidor');
if ((await run('npm', ['run', 'build'], { cwd: FUNCTIONS })) !== 0) {
  fail('Falló la compilación del servidor.');
  process.exit(1);
}
ok('Servidor compilado');

title('4/4 · Preparando el archivo .env');
configureEnv();

const { ok: ready } = await doctor({ checkPorts: false });
console.log('');
if (ready) ok(c.bold('Instalación completa. Ahora corre: npm run dev'));
else fail('La instalación terminó, pero falta resolver lo de arriba antes de arrancar.');
process.exit(ready ? 0 : 1);
