# TeAyudo — MVP

App móvil que conecta a personas que necesitan un servicio del hogar con prestadores independientes de su zona. El cliente describe su problema con sus palabras, la app lo interpreta y le muestra los 3 prestadores más compatibles, ordenados por confianza, cercanía y precio.

Proyecto de Desarrollo Móvil, Universidad de la Sabana.

- **App:** React Native con Expo (SDK 58), TypeScript y Expo Router.
- **Backend:** Firebase (Authentication, Firestore, Storage y Cloud Functions).
- **IA:** una Cloud Function llama a Claude (`claude-haiku-5-5`) para convertir la solicitud en atributos estructurados. Si la IA no está disponible, un clasificador por reglas toma su lugar.

---

## Qué incluye (según la Tabla B1 de la propuesta)

| Componente | Estado en el MVP | Dónde está |
|---|---|---|
| Registro y autenticación | ✅ Correo y contraseña, rol cliente o prestador | `src/app/(auth)`, `src/services/users.ts` |
| Perfil profesional | ✅ Servicios, tarifa, radio, ubicación, horario | `src/app/provider-setup.tsx` |
| Publicar solicitud | ✅ Texto libre, «lo antes posible» o un día, ubicación y modo de contratación. Se puede **editar** mientras nadie esté contratado | `src/app/new-request.tsx` (con `?edit=<id>` edita) |
| IA para clasificar solicitudes | ✅ LLM con validación y respaldo por reglas | `functions/src/index.ts`, `src/lib/classifierRules.ts` |
| Geolocalización | ✅ GPS, distancia (haversine) y tiempo de desplazamiento | `src/lib/geo.ts` |
| Matching básico | ✅ Filtros, horarios libres de cada prestador y puntaje ponderado; primero quien llega antes | `src/lib/matching.ts` |
| Trust Score | ✅ Versión simple, calculada solo en el servidor | `src/lib/trustScore.ts` |
| Cotización anónima | ✅ La solicitud llega a 5 prestadores sin el nombre del cliente | `src/app/quote/[requestId].tsx` |
| Agenda | ✅ Bloquea la duración del trabajo más el desplazamiento | `src/lib/schedule.ts`, `src/app/(provider)/agenda.tsx` |
| Chat | ✅ Texto, fotos, videos y notas de voz, con transcripción automática | `src/app/chat/[id].tsx`, `src/components/ChatMedia.tsx` |
| Reviews | ✅ En ambas direcciones (cliente ↔ prestador) | `src/app/review/[bookingId].tsx` |
| Reputación del cliente | ✅ El prestador la ve al confirmar y al cotizar (sin el nombre) | `src/components/ClientReputationCard.tsx` |
| Precio final acordado | ✅ El prestador propone y el cliente acepta antes de pagar | `src/components/PriceAgreement.tsx` |
| Explicación del matching | ✅ «¿Por qué te lo recomendamos?» en cada prestador | `explainMatch` en `src/lib/matching.ts` |
| Notificaciones | ✅ Campana con bandeja, banner, vibración y aviso del sistema | `src/context/NotificationsContext.tsx` |
| Pantalla de inicio | ✅ Buscador, categorías, servicio en curso y prestadores destacados | `src/app/(client)/index.tsx` |
| Seguimiento «en camino» | ✅ El prestador comparte su ubicación y el cliente ve mapa, distancia y hora estimada | `src/components/OnTheWay.tsx`, `src/services/tracking.ts` |
| Fotos del problema | ✅ Hasta 3 fotos al pedir el servicio; las ven los prestadores | `src/components/PhotoPicker.tsx` |
| Términos y autorización de datos | ✅ Casilla obligatoria al registrarse (Ley 1581) y pantalla legal | `src/app/legal.tsx`, `src/lib/legal.ts` |
| Eliminar cuenta | ✅ Desde Perfil, con contraseña; borra y anonimiza en el servidor | `src/app/delete-account.tsx`, `deleteMyAccount` |
| Reportar usuarios | ✅ Desde el perfil, la contratación y el chat; confidencial | `src/app/report.tsx` |
| Panel de administración | ✅ Tablero, usuarios, reportes, servicios y bitácora | `src/app/(admin)/`, funciones `admin*` |
| Habeas data (Ley 1581) | ✅ Centro «Mis datos y privacidad», solicitudes con plazos legales, descarga de datos, reconsentimiento | `src/app/privacy.tsx`, `src/lib/businessDays.ts` |
| Onboarding y esqueletos de carga | ✅ 3 pantallas la primera vez; bloques animados mientras carga | `src/app/onboarding.tsx`, `src/components/Skeleton.tsx` |
| Pagos | 🧪 Simulación: no se pide ni se guarda ningún dato financiero | `src/app/pay/[bookingId].tsx` |
| IA para matching (KNN), ML de recomendaciones, verificación de identidad, antifraude, offline-first | ⏭️ Fuera del MVP, como dice la propuesta | — |

La accesibilidad está incorporada en los componentes base (`src/components/ui.tsx`):

- Etiquetas para lectores de pantalla (VoiceOver y TalkBack).
- Áreas de toque de 48 px como mínimo.
- Estados comunicados con ícono y texto, nunca solo con color.
- Ajustes con apariencia **Automático / Claro / Oscuro** y **alto contraste**; texto que respeta el tamaño de fuente del sistema.
- Botón «volver» en todas las pantallas internas (también si se abrió desde una notificación) y botón físico de Android coherente.
- Selectores con botones − / + en lugar de gestos de arrastre.
- Pantallas "¿Qué pasa ahora?" en la contratación.
- Notificaciones que avisan con banner, vibración y lector de pantalla, sin depender del sonido.
- Transcripción de notas de voz y videos.
- Notas de voz que se graban con dos toques: no hay que mantener presionado.

`docs/ACCESIBILIDAD.md` trae el guion de pruebas manuales con TalkBack, VoiceOver, Switch Access y tamaño de fuente.

---

## Puesta al día (si ya tenías el proyecto corriendo)

Después de copiar archivos nuevos encima de tu proyecto, corre `npm run setup` (instala lo que falte y recompila el servidor) y luego `npm run dev`.

## Cómo funciona el matching

1. **Filtros duros.** El prestador debe ofrecer la categoría y el cliente debe estar dentro de su radio de servicio.
2. **Horarios libres.** El cliente no elige la hora: dice «lo antes posible» (próximos 7 días) o un día. Para cada prestador se calculan las horas de llegada en que el desplazamiento más el trabajo caben en su horario y no se cruzan con otros trabajos confirmados (`availableSlots` en `src/lib/schedule.ts`). La urgencia cambia la anticipación mínima: urgente 30 min, normal 1 h, sin afán 2 h. Quien no tiene horario ese día aparece al final con sus próximos horarios.
   - **Orden:** primero quien puede llegar antes; con la misma hora, gana el puntaje. Se muestran 3 y se pueden ver hasta 6.
   - El cliente toca una hora y contrata. Antes de guardar se revisa que esa hora siga libre.
   - En cotización, el prestador propone **precio y hora** según su propia agenda.
3. **Puntaje.** Se calcula con estos pesos:
   - Normal: confianza 50 %, cercanía 30 %, precio 20 %.
   - Urgente: confianza 40 %, cercanía 45 %, precio 15 %.

**Trust Score (0–100).** Combina calificaciones (40 %), cumplimiento (25 %), experiencia (20 %) y perfil completo (15 %). Tiene previos bayesianos para que una sola reseña no dispare ni hunda el puntaje. Solo la Cloud Function escribe `stats` y `trustScore`, y las reglas de Firestore bloquean cualquier cambio a esos campos desde la app.

---

## Temas y navegación (cómo extenderlo)

- **Colores:** viven solo en `src/lib/palette.ts`, con nombres por función (`bg`, `surface`, `text`, `textMuted`, `primary`, `danger`, `onDanger`, `shadow`…). Hay 4 temas: claro, oscuro, claro y oscuro de alto contraste. En una pantalla se usan así: `const t = useTheme();` → `color: t.text`.
- **Regla automática:** `npm test` falla si alguien escribe un color fijo (`'#123456'`, `rgb()`, `'white'`…) fuera de `palette.ts`, y también si un color no cumple el contraste mínimo (4,5:1; 7:1 en alto contraste).
- **Agregar un color:** añádelo a la interfaz `Theme` y a los 4 temas en `palette.ts` (TypeScript avisa si falta en alguno).
- **Ajustes:** `src/app/settings.tsx`. Cada grupo es una tarjeta, así se pueden sumar notificaciones o idioma.
- **Volver:** el Stack raíz (`src/app/_layout.tsx`) pone `HeaderBack` en todas las pantallas internas. Si no hay pantalla anterior, lleva al inicio del rol. En modales es una «X» (`...modal`). Una pantalla nueva no tiene que hacer nada. Para impedir volver (como en la política de datos), usa `useBlockHardwareBack()`.

## Panel de administración

Entra con `admin@teayudo.test` (contraseña `teayudo123`). El administrador tiene cinco pestañas:

| Pestaña | Qué hace |
|---|---|
| **Resumen** | Cifras del piloto: usuarios, servicios, tasa de terminados y cancelados, pagos simulados, confianza y calificación promedio, solicitudes por categoría. Avisos masivos (a todos, solo clientes o solo prestadores) y actividad reciente |
| **Usuarios** | Buscar por nombre o correo y filtrar (clientes, prestadores, sin verificar, suspendidos). La ficha de cada usuario permite **verificar la identidad**, **suspender o reactivar**, **enviar un aviso**, **quitar reseñas** falsas u ofensivas (se descuentan de la reputación) y **eliminar la cuenta** |
| **Reportes** | Lo que reportan los usuarios, con los de seguridad primero. Para cada uno: **advertir**, **suspender** o **descartar**, con una nota que recibe quien reportó |
| **Servicios** | Todas las contrataciones por estado. El administrador puede **cancelar un servicio** (disputas, seguridad) sin penalizar a nadie: ambas partes reciben el motivo |
| **Cuenta** | La **bitácora**: cada acción de un administrador queda registrada con quién, qué, a quién y por qué |

**Cómo está protegido:**
- El rol de administrador no se puede elegir al registrarse. Lo asigna el servidor con un *custom claim* de Firebase.
- El administrador puede **leer** usuarios, servicios y reportes, pero **todo lo que cambia** pasa por Cloud Functions que verifican el permiso y escriben la bitácora.
- Por privacidad, **no puede leer los chats** entre cliente y prestador.
- No se puede suspender ni eliminar a otro administrador desde la app.

Para convertir una cuenta en administrador, o quitarle el rol, con `npm run dev` corriendo:

```bash
npm run make-admin -- correo@ejemplo.com
npm run make-admin -- correo@ejemplo.com --quitar
```

La persona debe cerrar sesión y volver a entrar.

## Protección de datos (habeas data) — enfoque académico

TeAyudo aplica la Ley 1581 de 2012 y el Decreto 1377 de 2013 como ejercicio de diseño. El responsable del tratamiento es el equipo del proyecto, con un correo de contacto ficticio (`datos@teayudo.test`).

| Derecho u obligación | Cómo se cumple en la app |
|---|---|
| Autorización previa, expresa e informada | Casillas obligatorias al registrarse: mayoría de edad y tratamiento de datos, con mención explícita de la transferencia internacional. Se guardan la fecha y la versión aceptada |
| Cambios en la política | Al subir la versión (`CONSENT_VERSION` en `src/lib/legal.ts`), todas las personas deben aceptarla de nuevo al entrar |
| Conocer | «Descargar mis datos» genera un archivo JSON con todo lo que la app guarda sobre la persona (función `exportMyData`) |
| Actualizar y rectificar | Editar nombre y teléfono en «Mis datos y privacidad»; lo demás, por solicitud |
| Consultas y reclamos | Formulario con 5 tipos. Plazo de **10 días hábiles** para consultas y **15** para lo demás, calculado en el servidor sin fines de semana ni festivos de Colombia. La persona ve el estado y la respuesta |
| Atención por el responsable | Panel de admin → «Solicitudes de habeas data», con semáforo de plazos (a tiempo, por vencer, vencida). Cada respuesta queda en la bitácora |
| Supresión y revocatoria | «Eliminar mi cuenta» borra y anonimiza los datos |
| Transferencia internacional y conservación | Explicadas en la política (Google, Anthropic y OpenAI en EE. UU.; tiempos de conservación por tipo de dato) |
| Menores de edad | Solo mayores de 18; las reglas de la base de datos rechazan cuentas sin la confirmación |

Fuera de un proyecto académico, habría que poner los datos reales del responsable (razón social, NIT, dirección), revisar si aplica el Registro Nacional de Bases de Datos ante la SIC y hacer revisar la política por un abogado.

## Requisitos

- Node.js 22 o superior
- La Firebase CLI ya viene incluida en el proyecto: no hace falta instalarla aparte.
- Java 21 o superior (lo usan los emuladores de Firestore)
- La app **Expo Go** en el celular, o un emulador de Android o iOS

## Opción A: correr todo en local (recomendada para clase)

No necesita un proyecto real de Firebase ni tarjeta de crédito. Son **dos comandos**, en la terminal de VS Code, dentro de la carpeta del proyecto (la que tiene `package.json`):

```bash
npm run setup     # solo la primera vez: instala todo y prepara el .env
npm run dev       # cada vez que quieras usar la app
```

`npm run dev` hace todo solo, en una sola terminal:

1. Detecta la IP de tu wifi y la escribe en `.env`. Si cambias de red o usas el hotspot del celular, la corrige sola.
2. Revisa que todo esté listo: Java, dependencias, puertos libres. Si algo falla, dice qué es y cómo arreglarlo.
3. Recompila el servidor si cambió.
4. Arranca Firebase y espera a que esté listo.
5. La primera vez, carga los datos de prueba (14 prestadores y 1 cliente).
6. Abre Expo con el código QR para escanear con **Expo Go**.

Para salir, presiona **Ctrl + C**. Los datos (cuentas, solicitudes, chats…) **se guardan solos** en la carpeta `.emulator-data` y siguen ahí la próxima vez.

| Comando | Para qué |
|---|---|
| `npm run setup` | Instalar todo la primera vez (o después de copiar archivos nuevos) |
| `npm run dev` | Arrancar la app |
| `npm run dev:reset` | Arrancar borrando los datos guardados y volviendo a cargar los de prueba |
| `npm run dev -- --seed` | Arrancar conservando tus datos, pero recargando las cuentas de prueba (sirve para traer cuentas nuevas, como la de administrador) |
| `npm run doctor` | Revisar qué falta o qué está mal, sin arrancar nada |
| `npm run ip` | Volver a detectar la IP (o fijar una: `npm run ip -- 192.168.1.50`) |

La primera vez que se arranca, Firebase descarga los emuladores (unos 100 MB), así que necesitas internet. El panel para ver la base de datos queda en http://localhost:4000. Si algo falla, el detalle completo queda en `.dev-logs/emulators.log`.

**Opcional, claves de IA:** crea `functions/.secret.local` con `ANTHROPIC_API_KEY=...` (clasificación con Claude) y `OPENAI_API_KEY=...` (transcripción). Sin ellas, la app usa el clasificador por reglas y muestra «Transcripción no disponible».

**Cuentas de prueba** (contraseña `teayudo123`):

- Cliente: `cliente@teayudo.test`
- Prestadores: `carlos@teayudo.test` (plomería), `jhon@teayudo.test` (electricidad), `luz@teayudo.test` (limpieza), `oscar@teayudo.test` (cerrajería) y más. La lista completa está en `functions/scripts/seed.ts`.

- Administrador: `admin@teayudo.test`

**Recorrido sugerido:**

1. Entra como cliente, toca **Plomería** en el inicio y escribe: «Se me tapó el lavaplatos y el agua no baja, necesito a alguien mañana. Tengo hasta 120 mil».
2. Revisa lo que interpretó la app, mira los 3 prestadores y contrata a Carlos.
3. En otro celular, entra como `carlos@teayudo.test`. Confirma, toca **Voy en camino**, marca el inicio y luego el fin del trabajo.
4. Califíquense mutuamente y mira cómo cambia el Trust Score en el perfil de Carlos.

<details>
<summary>Arranque manual (sin npm run dev)</summary>

Si prefieres hacerlo paso a paso, en tres terminales:

1. `npx firebase emulators:start --project demo-teayudo`
2. En `functions`: define `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` y `GCLOUD_PROJECT=demo-teayudo`, y corre `npm run seed`. En CMD se definen con `set NOMBRE=valor` y en PowerShell con `$env:NOMBRE="valor"`.
3. `npx expo start -c`

</details>

## Opción B: proyecto real de Firebase

1. Crea un proyecto en https://console.firebase.google.com.
2. Activa Authentication (correo y contraseña), Firestore y Storage.
3. Las Cloud Functions requieren el plan Blaze. Tiene una cuota gratuita, pero pide una tarjeta.
4. Registra una app web en el proyecto y copia su configuración en `.env`, usando `.env.example` como guía.
5. Configura y despliega:
   ```bash
   firebase use --add                              # elige tu proyecto
   firebase functions:secrets:set ANTHROPIC_API_KEY
   firebase functions:secrets:set OPENAI_API_KEY   # si no tienes, escribe "none"
   firebase deploy --only firestore,storage,functions
   ```
6. Para cargar los datos de prueba en el proyecto real, usa una cuenta de servicio:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=ruta/cuenta.json GCLOUD_PROJECT=tu-proyecto npm --prefix functions run seed
   ```

---

## Scripts

| Comando | Qué hace |
|---|---|
| `npm start` | Inicia Expo |
| `npm test` | Pruebas de la lógica: clasificador, geo, agenda, Trust Score y matching |
| `npm run typecheck` | Revisa los tipos de TypeScript |
| `npm run test:rules` | Pruebas de las reglas de seguridad de Firestore. Levanta su propio emulador, así que cierra antes el de la terminal 1 |
| `npm run sync-shared` | Copia la lógica compartida de `src/lib` a `functions/src/shared`. Córrelo después de cambiar `trustScore.ts`, `classifierRules.ts` o `types.ts` |

## Estructura

```
src/
  app/              Pantallas (Expo Router: cada archivo es una ruta)
    (auth)/         Inicio de sesión y registro
    (client)/       Pestañas del cliente
    (provider)/     Pestañas del prestador
    request/ booking/ chat/ quote/ review/ pay/ provider/
  components/       Componentes accesibles reutilizables
  context/          Sesión del usuario
  lib/              Lógica pura y probada: matching, trustScore, schedule, geo, clasificador
  services/         Acceso a Firebase por entidad
functions/          Cloud Functions: IA, Trust Score y datos de prueba
tests/              Pruebas unitarias (node:test)
firestore.rules     Reglas de seguridad por rol
```

## Modelo de datos (Firestore)

| Colección | Contenido |
|---|---|
| `users/{uid}` | Rol, nombre y reputación como cliente |
| `providers/{uid}` | Perfil profesional, horario, `stats` y `trustScore` |
| `providers/{uid}/busy/{bookingId}` | Franjas ocupadas (solo inicio y fin) |
| `requests/{id}` | Descripción, atributos interpretados, ubicación, fecha y prestadores emparejados |
| `requests/{id}/quotes/{providerId}` | Una cotización por prestador |
| `bookings/{id}` | Contratación: estado, precio, desplazamiento y pago simulado |
| `reviews/{bookingId_autorId}` | Una reseña por persona y trabajo |
| `reputation/{uid}` | Reputación del cliente: calificaciones, servicios terminados y cancelaciones. Solo la escribe el servidor |
| `notifications/{id}` | Bandeja de notificaciones de cada usuario. Las crea el servidor |
| `chats/{clienteId_prestadorId}/messages` | Chat por pareja, para volver a contratar a la misma persona |

## Limitaciones conocidas

- **Seguimiento con la app cerrada:** el prestador comparte su ubicación mientras tiene abierta la pantalla de la contratación. Para seguir compartiendo con el celular bloqueado hace falta ubicación en segundo plano, que exige un build de desarrollo y el permiso «Permitir siempre».
- **Mapa en un build propio:** en Expo Go el mapa funciona sin configurar nada. En un build de desarrollo o de tienda, Android necesita una clave de Google Maps (`android.config.googleMaps.apiKey` en `app.json`).
- **Eliminar cuenta en la Play Store:** además del botón dentro de la app, Google pide una página web donde se pueda solicitar la eliminación. Pueden publicar una página sencilla con un formulario o un correo de contacto.
- **Textos legales:** `src/lib/legal.ts` es una base para el proyecto. Antes de publicar, debe revisarlo un abogado.

- La identidad es una declaración del prestador. No se verifica con documento.
- **Notificaciones push con la app cerrada:** Expo Go en Android no las soporta desde SDK 53. En Expo Go funcionan la campana, el banner, la vibración y el aviso del sistema mientras la app está abierta o en segundo plano. Para recibir push con la app cerrada hace falta un build de desarrollo (`npx eas-cli@latest build --profile development`). El código ya registra el token y el servidor ya envía el push.
- **Transcripción:** usa la API de OpenAI (modelo configurable con la variable `TRANSCRIBE_MODEL`, por defecto `gpt-4o-mini-transcribe`) y tiene costo por minuto. Sin clave, la app funciona igual y muestra «Transcripción no disponible».
- Al abrir la app en Expo Go aparece una advertencia amarilla de `expo-notifications` sobre el push remoto. Es esperada y no afecta nada.
- El tiempo de desplazamiento es una estimación (línea recta × 1,4 a 18 km/h + 10 min). No usa una API de rutas.
- Las horas se manejan en la zona horaria del dispositivo, pensando en un piloto solo en Bogotá.
