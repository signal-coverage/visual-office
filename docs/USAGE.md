# Visual Office: guía de uso

## 1. Qué es

Una oficina virtual en 3D, en primera persona, para el navegador de escritorio. Caminás por el piso con tu avatar, chateás con quien está cerca, hablás por voz y video según la distancia, compartís pantalla en la sala de reuniones y dibujás en pizarras. Cada empresa tiene su propia instalación y se entra solo por invitación.

## 2. Roles

| Rol              | Qué puede hacer                                                |
| ---------------- | -------------------------------------------------------------- |
| **Miembro**      | Entrar, caminar, chatear, usar voz y video, cambiar su aspecto |
| **Jefe de piso** | Todo lo del miembro, más editar y publicar su piso             |
| **Admin**        | Todo lo anterior, más nombrar jefes de piso e invitar personas |

Admins y jefes de piso (en su propio piso) también pueden moderar: ver 3.10.

Entrar a un piso: todos pueden entrar al **piso común** (la oficina principal); a los demás entran los admins, su jefe y quienes tengan una **entrada** que dio un admin (ver 3.14).

Ser jefe de un piso no da permisos sobre otro. El servidor revisa el rol en cada acción, no confía en lo que diga el navegador.

## 3. Pantallas

### 3.1 Inicio de sesión y registro

- Login de Clerk dentro de la misma página. El registro está en `?mode=sign-up`.
- Un aviso indica que el registro es solo por invitación.
- Sin clave de Clerk configurada, esta pantalla no existe y se entra directo (modo desarrollo).

### 3.2 Puerta de la cuenta

Después de iniciar sesión, el servidor decide qué ves:

- **Cargando.**
- **Sin invitación:** una tarjeta pide esperar la invitación de la empresa, muestra tu email y permite volver a chequear.
- **Empresa sin crear:** si sos de los primeros admins, creás la organización ahí. Si no, aparece "todavía no está lista".
- **Error:** botón para reintentar, o volver a iniciar sesión si el servidor no reconoce tu sesión.

### 3.3 Lobby

- Tu nombre. Está bloqueado y es el de tu cuenta, salvo que un admin haya activado que cada uno elija el suyo (ver 3.9): entonces se puede escribir y se recuerda el último que usaste.
- Vista previa 3D del personaje (se puede girar arrastrando) y selector de aspecto en pestañas: **Body** (piel), **Hair** (estilo y color de pelo: corto, largo, calvo, rapado, rodete, cola de caballo, rulos, cresta; colores naturales y de fantasía), **Face** (barba, bigote o barba corta; anteojos redondos, cuadrados o de sol), **Clothes** (remera de manga larga, remera, buzo, camisa con corbata o blazer; color de remera y de pantalón; zapatos) y **Extras** (gorra o gorro; auriculares, credencial, reloj o bufanda). **Surprise me** elige una combinación al azar con sentido.
- Lista de controles y botón **Enter office**.
- Según tu rol aparecen **Editar piso**, **Personas**, **Invitar personas**, **Settings**, **Activity** y **Calendars**.
- Los aspectos guardados antes de estas opciones siguen siendo válidos (sin nada de lo nuevo puesto).
- El último aspecto que guardaste se recuerda: en tu cuenta si iniciaste sesión, en el navegador si no.

### 3.4 La oficina

Vista en primera persona. Sobre el 3D hay:

- Barra de teclas al pie (se puede ocultar).
- Botón **Menu (Esc)**.
- Lista de personas conectadas.
- Indicador de zona (en qué área del piso estás).
- Un punto de color junto a tu nombre (arriba a la izquierda) y en la lista de personas, con tu estado.
- Indicador de voz con medidor de volumen.
- Tu propia cámara y la insignia de pantalla compartida.
- Chat (con botón y contador de mensajes directos sin leer) y aviso de pizarra cercana.
- Avisos de mensaje directo y de "toc toc" debajo de los avisos normales.
- Avisos temporales y banner de cierre cuando se va a actualizar el piso.
- Panel de diagnóstico (F3), con la calidad gráfica en uso.

### 3.5 Menú del juego (Esc)

Un modal con seis paneles. Esc vuelve un paso atrás.

- **Principal:** volver a la oficina, tu personaje, controles, opciones, salir de la oficina y cerrar sesión.
- **Tu personaje:** cambiás cómo te ves cuando quieras, con vista previa. **Save** lo guarda y todos ven el cambio al instante.
- **Tu estado:** elegís entre Available, In a meeting, Do not disturb y Away. Todos lo ven como un punto de color junto a tu nombre, en la lista de personas y sobre tu avatar. Si estás disponible, pasás a Away por tu cuenta tras 5 minutos sin tocar nada (volvés al mover el mouse o una tecla) y a In a meeting mientras estás en la sala de reuniones. Do not disturb, In a meeting y Away elegidos por vos no se cambian solos.
- **Emotes:** botones para saludar, aplaudir, levantar la mano, pulgar arriba y bailar.
- **Controles:** la lista de teclas.
- **Opciones:** calidad gráfica (Auto, High o Low), sensibilidad del mouse (0,4 a 2,5 veces), mostrar u ocultar la barra de teclas, sonido de avisos (activado por defecto) y notificaciones del navegador para mensajes directos con la pestaña oculta (desactivadas por defecto; al activarlas el navegador pide permiso).
  - **Calidad gráfica:** Low apaga las sombras, limita la resolución a 1x y mueve con menos frecuencia a la gente lejana. Auto elige Low si el navegador dibuja con la CPU o si los cuadros se mantienen por debajo de 30 fps unos 4 segundos, y no vuelve a High por sí solo (elegí High para probar de nuevo). El suavizado de bordes solo cambia al recargar la página.
- **Principal:** también tiene **Knock (K)**.

### 3.6 Personas (admins)

Tabla con todas las personas de la empresa. Un checkbox por piso nombra o saca jefes de piso. Los admins llevan una marca. Cada persona (menos los admins) tiene los botones **Ban**, **Remove**, **Mute** y **Let speak**; el largo del ban se elige arriba (10 minutos por defecto) y Remove y Ban piden confirmación. Quien está baneado muestra hasta qué hora y un botón **Lift ban**.

### 3.7 Invitar personas (admins)

Abre la gestión de miembros de Clerk, que envía los mails de invitación.

### 3.9 Configuración de la empresa (admins)

El botón **Settings** del lobby abre una ventana con el interruptor **Let people choose their own name**. Apagado (valor por defecto), todos se llaman como su cuenta. Encendido, cada uno puede escribir el nombre que ven los demás en la oficina. Solo los admins pueden verlo y cambiarlo, y el servidor lo hace cumplir al entrar: aunque alguien modifique el cliente, con el interruptor apagado se usa el nombre de la cuenta. El cambio vale para quien entre después; quienes ya están dentro conservan su nombre.

### 3.10 Moderación (admins y jefes de piso)

En el menú del juego (Esc) aparece **Moderation** solo si el servidor te lo permite: sos admin o jefe del piso. Lista a las personas que ves y permite:

- **Mute:** le quita el micrófono. Dura hasta que sale de la oficina; **Let speak** se lo devuelve. Se hace desde el servidor de voz, no depende del navegador de la otra persona.
- **Remove:** la saca de la oficina. Ve el mensaje "You were removed from the office by a moderator." y no vuelve a entrar sola, pero puede entrar de nuevo a mano.
- **Ban:** la saca y no la deja entrar durante 1 a 240 minutos (10 por defecto). Se cuenta por cuenta, no por navegador.

No se puede moderar a un admin ni a uno mismo. El servidor revisa tu rol en cada acción. Los bans se guardan en la memoria del servidor: si se reinicia, se olvidan.

### 3.11 Actividad (admins)

El botón **Activity** del lobby abre el registro de quién hizo qué, lo más nuevo primero: moderación, cierre y publicación de pisos, jefes nombrados, cambios de Settings y cuando se crea la empresa. Muestra 50 líneas y **Load more** trae las anteriores. El registro solo crece: no se borra solo. Si hace falta limpiarlo, se borra en la base de datos por fecha.

### 3.12 Calendarios de las salas

Cada sala privada (hoy la sala de reuniones) puede mostrar qué pasa en ella, para saber cuándo sumarse.

- **Admins:** el botón **Calendars** del lobby tiene un campo por sala. Pegá la dirección de un feed iCalendar (ICS): en Google Calendar, "Dirección secreta en formato iCal"; en Outlook, un calendario publicado. **Save** lo guarda y lo prueba al instante, **Test** lo prueba sin guardar y **Remove** lo quita. Tratá la dirección como una contraseña: quien la tenga puede leer el calendario. Solo los admins la ven.
- **Todos:** dentro de una sala privada aparece bajo el indicador de zona una línea como "Now: Design review until 15:30 · Next: Weekly retro 16:00". En el menú (Esc), **Room calendars** lista el día de cada sala con una pista de cuándo entrar. Las horas se muestran en tu zona horaria. Solo se ven títulos y horarios: nunca invitados ni descripciones.
- **Límites:** es solo lectura, no se reserva nada desde el juego. No hay OAuth ni integración con la API de Google o Microsoft. Los cambios tardan hasta 5 minutos en verse (el servidor relee el feed cada 5 minutos y, si falla, muestra lo último que tenía). Las horas con una zona desconocida, o sin zona, se leen como UTC. Se entienden repeticiones diarias, semanales y mensuales (con excepciones y ocurrencias movidas o canceladas), pero no las anuales. La dirección debe ser https y pública: no se aceptan direcciones de una red privada.
- **Alternativa a futuro:** una integración OAuth con Google o Microsoft daría actualizaciones inmediatas, calendarios privados sin dirección secreta y reservar desde el juego, a cambio de registrar una aplicación y guardar credenciales por empresa.

### 3.13 Interacciones y sillas

Mirá una silla, un escritorio, una biblioteca o una planta a menos de 2,5 m: aparece una pista ("Click or F · Sit down", "Use the computer", "Read a book", "Look at the plant"). Clic izquierdo o F la usan; frente a una pizarra el clic dibuja.

- **Silla:** sentarte es opcional. El servidor revisa que la silla exista, esté libre (una persona por silla), estés cerca y sin pared de por medio. Los demás te ven sentado (con los brazos hacia el escritorio si la silla da a uno) y tu cámara baja. Te levantás con F, Espacio, W A S D o abriendo el menú, y quedás en un lugar libre junto a la silla. Mientras estás sentado podés chatear, hablar y hacer emotes; tu zona y tu voz usan el lugar de la silla.
- **Computadora y biblioteca:** la computadora muestra los anuncios del piso (los fijados primero, con fecha y un botón de enlace si lo tienen), la hora y el nombre de la sala; la biblioteca muestra la lista de libros y, al elegir uno, su texto con **Back** para volver. Mientras están abiertas el mouse queda libre para hacer clic y desplazar; F, Esc o **Close** las cierran. Si no hay nada cargado dicen "Nothing posted yet" / "This shelf has no books yet". Cada piso tiene su propio contenido (ver 3.15).
- **Planta:** un panel con su nombre y una descripción. F o Esc lo cierran.

### 3.15 Contenido de computadoras y bibliotecas (admins y jefes de piso)

En el lobby, el botón **Content** (lo ven los admins y quien puede editar su piso). Elegí la sala y, en las pestañas **Books** o **Announcements**, usá **Add a book** / **Add an announcement**; cada fila tiene **Edit** y **Delete** (pide confirmar).

- **Libro:** título (1 a 80 caracteres), autor (hasta 60), texto (hasta 4000) y enlace opcional. **Anuncio:** título, texto (hasta 1000), enlace opcional y el interruptor **Pinned** para que salga primero.
- **Máximo:** 50 libros y 50 anuncios por piso.
- **Solo texto:** los saltos de línea se respetan, pero no hay negritas, imágenes ni HTML: lo que escribas con `<b>` o `**` se ve tal cual. Los enlaces deben empezar con `https://` (no se aceptan `http://`, `javascript:` ni direcciones con usuario y contraseña) y se abren en otra pestaña solo si alguien hace clic.
- **Quién puede:** los admins en todos los pisos y **cada jefe de piso en su propio piso** (decisión tomada, igual que con el editor del piso). Los miembros solo leen, y solo los pisos a los que pueden entrar. Si preferís que lo haga solo el admin, es el cambio de una función (`mayEditContent`).
- Cada alta, cambio o baja queda en **Activity** (quién, piso, tipo y título; nunca el texto).
- **A futuro:** texto con formato (markdown o un subconjunto seguro), imágenes o archivos adjuntos (necesitan almacenamiento y revisión) y reordenar a mano.

### 3.14 Pisos (salas)

- **Mapa de pisos:** con la tecla **R** (o **Map of rooms** en el menú) se abre un mapa con el plano de cada piso en gris (solo si hay más de un piso; no existe en modo lite). Al pasar el mouse o enfocar con las flechas un piso al que podés entrar, se pinta de color y muestra su nombre; clic o Enter viaja. Si no podés entrar, queda gris y dice «This room is not available. If you want to visit it, contact your administrator.». El piso donde estás dice «You are here». Esc, **Close** o un clic fuera lo cierran y te devuelven el control.
- **Cambiar de piso (lista):** en el menú (Esc) está **Rooms** (solo aparece si hay más de un piso). Los pisos a los que no podés entrar están deshabilitados y dicen «Not available. Ask your administrator to visit it.». Al elegir uno viajás directo, sin pasar por el lobby, con el aviso «Travelling to …». Arriba a la izquierda se ve el nombre del piso. Cada piso tiene su chat, su gente, su voz y su editor: quienes están en pisos distintos no se ven ni se oyen.
- **Crear un piso (admin):** lobby, botón **Rooms**, escribir el nombre y **Make the room**. El id sale del nombre (letras minúsculas, números y guiones). Empieza con el diseño por defecto; todos los pisos comparten las mismas paredes y zonas por ahora.
- **Quién entra (admin):** pantalla **Manage people**: junto a «Head of …» hay columnas «Can enter …». El piso común, los admins y los jefes de ese piso aparecen marcados y no se pueden cambiar. Quitar una entrada o un jefe saca a la persona del piso al instante y la lleva a la oficina principal con un aviso.
- **Recursos humanos:** dar a las personas de RR. HH. una entrada a cada piso (o nombrarlas jefes de piso, que además les da el editor y la moderación). Los jefes no pueden dar entradas a otros.
- **Editor y lobby:** el editor edita el piso donde estás; el botón del lobby edita (y «Enter office» entra a) el último piso en que estuviste. `?floor=id` en el link elige el piso, también en modo lite (que entra al piso común si no se dice otro).

### 3.8 Editor del piso (jefes de piso y admins)

- **Plano 2D** del piso, **paleta** de piezas, **inspector** con valores numéricos y **lista de problemas** que bloquea publicar si algo es inválido.
- Se puede subir modelos 3D.
- **Mientras alguien edita, nadie más puede entrar**: el piso se bloquea al empezar y se libera con **Finish editing**, al cerrar la pestaña o tras 45 s sin actividad. Los que estaban dentro reciben un aviso y salen a los 3 segundos de publicar.
- Se publica a la base de datos, con versiones.
- También existe `editor.html`, una versión separada para desarrollo.

## 4. Controles

| Tecla                | Acción                                                                         |
| -------------------- | ------------------------------------------------------------------------------ |
| W A S D              | Moverse                                                                        |
| Shift                | Correr                                                                         |
| Mouse                | Mirar                                                                          |
| Enter                | Abrir el chat; elegí Everyone, Nearby o Direct; Enter envía, Esc cancela       |
| K                    | Golpear la puerta de una sala privada, o a la persona que tenés enfrente       |
| F o click            | Usar lo que mirás a menos de 2,5 m (sentarte, leer, mirar); sentado, F levanta |
| Espacio, W A S D     | Levantarte de la silla (también abrir el menú)                                 |
| M                    | Unirse a la voz; luego silenciar o activar                                     |
| C                    | Cámara; si no estás en la llamada, entra con el micrófono apagado              |
| P                    | Compartir pantalla (en la sala de reuniones)                                   |
| Z                    | Cambiar tu estado (pasa por los cuatro y vuelve al primero)                    |
| E + 1 a 5            | Mantené E y apretá un número: saludar, aplaudir, mano, pulgar, baile           |
| R                    | Mapa de pisos (si hay más de uno)                                              |
| Tab                  | Lista de personas                                                              |
| F3                   | Panel de diagnóstico                                                           |
| Click en una pizarra | Mantener para dibujar                                                          |
| 1 a 7                | Herramienta de la pizarra (7 es la goma)                                       |
| Backspace            | Borrar la pizarra                                                              |
| Esc                  | Soltar el mouse y abrir el menú                                                |

La voz y el video dependen de la distancia: el volumen baja al alejarte y el video solo llega de quienes están a menos de 6 m.

## 5. Acciones por rol

**Miembro**

- Entrar y salir de la oficina.
- Cambiar el aspecto cuando quiera.
- Elegir su estado y hacer gestos (emotes) que ven todos: el avatar mueve los brazos y un ícono flota sobre la cabeza durante 3 segundos.
- Chatear a todos, a quienes están cerca (los que te oyen, o los de tu sala privada) o por mensaje directo a una persona; el servidor decide quién recibe cada mensaje. Los mensajes directos llegan también a quien está en No molestar, pero sin aviso ni sonido.
- Golpear la puerta (K): en una sala privada avisa a quienes están adentro; si no, a la persona que mirás a menos de 3 m. Una vez cada 5 segundos, y nunca llega a quien está en No molestar.
- Chatear, hablar por voz, usar cámara, compartir pantalla y dibujar en pizarras.
- Ver qué pasa en cada sala privada (menú, **Room calendars**).
- Ajustar sensibilidad y mostrar u ocultar la barra de teclas.
- Entrar al piso común y a los pisos que se le dieron, y viajar entre ellos desde el menú (Rooms).

**Jefe de piso, además**

- Editar y publicar su piso.
- Moderar en su piso: silenciar, sacar o banear a miembros (no a admins).
- Cargar los libros y anuncios de su piso (Content).

**Admin, además**

- Nombrar o sacar jefes de piso.
- Crear pisos y decir quién puede entrar a cada uno (3.14).
- Invitar personas a la empresa.
- Permitir o no que cada uno elija su propio nombre (Settings).
- Ver el registro de actividad.
- Conectar el calendario de cada sala privada (Calendars).
- Cargar libros y anuncios de cualquier piso (Content).
- Crear la organización si es el primer admin.

## 6. Qué está hecho

- Inicio de sesión con Clerk, solo por invitación, sin segunda pantalla.
- Una instalación por empresa (guía en `docs/COMPANIES.md`).
- Roles, jefes de piso y la pantalla de personas.
- Bloqueo del piso, editor dentro del juego y diseños guardados con versiones.
- Menú del juego, aspecto editable en vivo y guardado del último aspecto.
- Chat, voz, video y pantalla compartida, pizarras.
- Chat con alcances (todos, cerca, directo), avisos con contador y sonido, y golpear la puerta.
- Estado de presencia (disponible, en reunión, no molestar, ausente) y emotes.
- Opciones guardadas en el navegador.

## 7. Qué está en la lista y todavía no existe

| Pendiente                                                                      | Qué hay hoy                                                                                    | Alternativa mientras tanto                                    |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Mapa para elegir piso** (vista gris, color al pasar el mouse)                | La lista **Rooms** del menú                                                                    | Usar la lista                                                 |
| **Grupos de roles** («todo RR. HH. entra a todos los pisos»)                   | Entradas por persona                                                                           | Dar la entrada a cada persona de RR. HH.                      |
| **Editar un borrador con el piso abierto**, y publicar en un horario tranquilo | Editar saca a todos                                                                            | Editar fuera de horario                                       |
| **Paredes, divisor, pizarra y pantalla como datos movibles**                   | Son fijos en el código                                                                         | Ninguna directa: se cambian en el código                      |
| **Piezas con altura y ángulo libre**                                           | Solo giros de 90° y siempre sobre el piso, así que una lámpara no puede ir sobre un escritorio | Elegir modelos que ya incluyan lo que va encima               |
| **Vista previa 3D en el editor**                                               | No hay                                                                                         | Tener el juego abierto en otra pestaña                        |
| **Huellas redondas o poligonales**                                             | Rectángulo medido sobre el modelo, así que una mesa redonda bloquea de más                     | Escribir ancho y profundidad a mano en el panel derecho       |
| **Mantenimiento programado**                                                   | No existe                                                                                      | Avisar por fuera y editar cuando no haya nadie                |
| **Invitar y asignar jefe de piso por email en un solo paso**                   | Se hace en dos pasos                                                                           | Invitar primero y asignar después en Personas                 |
| **Botones de "estado conocido bueno" en el editor**                            | No hay                                                                                         | Volver a una versión anterior desde la base de datos          |
| **Una sola instalación para muchas empresas**                                  | Una instalación por empresa                                                                    | Se deja para cuando haya decenas de empresas                  |
| **Restringir quién cambia su aspecto**                                         | Cualquiera, con 400 ms de espera entre cambios                                                 | Editar `mayChangeLook` en `server/look.ts`                    |
| **Restringir quién cambia su estado o hace emotes**                            | Cualquiera, con 400 ms de espera entre cambios de estado y 1 s entre emotes                    | Editar `mayChangeStatus` y `mayEmote` en `server/presence.ts` |
| **Integración con JIRA**                                                       | En pausa                                                                                       | Es un mecanismo aparte, del lado del servidor                 |

**Preguntas abiertas de diseño**

- Si el rango del jefe de piso sale del directorio de la empresa o de una tabla propia.
- Respondidas: un miembro entra al piso común y a los que un admin le dio (o dirige); la voz no pasa entre pisos.
- Cuántos pisos y personas debe soportar la primera versión.

## 8. Límites y qué no está verificado

- **Varios pisos:** el servidor (crear piso, entrar con y sin `floor`, piso inexistente, entrada concedida y quitada en vivo que saca a la persona, jefe quitado, intento de entrar por id de sala, sala de voz por piso, bloqueo por piso, permisos de admin vs jefe) lo probé con clientes reales de Colyseus y un inicio de sesión falso, sin base de datos; el viaje por el menú, el aviso, el nombre del piso y que Ana y Beto en pisos distintos no se ven, lo vi en el navegador sin inicio de sesión. No vi en el navegador un piso prohibido (sin sesión todos pueden entrar; solo con tests y clientes reales), ni las pantallas de admin (Rooms, columnas Can enter), ni el viaje con LiveKit real, ni con una cuenta real de Clerk. La Postgres de verdad no se tocó: las migraciones y tiendas se probaron en PGlite. Con varios procesos del servidor, quitar una entrada solo saca a la persona del proceso que atendió el pedido; los demás lo notan al próximo ingreso.

- **Modo lite** (sin WebGL, dispositivo solo táctil, o ventana de menos de 768 px): en vez de la oficina 3D se muestra una pantalla que dice por qué, y deja ver quién está conectado, leer y mandar chat, abrir los calendarios de las salas y unirse a la llamada de voz (escuchás a todos los de la oficina abierta y podés silenciarte). No incluye: ver ni recorrer la oficina (te quedás donde aparecen los recién llegados, así que el chat "Cerca" y lo que otros oyen de tu voz salen de ese punto), cámara, compartir pantalla, estado, emotes, golpear la puerta ni pizarras. `?view=lite` o `?view=office` en el link fuerzan una u otra vista. Lo vi funcionando en un navegador de escritorio con WebGL bloqueado y con emulación táctil de 390 px (nombre, lista, chat, calendarios); no lo probé en un teléfono real, ni el teclado virtual (Enter), ni unirme a la llamada de voz, ni con una cuenta real de Clerk.
- Muebles: los dibujos son de cajas y cilindros (sin descargas), con detalles chicos (teclas, tazas, manijas, ruedas de la silla) que la calidad Baja omite. La lógica pura (huella, altura del asiento, que nada flote, presupuesto de triángulos) tiene tests, y los vi en el navegador desde varios puntos con calidad Alta y Baja. No medí fps reales ni los probé en una GPU de verdad (solo render por software en un navegador sin cabeza).
- Interacciones y sillas: el servidor (sentarse, ocupada, lejos, levantarse, soltar al salir) lo probé con dos clientes reales de Colyseus, y en el navegador con dos pestañas (Ana se sienta, Beto la ve sentada frente al escritorio, Beto no puede tomar la misma silla, Ana se levanta con Espacio y con W A S D, el clic también sienta, el panel de la computadora se abre y cierra). El pointer lock real se simuló en la página, así que Esc con el mouse realmente bloqueado (cierra el panel sin abrir el menú), abrir el menú sentado y el clic en una pizarra con una silla a la vista están cubiertos solo por tests y lectura del código. Los sofás no son asientos.
- Calidad gráfica: la lógica pura (decisión de Auto, perfiles, ajustes guardados) tiene tests, y vi en el navegador que la opción se guarda y que el panel F3 muestra el modo. No medí fps antes y después en una GPU lenta real.

- Los pisos nuevos no se pueden borrar ni renombrar desde la pantalla (el renombrar existe en la API: `POST /admin/floors/<id>`).
- Un solo editor a la vez, a propósito, para que dos personas no se pisen.
- Esc con el mouse bloqueado de verdad, el redibujado del avatar para otro cliente y el guardado del aspecto con una cuenta real de Clerk están probados con tests, pero no los vi funcionando en un navegador.
- Estado y emotes: los vi funcionando en el navegador con dos pestañas (punto de color, lista, emote visible en la otra). El paso a Away tras 5 minutos sin tocar nada está probado con tests, pero no esperé esos minutos en el navegador. Tampoco los probé con la pantalla de bloqueo real del mouse ni con una cuenta real de Clerk.
- Chat por alcances y golpear la puerta: los vi funcionando en el navegador con tres pestañas (todos, directo solo al destinatario, insignia y aviso, No molestar sin aviso, golpe a quien se mira y espera de 5 s). "Cerca" y golpear a una sala privada solo están probados con tests (no pude teletransportar jugadores), y tampoco probé el sonido, las notificaciones del navegador ni el contador del título con la pestaña realmente oculta.
- Moderación y registro de actividad: los vi funcionando en el navegador con dos pestañas y un inicio de sesión de prueba (remove, ban, rechazo al reintentar, aviso de mute, pantallas Personas y Activity con paginación) y con clientes reales de Colyseus. El silenciado real de un micrófono en LiveKit solo está probado con tests (un cliente de prueba): no publiqué audio de verdad. Tampoco probé con una cuenta real de Clerk. Los bans se pierden al reiniciar el servidor.
- Calendarios de las salas: el parser, la lectura del feed (con protección contra SSRF), la API y las pantallas están probados con tests, y los vi funcionando en el navegador con un servidor ICS local (línea de la sala, pantalla del día, pantalla de admin con Test, Save y Remove). No los probé con un feed real de Google ni de Outlook, ni con un inicio de sesión real de Clerk, ni en la sala de reuniones real: moví temporalmente la zona para llegar a ella en el navegador.
