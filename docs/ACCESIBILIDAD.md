# Guía de pruebas de accesibilidad

Esta guía sirve para comprobar en un celular real lo que promete la sección **Consideraciones de Accesibilidad** de la propuesta.

El código ya trae lo necesario:
- etiquetas para lectores de pantalla;
- áreas de toque de 48 px;
- estados con ícono y texto;
- controles sin gestos de precisión.

Pero eso solo se confirma usando la app con las herramientas de verdad. Hagan cada prueba al menos en un Android. Si alguien del equipo tiene iPhone, háganla también ahí.

Anoten el resultado en la tabla del final.

---

## 1. Lector de pantalla (visión)

**Activar:**
- **Android:** Ajustes → Accesibilidad → TalkBack.
- **iPhone:** Ajustes → Accesibilidad → VoiceOver.

Con el lector activo se navega deslizando un dedo a la derecha o a la izquierda, y se activa con doble toque.

| # | Prueba | Debe pasar |
|---|---|---|
| 1.1 | Iniciar sesión solo con el lector | Se anuncian «Correo», «Contraseña» y el botón «Iniciar sesión». Los errores se leen solos. |
| 1.2 | Pedir un servicio completo | Cada día de la tira se anuncia con la fecha completa («Mañana, miércoles 11 de noviembre»). Los barrios se anuncian con su localidad. |
| 1.3 | Revisar «¿Entendimos bien?» | Las categorías se anuncian como opciones y dicen cuál está seleccionada. |
| 1.4 | Ver los 3 prestadores | Se lee «Por qué te lo recomendamos» completo, incluido cuál factor pesó más. Las estrellas se leen como «4,8 de 5 estrellas». |
| 1.5 | Contratación | El estado («Confirmado», «Propuesta de precio pendiente») se lee como texto, no solo como color. |
| 1.6 | Chat | Cada mensaje se lee con quién lo envió y la hora. En las notas de voz se puede llegar al botón «Reproducir» y luego a la transcripción. |
| 1.7 | Notificación nueva | El lector anuncia el título y el texto de la notificación sin que haya que buscarla. |

## 2. Tamaño de texto y contraste (baja visión)

| # | Prueba | Debe pasar |
|---|---|---|
| 2.1 | Ajustes → Pantalla → Tamaño de fuente al máximo | Ningún texto se corta ni se superpone. Los botones crecen con el texto. |
| 2.2 | Activar el modo oscuro del sistema (con Ajustes en «Automático») o elegir «Oscuro» en Ajustes | La app cambia a colores oscuros, la barra de estado y el mapa también, y todo se sigue leyendo bien. |
| 2.3 | Activar «Alto contraste» en Ajustes | Textos y bordes más marcados (contraste 7:1) en claro y en oscuro. |
| 2.4 | Abrir una notificación y tocar la flecha (o el botón atrás de Android) | Vuelve a la pantalla anterior o, si no hay, al inicio; la app no se cierra. |
| 2.3 | Escala de grises (Ajustes → Accesibilidad → Corrección de color) | Todos los estados se entienden sin color: cada uno tiene ícono y texto. |

## 3. Audición

| # | Prueba | Debe pasar |
|---|---|---|
| 3.1 | Celular en silencio y llega una notificación | Aparece el banner en pantalla y el celular vibra. No depende del sonido. |
| 3.2 | Recibir una nota de voz | Debajo aparece «Transcripción» con el texto. Si no hay servicio de transcripción configurado, dice «Transcripción no disponible» en lugar de quedarse cargando. |
| 3.3 | Recibir un video | Igual que 3.2: la transcripción aparece debajo del video. |

## 4. Motricidad: Switch Access (accesibilidad con interruptores)

**Activar en Android:** Ajustes → Accesibilidad → Accesibilidad con interruptores (Switch Access). Se puede configurar con las teclas de volumen como interruptores: una para «siguiente» y otra para «seleccionar».

| # | Prueba | Debe pasar |
|---|---|---|
| 4.1 | Recorrer la pantalla de inicio de sesión | El foco pasa por los elementos en orden lógico: correo → contraseña → iniciar sesión → crear cuenta. |
| 4.2 | Pedir un servicio | Se puede elegir día, hora (botones − / +), barrio y modo de contratación sin arrastrar nada. Para ver más días se usa la acción «desplazar» del menú de Switch Access. |
| 4.3 | Grabar una nota de voz | Se inicia con un toque y se envía con otro. Nunca hay que mantener presionado. |
| 4.4 | Aceptar una propuesta de precio | Los botones «Aceptar» y «Rechazar» se alcanzan y se activan. |
| 4.5 | Abrir una notificación desde el banner | El banner y su botón «Cerrar» se alcanzan antes de que desaparezca (dura 8 segundos). Si no da tiempo, la notificación sigue en la campana. |

## 5. Cognición

| # | Prueba | Debe pasar |
|---|---|---|
| 5.1 | Pedirle a alguien que no conoce la app que contrate un servicio | Lo logra sin ayuda. La caja «¿Qué pasa ahora?» le explica cada paso. |
| 5.2 | Cancelar | Siempre aparece una confirmación antes de cancelar una contratación o una solicitud. |

---

## Registro de resultados

| Prueba | Android (✅ / ❌ / nota) | iPhone (✅ / ❌ / nota) | Quién y fecha |
|---|---|---|---|
| 1.1 | | | |
| 1.2 | | | |
| … | | | |

Si algo falla, anoten la pantalla y qué se escuchó o qué pasó. El arreglo casi siempre es agregar o corregir un `accessibilityLabel` en `src/components/ui.tsx` o en la pantalla correspondiente.
