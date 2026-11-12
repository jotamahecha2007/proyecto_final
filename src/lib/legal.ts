/**
 * Política de tratamiento de datos personales de TeAyudo (versión académica).
 *
 * TeAyudo es un proyecto académico del curso de Desarrollo Móvil. Esta política aplica los
 * requisitos de la Ley 1581 de 2012 y del Decreto 1377 de 2013 (compilado en el Decreto 1074
 * de 2015) como ejercicio de diseño. Si la app pasara a operar comercialmente, el responsable
 * del tratamiento sería la persona o empresa que la opere, y la política debería revisarla
 * un abogado.
 */

// Si cambia la versión, todas las personas deben volver a aceptar la política al entrar.
export const CONSENT_VERSION = '2026-11-b';

/** Datos del responsable del tratamiento (académico). El correo es de prueba. */
export const DATA_CONTROLLER = {
  name: 'Equipo del proyecto académico TeAyudo',
  members: 'Juan Felipe Mahecha, Andrés Felipe Ramos y Sara Valentina Velandia',
  context: 'Curso de Desarrollo Móvil · Universidad de La Sabana · Chía, Colombia',
  email: 'datos@teayudo.test',
  emailNote: 'Correo ficticio del proyecto académico. Para ejercer tus derechos dentro de la app usa «Mis datos y privacidad».',
};

export const LEGAL_SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Responsable del tratamiento',
    body: `${DATA_CONTROLLER.name} (${DATA_CONTROLLER.members}). ${DATA_CONTROLLER.context}. Contacto: ${DATA_CONTROLLER.email}. ${DATA_CONTROLLER.emailNote} TeAyudo es un proyecto académico y no presta los servicios del hogar directamente: facilita el contacto entre clientes y prestadores independientes.`,
  },
  {
    title: '2. Qué datos tratamos',
    body: 'Identificación y contacto: nombre, correo y teléfono. Ubicación: la dirección o el barrio que indicas para un servicio y, si eres prestador, tu ubicación solo mientras vas en camino. Contenido: descripciones y fotos de solicitudes, mensajes, notas de voz y videos del chat. Actividad: solicitudes, contrataciones, calificaciones, reseñas y reportes. Prestadores: perfil profesional, tarifa, horario y verificación de identidad. No pedimos datos sensibles (salud, origen étnico, creencias, biometría).',
  },
  {
    title: '3. Para qué los usamos',
    body: 'Crear y proteger tu cuenta; interpretar tu solicitud y encontrar los prestadores más compatibles; gestionar contrataciones, precios, agenda y pagos simulados; calcular el puntaje de confianza; mostrar la ubicación del prestador cuando va en camino; transcribir notas de voz y videos (accesibilidad); enviarte notificaciones sobre tus servicios; atender reportes y mantener la seguridad de la plataforma. No vendemos ni cedemos tus datos con fines comerciales.',
  },
  {
    title: '4. Con quién los compartimos',
    body: 'Con la otra parte de un servicio, solo lo necesario para prestarlo (nombre, dirección, fotos del problema y el chat). En las cotizaciones anónimas el prestador no ve tu nombre. Con el equipo administrador de TeAyudo, para moderar reportes y atender solicitudes; el administrador no puede leer los chats. Con proveedores tecnológicos que actúan como encargados del tratamiento (ver punto 5).',
  },
  {
    title: '5. Transferencia internacional de datos',
    body: 'Para funcionar, TeAyudo usa servicios en la nube ubicados fuera de Colombia, principalmente en Estados Unidos: Google Firebase (cuentas, base de datos, archivos y funciones), Anthropic (interpretación del texto de tus solicitudes) y OpenAI (transcripción de notas de voz y videos). Estos proveedores tratan los datos por cuenta de TeAyudo y bajo sus propias medidas de seguridad. Al aceptar esta política autorizas esa transmisión internacional para las finalidades descritas.',
  },
  {
    title: '6. Cuánto tiempo los guardamos',
    body: 'Mientras tengas la cuenta activa. La ubicación en tiempo real se borra cuando el prestador marca su llegada. Al eliminar tu cuenta borramos tu perfil, tus mensajes, tus archivos y tus notificaciones; en el historial de la otra persona quedas como «Usuario eliminado» y tus reseñas escritas se conservan sin tu nombre. La bitácora de acciones de administración se conserva como registro de seguridad durante la vigencia del proyecto.',
  },
  {
    title: '7. Menores de edad',
    body: 'TeAyudo es solo para personas mayores de 18 años. Al registrarte confirmas que lo eres. Si detectamos una cuenta de un menor de edad, la eliminamos.',
  },
  {
    title: '8. Tus derechos',
    body: 'Como titular puedes: conocer los datos que tenemos sobre ti; actualizarlos y corregirlos; pedir prueba de la autorización que nos diste; ser informado sobre el uso que les damos; revocar la autorización o pedir que los borremos (cuando no exista un deber legal de conservarlos); acceder gratis a tus datos; y presentar quejas ante la Superintendencia de Industria y Comercio (SIC) después de haber hecho tu reclamo ante nosotros.',
  },
  {
    title: '9. Cómo ejercerlos',
    body: 'En la app: Perfil → Mis datos y privacidad. Ahí puedes ver y corregir tus datos, descargar una copia de todo lo que guardamos sobre ti, hacer una consulta o un reclamo y seguir su estado, o eliminar tu cuenta. Respondemos las consultas en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles. Si no alcanzamos a responder en ese plazo, te avisamos el motivo y la nueva fecha, que no superará 5 días hábiles adicionales para consultas u 8 para reclamos.',
  },
  {
    title: '10. Seguridad',
    body: 'Acceso por roles con reglas de seguridad en la base de datos y en los archivos, contraseñas gestionadas por Firebase Authentication, comunicación cifrada y registro de todas las acciones de administración. Ningún sistema es infalible: si ocurre un incidente que afecte tus datos, te lo informaremos.',
  },
  {
    title: '11. Términos del servicio',
    body: 'Los precios los fija o acuerda cada prestador, y el precio final debe aceptarlo el cliente antes de pagar. Cualquiera de las partes puede cancelar antes de que empiece el trabajo; las cancelaciones después de confirmar afectan la reputación. En esta versión los pagos son simulados y no se cobra dinero real. Está prohibido usar la app para fines distintos a contratar u ofrecer servicios del hogar, suplantar a otra persona o publicar contenido ofensivo. El equipo de TeAyudo puede suspender cuentas que incumplan estos términos.',
  },
  {
    title: '12. Cambios a esta política',
    body: 'Si cambiamos esta política, te lo mostraremos al abrir la app y te pediremos aceptarla de nuevo antes de seguir usándola.',
  },
];
