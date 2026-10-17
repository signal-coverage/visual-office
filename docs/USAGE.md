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

No se puede moderar a un admin ni a uno mismo. El servidor revisa tu rol en cada acción. Los bans se guardan en la base de datos: sobreviven a un reinicio o a un deploy del servidor y terminan solos a la hora indicada (si el servidor corre sin base de datos, siguen en memoria y un reinicio los olvida). Levantar un ban borra el registro. Los cambios de un ban se ven a lo sumo unos segundos después en quien intente entrar.

### 3.11 Actividad (admins)

El botón **Activity** del lobby abre el registro de quién hizo qué, lo más nuevo primero: moderación, cierre y publicación de pisos, jefes nombrados, cambios de Settings y cuando se crea la empresa. Muestra 50 líneas y **Load more** trae las anteriores. El registro solo crece: no se borra solo. Si hace falta limpiarlo, se borra en la base de datos por fecha.

### 3.12 Calendarios de las salas

Cada sala privada de cada piso (la sala de reuniones de la oficina principal, y las salas privadas que traiga la plantilla de otros pisos) puede mostrar qué pasa en ella, para saber cuándo sumarse. Las salas de otros pisos aparecen con el nombre del piso ("Meeting room A · Marketing"); el feed de la oficina principal sigue guardado como antes.

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
- **Crear un piso (admin):** lobby, botón **Rooms**, escribir el nombre y **Make the room**. El id sale del nombre (letras minúsculas, números y guiones). Elegís además una **plantilla** (lista desplegable con una línea de cada una): **Open office** (la oficina de siempre), **Open floor** (un espacio abierto con escritorios y pizarras en la pared, sin salas privadas), **Meeting floor** (tres salas de reuniones con paredes de vidrio, pizarra y pantalla cada una, más un lounge) y **Lounge** (sillones, barra y plantas). Cada plantilla define el tamaño del piso, sus paredes, sus salas privadas (cada una con su propia voz y su calendario), pizarras y pantallas, y los muebles. **Después** se puede cambiar la forma del piso desde el editor (sección 3.8): modo **Structure** y **Apply template…**. _Alternativa:_ si preferís no tocar un piso que ya se usa, creá otro con la plantilla correcta y mové ahí a la gente.
- **Quién entra (admin):** pantalla **Manage people**: junto a «Head of …» hay columnas «Can enter …». El piso común, los admins y los jefes de ese piso aparecen marcados y no se pueden cambiar. Quitar una entrada o un jefe saca a la persona del piso al instante y la lleva a la oficina principal con un aviso.
- **Renombrar y archivar (admin):** en **Rooms**, cada piso tiene **Rename** (el id no cambia, así que links y entradas siguen andando) y **Archive** (pide confirmar). Un piso archivado desaparece para todos: del mapa, de la lista del menú, de Personas y de Calendars/Content; nadie puede entrar, tampoco los admins, y quien está adentro pasa a la oficina principal con el aviso «That room was archived. Moving you to the main office.». Entrar por `?floor=` dice «This room is archived and cannot be entered.». No se borra nada: el diseño, el contenido, las entradas y el historial siguen guardados. Abajo, en **Archived**, el botón **Unarchive** lo trae de vuelta tal cual estaba. **Límites:** la oficina principal y el último piso común no se pueden archivar. _Alternativa:_ si solo querés que nadie entre un rato, cerrarlo para editar (lock) lo hace sin esconderlo.
- **Grupos (admin):** en vez de tildar persona por persona, el botón **Groups** del lobby arma grupos de personas que reciben los mismos pisos. Ejemplo, **Recursos Humanos**: **New group**, nombre «Recursos Humanos», tildá todos los pisos en «Rooms this group can enter», buscá y tildá a las personas de RR. HH. y **Save**. Desde ese momento entran a todos esos pisos. En **Personas**, cada una muestra la marca del grupo y, en los pisos que le da el grupo, «via Recursos Humanos» (casilla marcada y bloqueada; si además tiene una entrada propia, esa se puede sacar aparte). Para cambiar el grupo: **Edit**; para borrarlo: **Delete** (pide confirmar). Quien pierde un piso por un cambio de grupo, y no lo tiene de otra forma, pasa al instante a la oficina principal. **Límites:** hasta 30 grupos, 200 personas y 40 pisos por grupo; el nombre es único y de hasta 40 caracteres; el piso común no se puede dar (todos entran). Solo los admins gestionan grupos; los jefes de piso no. Con varios procesos del servidor, la salida inmediata solo alcanza al proceso que atendió el pedido. _Alternativas:_ una entrada por persona en Personas (sirve para casos sueltos), o nombrarlas jefes de piso (además les da el editor y la moderación).
- **Recursos humanos:** crear un grupo (arriba) con todos los pisos, o dar a cada persona una entrada a cada piso, o nombrarlas jefes de piso. Los jefes no pueden dar entradas a otros.
- **Editor y lobby:** el editor edita el piso donde estás; el botón del lobby edita (y «Enter office» entra a) el último piso en que estuviste. `?floor=id` en el link elige el piso, también en modo lite (que entra al piso común si no se dice otro).

### 3.8 Editor del piso (jefes de piso y admins)

- **Plano 2D** del piso, **paleta** de piezas, **inspector** con valores numéricos y **lista de problemas** que bloquea publicar si algo es inválido.
- Se puede subir modelos 3D.
- **Dos modos** (botones **Furniture** y **Structure** arriba): _Furniture_ mueve muebles y modelos; _Structure_ edita las paredes, las salas y todo lo que define el piso. En Structure los muebles se ven pálidos y no se pueden elegir.
- **Dibujar una pared:** modo Structure, herramienta **Wall** (o **Glass wall** para vidrio), arrastrá sobre el plano. Un arrastre corto y recto da una pared fina (0,2 m; vidrio 0,15 m) sobre la línea; todo se ajusta a una grilla de 25 cm (el control **Snap** la cambia).
- **Dibujar una sala privada:** herramienta **Private room**, arrastrá un rectángulo (mínimo 2 m por lado) y escribí el nombre. Quien está adentro habla solo con los de adentro. **Area** hace lo mismo pero solo con nombre (no cambia quién oye a quién).
- **Pizarra y pantalla:** herramientas **Whiteboard** y **Screen**, un clic sobre una pared; se cuelgan de la cara más cercana. La pizarra es de la sala a la que mira (o del piso abierto); la pantalla necesita una sala. El vidrio no puede sostenerlas.
- **Seleccionar y mover:** herramienta **Select**; clic en una parte, arrastrar para moverla, flechas para empujarla, **Delete** para borrarla. El panel derecho tiene x, z, ancho, profundidad, nombre e id. Borrar una sala borra también sus pizarras y pantallas.
- **Tamaño del piso** (16 a 48 m de ancho, 12 a 36 m de fondo; la altura es fija, 3,2 m), **dónde aparece la gente** y **parches de piso** están en el mismo modo. Si algo queda fuera del piso, el panel lo cuenta y la lista de problemas lo marca.
- **Apply template…:** elige una de las cuatro plantillas y **REEMPLAZA** la estructura (y los muebles, si dejás tildada la casilla «Also replace the furniture»). Es solo un borrador hasta **Publish**, y **Undo** lo deshace.
- **Problemas:** los **errores** (algo mal en la estructura: una sala sin área, una pizarra fuera de una pared, más partes que el límite…) bloquean **Publish** hasta arreglarlos; las **advertencias** (un mueble dentro de una pared nueva, una sala a la que nadie llega) piden confirmación. Un clic en un problema selecciona y marca la parte. Los muebles nunca se borran solos.
- **Límites:** 40 paredes, 40 vidrios, 12 parches de piso, 8 salas privadas, 12 áreas, 6 pizarras y 6 pantallas; paredes alineadas a los ejes; sin vista previa 3D (publicá y entrá para verlo). _Alternativa:_ si el piso ya se usa mucho, probá primero en otro piso. **Save to file** y **Export published** quedan apagados en un piso con estructura propia.
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

### 4b. Jugar desde el teléfono o la tablet

Si el único puntero de tu dispositivo es un dedo (teléfono o tablet sin mouse) y el navegador sabe dibujar 3D (WebGL), entrás a la **misma oficina 3D** con controles táctiles. No hay teclado, no hay mouse que capturar y por eso no aparece «Click to control your character». Si el navegador no tiene WebGL, o la ventana es angosta y tiene mouse, ves el modo lite (sección 8).

| Gesto                     | Acción                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pulgar izquierdo, palanca | Moverte; llevala hasta el borde para correr                                                                                                           |
| Pulgar derecho, arrastrar | Mirar alrededor (la sensibilidad del menú también vale acá; arrastrar hacia arriba mira hacia arriba)                                                 |
| Tocar un objeto           | Usarlo (sentarte, leer, mirar), si está a menos de 2,5 m                                                                                              |
| Botón grande              | «Sit down», «Use the computer»… cuando mirás algo; «Stand up» sentado (empujar la palanca también te levanta)                                         |
| Botones de la derecha     | Menú, chat (con botón Send), voz, cámara (si el servidor tiene voz), lista de personas, mapa de pisos (si hay más de uno), emotes y golpear la puerta |

- Podés caminar y mirar a la vez (un pulgar en cada lado). Con el menú, el chat, el mapa o una computadora abiertos, la palanca y los botones se esconden y tu personaje no se mueve ni gira por detrás.
- La primera vez aparece un cartel («How to move») que explica qué hace cada pulgar; se cierra con **Got it** y no vuelve (se recuerda en ese navegador).
- Los gráficos arrancan en **Low** (sin sombras, resolución a 1x): gasta menos batería y calienta menos. Si querés más nitidez, elegí **High** en Options.
- Las insignias de arriba a la izquierda (tu nombre, el piso, la sala) van en una columna, y los avisos salen en el medio de la pantalla, para no tapar los botones ni la muesca del teléfono. Funciona en vertical y en horizontal.
- El chat usa un campo normal (con el teclado del teléfono): tiene un botón **Send** y una ✕ para cerrarlo, y sube sobre el teclado.
- No hay compartir pantalla ni dibujar en las pizarras con el dedo (la pizarra necesita el botón del mouse apretado).
- Desde el menú, **Lite view (no 3D)** pasa al modo lite si el teléfono va lento. Para probar los controles táctiles en una computadora: `?controls=touch` en el link; para forzar el mouse en un dispositivo táctil: `?controls=mouse`.

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
- Crear, renombrar y archivar pisos, y decir quién puede entrar a cada uno, uno por uno o con grupos (3.14).
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
- Teléfono y tablet: la oficina 3D con controles táctiles (sección 4b), y hablar desde el modo lite.
- Pruebas de extremo a extremo con Playwright (`npm run test:e2e`, sección Testing del README): lobby, menú, aspecto, estado y emotes, chat, interacciones, pisos, un teléfono emulado (táctil) y la voz del modo lite, y las regresiones corregidas, con un servidor propio y sin base de datos. No cubren el inicio de sesión de Clerk, una llamada de LiveKit que conecte de verdad, el bloqueo real del mouse, un teléfono real ni una Postgres real.

## 7. Qué está en la lista y todavía no existe

| Pendiente                                                                      | Qué hay hoy                                                                                    | Alternativa mientras tanto                                    |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **Mapa para elegir piso** (vista gris, color al pasar el mouse)                | La lista **Rooms** del menú                                                                    | Usar la lista                                                 |
| **Grupos de roles** («todo RR. HH. entra a todos los pisos»)                   | Entradas por persona                                                                           | Dar la entrada a cada persona de RR. HH.                      |
| **Editar un borrador con el piso abierto**, y publicar en un horario tranquilo | Editar saca a todos                                                                            | Editar fuera de horario                                       |
| **Redimensionar paredes y salas arrastrando**                                  | Se escriben los números en el panel derecho                                                    | Escribir x, z, ancho y profundidad                            |
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

## 7b. Copias de seguridad y reinicios (para quien administra el servidor)

- **Reinicios:** cuando el servidor se reinicia (un deploy, por ejemplo), a todos los conectados les aparece "The server is restarting, you will be back in a moment." y el juego los vuelve a meter solo en el mismo piso a los pocos segundos. Si el servidor tarda más de un minuto en volver, quedan en la pantalla inicial con el aviso de que no se pudo conectar.
- **Estado del servidor:** `GET /health` responde `ok`, el tiempo encendido, si la base responde (`up`, `down` o `none`) y la versión. No dice nada de personas. En Railway se configura como "health check path".
- **Copia de los datos de la app:** `npm run backup -- --server https://tu-servidor --token-file token.txt --out empresa.json` guarda en un solo archivo los pisos (con los archivados), quién puede entrar a cada uno, jefes, grupos, ajustes, calendarios, libros y avisos, el diseño actual de cada piso y el registro de actividad. El token va en la primera línea de `token.txt` (el `FLOOR_ADMIN_TOKEN` del servidor, o el token de sesión de un admin, que dura solo un minuto). Las direcciones secretas de los calendarios **no** se guardan, salvo con `--include-secrets` (en ese caso tratá el archivo como una contraseña). `--all-versions` suma el historial de cada diseño. `npm run backup:check -- --file empresa.json` verifica el archivo (formato y checksum) y muestra qué contiene.
- **No hay comando para restaurar**, a propósito: restaurar encima de una empresa en marcha puede pisar trabajo nuevo. Para volver atrás se usa la restauración a un momento anterior de Neon (o una rama de Neon para mirar cómo estaba todo) y, para recuperar una sola cosa, se lee el archivo y se vuelve a cargar a mano.
- **Errores:** si se configura `SENTRY_DSN` (servidor) y `VITE_SENTRY_DSN` (sitio), los errores inesperados se avisan a Sentry sin datos personales ni claves. Sin esas variables no se carga nada ni se envía nada.
- **Límite de pedidos:** cada dirección puede hacer 1200 pedidos por minuto a cada zona (`/account`, `/calendar`, `/admin`); pasado eso recibe "Too many requests" y tiene que esperar unos segundos.

## 8. Límites y qué no está verificado

- **Varios pisos:** el servidor (crear piso, entrar con y sin `floor`, piso inexistente, entrada concedida y quitada en vivo que saca a la persona, jefe quitado, intento de entrar por id de sala, sala de voz por piso, bloqueo por piso, permisos de admin vs jefe) lo probé con clientes reales de Colyseus y un inicio de sesión falso, sin base de datos; el viaje por el menú, el aviso, el nombre del piso y que Ana y Beto en pisos distintos no se ven, lo vi en el navegador sin inicio de sesión. No vi en el navegador un piso prohibido (sin sesión todos pueden entrar; solo con tests y clientes reales), ni las pantallas de admin (Rooms, columnas Can enter), ni el viaje con LiveKit real, ni con una cuenta real de Clerk. La Postgres de verdad no se tocó: las migraciones y tiendas se probaron en PGlite. Con varios procesos del servidor, quitar una entrada solo saca a la persona del proceso que atendió el pedido; los demás lo notan al próximo ingreso.

- **Modo lite** (sin WebGL, ventana de menos de 768 px con mouse, `?view=lite` o el botón **Lite view (no 3D)** del menú en el teléfono; los dispositivos solo táctiles con WebGL ya no caen acá, van a la oficina 3D con controles táctiles): en vez de la oficina 3D se muestra una pantalla que dice por qué, y deja ver quién está conectado, leer y mandar chat, abrir los calendarios de las salas y **unirse a la llamada de voz y hablar**: escuchás a todos los de la oficina abierta, te escuchan, y podés silenciarte. El micrófono se pide **solo cuando apretás «Join voice»**, nunca antes. Los estados del botón son: sin voz en el servidor (la pantalla lo dice: «Voice is not available on this server»), «Join voice», conectando, micrófono prendido (con el medidor de nivel), silenciado y falló (con el motivo al lado: micrófono bloqueado, sin micrófono, en uso por otra app, página sin https, o no se pudo conectar; el botón reintenta). No incluye: ver ni recorrer la oficina (te quedás donde aparecen los recién llegados, así que el chat "Cerca" y lo que otros oyen de tu voz salen de ese punto), cámara, compartir pantalla, estado, emotes, golpear la puerta ni pizarras. `?view=lite` o `?view=office` en el link fuerzan una u otra vista. Lo vi funcionando en un navegador de escritorio con WebGL bloqueado y con emulación táctil de 390 px (nombre, lista, chat, calendarios, el botón de voz y su error cuando la llamada no conecta); **no pude ver hablar de verdad**: en las pruebas no hay LiveKit, así que la llamada nunca conecta (vi «Join voice» → «Call failed» con el motivo, no «Mic on» ni el medidor moviéndose). No lo probé en un teléfono real, ni el teclado virtual (Enter), ni con una cuenta real de Clerk.
- **Teléfono y tablet (controles táctiles):** lo construí y lo vi en un teléfono **emulado** en Chromium (390x844 y 844x390, y capturas con un iPhone 14 Pro de 393x852 y 852x393): la oficina 3D carga, la palanca camina y corre, el pulgar derecho gira (y los dos a la vez), el botón grande sienta y levanta, tocar la silla sienta, el menú y el chat salen de sus botones, el layout no se desborda ni hay scroll lateral ni zoom, y ningún control se tapa con otro. **No probé en un teléfono real, ni la latencia ni el tacto de un pulgar de verdad, ni iOS Safari ni Chrome en iOS** (la barra del navegador que aparece y desaparece y cambia el alto de la página, el teclado virtual tapando el chat o no abriéndose al abrirlo, el zoom por pellizco, el «unlock» del audio: iOS solo deja empezar el sonido desde un toque, y unirse a la voz descarga LiveKit antes, así que puede hacer falta un segundo toque), ni la batería y el calor tras un rato largo, ni una tablet con teclado. Los gráficos arrancan en Bajo. Alternativas si va lento o mal: el modo lite desde el menú, o una computadora (compartir pantalla y pizarras solo existen allí).
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
- Operaciones (bans persistentes, `/health`, reinicio ordenado, límite de pedidos, copias de seguridad): los bans y la migración están probados con tests contra la memoria y contra PGlite (una base Postgres en memoria), incluido "un ban sobrevive a un reinicio del almacén". El reinicio ordenado lo vi con un servidor propio sin base de datos y un cliente real de Colyseus (el cliente recibe el código 4012 y el servidor sale solo en milisegundos); no probé una señal SIGTERM real (en Windows no existe, usé el mensaje `shutdown`) ni un deploy real en Railway, y no vi el reintento automático del navegador tras un reinicio (solo está probado con tests). `npm run backup` lo probé contra un servidor propio vacío (sin base de datos), no contra una empresa con datos ni con un token de admin de Clerk. Sentry no se probó contra el servicio real: el envío está probado con un `fetch` falso y no se mandó nada a ningún servicio. No toqué ninguna base de datos real ni la restauración de Neon.
