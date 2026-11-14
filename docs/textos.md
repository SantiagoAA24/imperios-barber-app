# Textos de la app

Tabla de **todos los textos que ve una persona** en Imperio Barber, para que el dueño los revise.
Se genera sola desde el código: **no la edites a mano**; corrige el texto en el código y vuelve a generarla con
`pnpm --filter web texts` (CI falla si queda desactualizada).

**Criterios de redacción** (ya aplicados): español de Colombia, tuteo («tú», «tu cita», «elige», «revisa»), nunca «usted»;
mayúscula solo al inicio de la frase y en nombres propios («Agenda tu cita», no «Agenda Tu Cita»); precios con punto de miles
(`$22.000`); horas en 12 horas con «am»/«pm» en minúscula (`10:30 am`); «celular» (no «móvil» ni «teléfono»); «cita» (no «reserva» ni «turno», salvo «turno sin cita»).

«Contexto» dice dónde aparece: la etiqueta HTML (título `h1`/`h2`, párrafo `p`, botón `button`, enlace `a`…), «lectores de pantalla»
si solo lo oyen quienes usan lector (no se ve en pantalla), o «aviso o texto según el caso» si lo arma el código (mensajes de error, títulos de ventana, textos con datos).
Las partes variables van como `{…}` (nombre, hora, precio…).

Total: 606 textos de la interfaz y 51 mensajes del servidor.

## Acceso del personal

| Texto | Contexto |
| --- | --- |
| Cargando… | párrafo |
| No pudimos verificar tu sesión. Revisa tu conexión e inténtalo de nuevo. | párrafo |

## Admin

| Texto | Contexto |
| --- | --- |
| Servicios y productos | h1 |
| Lo que ven tus clientes al agendar y en el catálogo del local. | párrafo |
| Sección | lectores de pantalla (aria-label) |
| Tienes cambios sin guardar | título de ventana |
| Si sales ahora, perderás lo que editaste. | párrafo |
| Seguir editando | botón |
| Salir sin guardar | botón |

## Admin · Agenda de la semana

| Texto | Contexto |
| --- | --- |
| Agenda de la semana | aviso o texto según el caso |
| Semana anterior | aviso o texto según el caso |
| Semana siguiente | aviso o texto según el caso |
| Carriles por barbero | lectores de pantalla (aria-label) |
| Cada columna de día se divide en un carril por barbero. | lista |
| Agenda de la semana | lectores de pantalla (aria-label) |
| Cargando la semana… | texto |
| No pudimos cargar la semana. | aviso con «Reintentar» |
| Citas del {…} | lectores de pantalla (aria-label) |
| Citas del {…} | texto |

## Admin · Agenda del día

| Texto | Contexto |
| --- | --- |
| Agenda | h1 |
| Cambiar de fecha | lectores de pantalla (aria-label) |
| Hoy | enlace |
| Vista | lectores de pantalla (aria-label) |
| Día | enlace |
| Semana | enlace |
| Nueva cita | botón |
| Agenda del día | aviso o texto según el caso |
| Día anterior | aviso o texto según el caso |
| Día siguiente | aviso o texto según el caso |
| Ir a un día | etiqueta de campo |
| Agenda del día | lectores de pantalla (aria-label) |
| Cargando la agenda… | texto |
| No pudimos cargar la agenda. | aviso con «Reintentar» |
| Hora | texto |
| No hay citas para este día. Crea una con «Nueva cita». | párrafo |
| Citas de {…} | lectores de pantalla (aria-label) |
| Citas de {…} | texto |
| Uso de {…} | lectores de pantalla (aria-label) |
| Uso de {…} | texto |
| En uso · | texto |
| Ahora | texto |
| Turno sin cita | aviso o texto según el caso |
| Sin celular | aviso o texto según el caso |
| Usa el vaporizador | aviso o texto según el caso |
| Detalle de la cita | lectores de pantalla (aria-label) |
| Cita | h2 |
| Cerrar | botón |
| Atendida | botón |
| No asistió | botón |
| Cancelar cita | botón |
| Esta cita ya está | párrafo |
| : no hay más acciones. | párrafo |
| ¿Cancelar esta cita? | título de ventana |
| La cita de | párrafo |
| ) quedará cancelada y el horario volverá a estar libre. | párrafo |
| Mantener cita | botón |
| Sí, cancelar cita | botón |
| Elige un barbero. | aviso o texto según el caso |
| Elige un servicio. | aviso o texto según el caso |
| Elige una hora. | aviso o texto según el caso |
| Escribe el nombre del cliente. | aviso o texto según el caso |
| Nueva cita | lectores de pantalla (aria-label) |
| Nueva cita | h2 |
| Barbero | etiqueta de campo |
| Elige un barbero | opción de lista |
| Servicio | etiqueta de campo |
| Elige un servicio | opción de lista |
| Día | etiqueta de campo |
| Hora | etiqueta de campo |
| Elige barbero y servicio | aviso o texto según el caso |
| Buscando horarios… | aviso o texto según el caso |
| Sin horarios libres ese día | aviso o texto según el caso |
| Elige una hora | aviso o texto según el caso |
| Nombre del cliente | etiqueta de campo |
| Celular (opcional) | etiqueta de campo |
| 10 dígitos, para contactarlo por WhatsApp. | ayuda bajo el campo |
| Crear cita | botón |
| Cancelar | botón |

## Admin · Barberos

| Texto | Contexto |
| --- | --- |
| Clave temporal | lectores de pantalla (aria-label) |
| Clave temporal de | aviso |
| . Entrégasela en persona: tendrá que cambiarla al ingresar. | aviso |
| Clave temporal generada | lectores de pantalla (aria-label) |
| Copiar | botón |
| No volverás a ver esta clave. | aviso |
| Clave copiada. | aviso o texto según el caso |
| No pudimos copiarla: selecciónala y cópiala a mano. | aviso o texto según el caso |
| Ya la copié | botón |
| Citas pendientes de {…} | lectores de pantalla (aria-label) |
| Citas pendientes de {…} | sección |
| quedó inactivo y tiene | texto destacado |
| No se cancelaron: muévelas o cancélalas desde la agenda. | aviso |
| Escribe el nombre (mínimo 2 letras). | aviso o texto según el caso |
| Escribe un correo válido. | aviso o texto según el caso |
| Barberos | h1 |
| Quién atiende y aparece al agendar. Nada se borra: se desactiva. | párrafo |
| Agregar barbero | botón |
| Agregar barbero | lectores de pantalla (aria-label) |
| Agregar barbero | h2 |
| Nombre | etiqueta de campo |
| Correo | etiqueta de campo |
| Con este correo ingresará. Le daremos una clave temporal. | ayuda bajo el campo |
| Crear barbero | botón |
| Cancelar | botón |
| Equipo | lectores de pantalla (aria-label) |
| Cargando barberos… | texto |
| No pudimos cargar los barberos. | aviso con «Reintentar» |
| Aún no tienes barberos. Agrega el primero con «Agregar barbero». | párrafo |
| Barberos del negocio | título de tabla (solo lectores de pantalla) |
| Barbero | encabezado de columna |
| Aparece al agendar | encabezado de columna |
| Activo | encabezado de columna |
| Acciones | encabezado de columna |
| Debe cambiar su clave temporal | texto |
| Inactivo: no puede ingresar | texto |
| Aparece al agendar: {…} | etiqueta de campo |
| Aparece al agendar: {…} | interruptor (nombre) |
| Activo: {…} | etiqueta de campo |
| Activo: {…} | interruptor (nombre) |
| Reiniciar clave de {…} | lectores de pantalla (aria-label) |
| Reiniciar clave de {…} | botón |
| Reiniciar clave | botón |
| ¿Desactivar a este barbero? | título de ventana |
| dejará de aparecer al agendar y no podrá ingresar. Sus citas no se borran ni se cancelan: te mostraremos las que tiene pendientes. | párrafo |
| Mantenerlo activo | botón |
| Desactivar barbero | botón |
| ¿Reiniciar la clave? | título de ventana |
| Se generará una clave temporal nueva para | párrafo |
| , se cerrarán sus sesiones y tendrá que cambiarla al ingresar. La verás una sola vez. | párrafo |
| Sí, reiniciar clave | botón |

## Admin · barra lateral

| Texto | Contexto |
| --- | --- |
| Servicios y productos | aviso o texto según el caso |
| Cerrar sesión | botón |
| Administración | lectores de pantalla (aria-label) |

## Admin · Clientes

| Texto | Contexto |
| --- | --- |
| Con inasistencias | aviso o texto según el caso |
| Sin visitas | aviso o texto según el caso |
| Clientes | h1 |
| Lista de clientes | lectores de pantalla (aria-label) |
| Buscar cliente | etiqueta de campo |
| Nombre o últimos dígitos | texto de ayuda en el campo |
| Filtro | lectores de pantalla (aria-label) |
| Cargando clientes… | texto |
| No pudimos cargar los clientes. | aviso con «Reintentar» |
| No encontramos clientes con esa búsqueda o filtro. | aviso o texto según el caso |
| Aún no tienes clientes. Aparecen cuando agendan su primera cita. | aviso o texto según el caso |
| Clientes de la barbería | título de tabla (solo lectores de pantalla) |
| Cliente | encabezado de columna |
| Celular | encabezado de columna |
| Citas | encabezado de columna |
| Última visita | encabezado de columna |
| Asistencia | encabezado de columna |
| Mostrando | párrafo |
| de | párrafo |
| · el celular se muestra parcial por privacidad. | párrafo |
| Cargar más | botón |
| Sin celular | aviso o texto según el caso |
| Detalle del cliente | lectores de pantalla (aria-label) |
| Cargando el detalle… | texto |
| No pudimos cargar el detalle. | aviso con «Reintentar» |
| Celular: | texto |
| Escribir por WhatsApp a {…} (se abre en otra pestaña) | lectores de pantalla (aria-label) |
| Escribir por WhatsApp a {…} (se abre en otra pestaña) | botón |
| Escribir por WhatsApp | botón |
| Este cliente no dejó celular. | párrafo |
| Visitas | dato (etiqueta) |
| Inasistencias | dato (etiqueta) |
| Favorito | dato (etiqueta) |
| Últimas visitas | lectores de pantalla (aria-label) |
| Últimas visitas | h3 |
| Todavía no tiene citas. | párrafo |
| Notas del barbero | etiqueta de campo |
| caracteres. | párrafo |
| Notas guardadas. | aviso |
| Guardar notas | botón |
| Sin datos | aviso o texto según el caso |
| Cliente desde {…} | aviso o texto según el caso |
| Hola {…}, te escribo de Imperio Barber. | aviso o texto según el caso |

## Admin · Productos

| Texto | Contexto |
| --- | --- |
| Administrar productos | aviso o texto según el caso |
| Agregar producto | botón |
| Productos | lectores de pantalla (aria-label) |
| Cargando productos… | texto |
| No pudimos cargar los productos. | aviso con «Reintentar» |
| Aún no tienes productos. Agrega el primero con «Agregar producto». | párrafo |
| Productos del catálogo, en el orden en que se muestran | título de tabla (solo lectores de pantalla) |
| Producto | encabezado de columna |
| Precio | encabezado de columna |
| Disponibilidad | encabezado de columna |
| Estado | encabezado de columna |
| Acciones | encabezado de columna |
| Oculto para los clientes | texto |
| Disponible | texto |
| Agotado | texto |
| Visible para los clientes: {…} | etiqueta de campo |
| Visible para los clientes: {…} | interruptor (nombre) |
| Subir {…} | lectores de pantalla (aria-label) |
| Subir {…} | botón |
| Bajar {…} | lectores de pantalla (aria-label) |
| Bajar {…} | botón |
| Editar {…} | lectores de pantalla (aria-label) |
| Editar {…} | botón |
| ¿Ocultar este producto? | título de ventana |
| » dejará de aparecer en el catálogo. Puedes volver a mostrarlo cuando quieras. | párrafo |
| Mantenerlo visible | botón |
| Ocultar producto | botón |
| Editar producto | aviso o texto según el caso |
| Agregar producto | aviso o texto según el caso |
| Nombre | etiqueta de campo |
| Precio | etiqueta de campo |
| Descripción | etiqueta de campo |
| Opcional, máximo 200 caracteres. | ayuda bajo el campo |
| Enlace de la foto | etiqueta de campo |
| Opcional. Solo enlaces https://; por ahora no se suben archivos. | ayuda bajo el campo |
| Hay en inventario | texto |
| Se muestra como «Agotado». | aviso o texto según el caso |
| Hay en inventario | etiqueta de campo |
| Visible para los clientes | texto |
| Aparece en el catálogo. | aviso o texto según el caso |
| Oculto: no aparece en el catálogo. | aviso o texto según el caso |
| Visible para los clientes | etiqueta de campo |
| Cambios guardados. | aviso |
| Guardar cambios | aviso o texto según el caso |
| Crear producto | aviso o texto según el caso |
| Cancelar | botón |
| Eliminar producto | botón |
| ¿Eliminar este producto? | título de ventana |
| » se borrará del catálogo para siempre. Si solo quieres quitarlo por un tiempo, ocúltalo. | párrafo |
| Conservar producto | botón |
| Sí, eliminar | botón |
| El nombre debe tener entre 2 y 60 letras. | aviso o texto según el caso |
| La descripción puede tener máximo 200 caracteres. | aviso o texto según el caso |
| Escribe un precio entre $0 y $1.000.000. | aviso o texto según el caso |
| Usa un enlace que empiece por https:// (máximo 500 caracteres). | aviso o texto según el caso |

## Admin · Resumen

| Texto | Contexto |
| --- | --- |
| Esta semana | aviso o texto según el caso |
| Este mes | aviso o texto según el caso |
| Sin datos | aviso o texto según el caso |
| Indicadores | lectores de pantalla (aria-label) |
| Ingresos | etiqueta de campo |
| Citas atendidas. Pendientes por cobrar: {…} | nota |
| Citas atendidas. Pendientes por cobrar: {…} | cifra |
| Citas | etiqueta de campo |
| Asistencia | etiqueta de campo |
| Aún no hay citas atendidas ni inasistencias. | aviso o texto según el caso |
| Clientes nuevos | etiqueta de campo |
| Se registraron en este periodo | nota |
| Resumen | h1 |
| Periodo | lectores de pantalla (aria-label) |
| Nueva cita | enlace |
| Elige las dos fechas para ver el resumen. | párrafo |
| Cargando el resumen… | texto |
| No pudimos cargar el resumen. | aviso con «Reintentar» |
| Ingresos por día | h2 |
| Pico: {…} | aviso o texto según el caso |
| Sin ingresos en el periodo | aviso o texto según el caso |
| Servicios más pedidos | h2 |
| Todavía no hay citas en este periodo. | párrafo |
| Ingresos: | texto |
| Barberos | h2 |
| Barbero | encabezado de columna |
| Citas | encabezado de columna |
| Ingresos | encabezado de columna |
| No asistió | encabezado de columna |
| Ingresos por día, {…} días, total {…}. El día con más ingresos fue el {…} {…}. | aviso o texto según el caso |
| Ingresos por día, {…} días: sin ingresos en este periodo. | aviso o texto según el caso |
| Ingresos y citas por día | título de tabla (solo lectores de pantalla) |
| Día | encabezado de columna |
| Elige la fecha inicial y la final. | aviso o texto según el caso |
| La fecha final no puede ser anterior a la inicial. | aviso o texto según el caso |
| El rango máximo es de {…} días. | aviso o texto según el caso |
| Semana del {…} | aviso o texto según el caso |
| Del {…} | aviso o texto según el caso |

## Admin · Servicios

| Texto | Contexto |
| --- | --- |
| Administrar servicios | aviso o texto según el caso |
| Agregar servicio | botón |
| Servicios | lectores de pantalla (aria-label) |
| Cargando servicios… | texto |
| No pudimos cargar los servicios. | aviso con «Reintentar» |
| Aún no tienes servicios. Agrega el primero con «Agregar servicio». | párrafo |
| Servicios del negocio, en el orden en que se muestran | título de tabla (solo lectores de pantalla) |
| Servicio | encabezado de columna |
| Duración | encabezado de columna |
| Precio | encabezado de columna |
| Estado | encabezado de columna |
| Acciones | encabezado de columna |
| Oculto para los clientes | texto |
| Nota: con vaporizador | texto |
| min | celda |
| Visible para los clientes: {…} | etiqueta de campo |
| Visible para los clientes: {…} | interruptor (nombre) |
| Subir {…} | lectores de pantalla (aria-label) |
| Subir {…} | botón |
| Bajar {…} | lectores de pantalla (aria-label) |
| Bajar {…} | botón |
| Editar {…} | lectores de pantalla (aria-label) |
| Editar {…} | botón |
| ¿Ocultar este servicio? | título de ventana |
| » dejará de aparecer al agendar. Las citas que ya existen no cambian y puedes volver a mostrarlo cuando quieras. | párrafo |
| Mantenerlo visible | botón |
| Ocultar servicio | botón |
| Editar servicio | aviso o texto según el caso |
| Agregar servicio | aviso o texto según el caso |
| Nombre | etiqueta de campo |
| Duración (min) | etiqueta de campo |
| Precio | etiqueta de campo |
| Descripción para el cliente | etiqueta de campo |
| Opcional, máximo 200 caracteres. | ayuda bajo el campo |
| Usa la máquina vaporizadora | texto |
| Solo un cliente a la vez, aunque haya más barberos libres. | texto |
| Visible para los clientes | texto |
| Aparece al agendar. | aviso o texto según el caso |
| Oculto: no aparece al agendar. | aviso o texto según el caso |
| Visible para los clientes | etiqueta de campo |
| Cambiar el precio o la duración solo afecta las citas nuevas; las citas que ya existen conservan los suyos. | párrafo |
| Cambios guardados. | aviso |
| Desactivar | botón |
| Guardar cambios | aviso o texto según el caso |
| Crear servicio | aviso o texto según el caso |
| Cancelar | botón |
| Eliminar servicio | botón |
| ¿Eliminar este servicio? | título de ventana |
| » se borrará para siempre. Si ya tiene citas, no se podrá eliminar y te sugeriremos desactivarlo. | párrafo |
| Conservar servicio | botón |
| Sí, eliminar | botón |
| El nombre debe tener entre 2 y 60 letras. | aviso o texto según el caso |
| La descripción puede tener máximo 200 caracteres. | aviso o texto según el caso |
| Escribe un precio entre $0 y $1.000.000. | aviso o texto según el caso |
| La duración debe ser múltiplo de 5, entre 5 y 240 minutos. | aviso o texto según el caso |

## Agendar (/)

| Texto | Contexto |
| --- | --- |
| Agendar cita | aviso o texto según el caso |
| No pudimos agendar tu cita. {…} | aviso o texto según el caso |
| Imperio Barber | texto |
| Productos | enlace |
| Agenda tu cita | h1 |
| Sin registro y sin descargas. Elige tu servicio, tu hora y listo. | párrafo |
| Servicio | título de ventana |
| Cargando servicios… | texto |
| No pudimos cargar los servicios. {…} | aviso o texto según el caso |
| Servicios | lectores de pantalla (aria-label) |
| Incluye vaporizador | aviso o texto según el caso |
| Barbero | h3 |
| No pudimos cargar los barberos. {…} | aviso con «Reintentar» |
| Día y hora | título de ventana |
| Tu servicio dura aprox. {…}; apartamos el bloque completo. | aviso o texto según el caso |
| Tus datos | título de ventana |
| Nombre | etiqueta de campo |
| ¿Cómo te llamas? | texto de ayuda en el campo |
| Celular (WhatsApp) | etiqueta de campo |
| Acepto el tratamiento de mis datos personales. | casilla |
| Leer la política | enlace |
| (se abre en otra pestaña) | texto |
| Sitio web | etiqueta de campo |
| Elige un servicio | aviso o texto según el caso |
| Confirmar cita | aviso o texto según el caso |
| Ese horario se acaba de ocupar. Elige otro. | aviso o texto según el caso |
| Horarios cercanos disponibles | lectores de pantalla (aria-label) |
| Elige un servicio para ver los horarios disponibles. | aviso o texto según el caso |
| Días disponibles | lectores de pantalla (aria-label) |
| No pudimos cargar los horarios. {…} | aviso o texto según el caso |
| No hay horarios en los próximos 7 días con esta selección. Prueba con otro barbero. | aviso |
| Cargando horarios… | texto |
| Horarios disponibles | lectores de pantalla (aria-label) |
| Escribe tu nombre (entre 2 y 60 caracteres). | aviso o texto según el caso |
| Escribe un celular colombiano de 10 dígitos. | aviso o texto según el caso |

## Barbero

| Texto | Contexto |
| --- | --- |
| Sin actualizar | aviso o texto según el caso |
| Actualizado ahora | aviso o texto según el caso |
| Actualizado hace {…} s | aviso o texto según el caso |
| Actualizado hace {…} min | aviso o texto según el caso |
| Actualizado hace {…} h | aviso o texto según el caso |

## Barbero · barra

| Texto | Contexto |
| --- | --- |
| Nueva cita | aviso o texto según el caso |
| Mi horario | aviso o texto según el caso |
| Cerrar sesión | botón |
| Principal | lectores de pantalla (aria-label) |

## Barbero · Mi agenda

| Texto | Contexto |
| --- | --- |
| Mi agenda | aviso o texto según el caso |
| No pudimos guardar el cambio. {…} | aviso o texto según el caso |
| Hola, | párrafo |
| Mi agenda | h1 |
| Día de la agenda | lectores de pantalla (aria-label) |
| Día anterior | lectores de pantalla (aria-label) |
| Ir a hoy | aviso o texto según el caso |
| Día siguiente | lectores de pantalla (aria-label) |
| Resumen del día | lectores de pantalla (aria-label) |
| Atendidas | etiqueta de campo |
| Pendientes | etiqueta de campo |
| Ingresos | etiqueta de campo |
| en el día | párrafo |
| Actualizar | botón |
| No pudimos actualizar la agenda. Estás viendo los datos de | aviso |
| Actualizado | aviso o texto según el caso |
| Agenda de hoy | aviso o texto según el caso |
| Agenda del día | aviso o texto según el caso |
| Cita | botón |
| Cargando la agenda… | texto |
| No pudimos cargar la agenda. {…} | aviso o texto según el caso |
| No tienes citas para este día. | aviso |
| Registrar un turno sin cita | botón |
| Siguiente | párrafo |
| Cita del aviso | párrafo |
| Atendida | botón |
| No asistió | botón |
| Cancelar | botón |
| Recordatorio enviado {…}. Reenviar por WhatsApp a {…} (se abre en otra pestaña) | aviso o texto según el caso |
| Recordar por WhatsApp a {…} (se abre en otra pestaña) | aviso o texto según el caso |
| Recordatorio enviado {…} | aviso o texto según el caso |
| Recordar por WhatsApp | aviso o texto según el caso |
| WhatsApp a {…} (se abre en otra pestaña) | lectores de pantalla (aria-label) |
| WhatsApp a {…} (se abre en otra pestaña) | botón |
| WhatsApp | botón |
| ¿Cancelar esta cita? | título de ventana |
| . El hueco queda libre para otros clientes. | párrafo |
| Mantener cita | botón |
| Sí, cancelar cita | botón |

## Barbero · Mi horario

| Texto | Contexto |
| --- | --- |
| No se cancelaron: siguen agendadas hasta que tú las muevas o canceles. | aviso |
| Ver la cita de {…}, {…} {…} | lectores de pantalla (aria-label) |
| Ver la cita de {…}, {…} {…} | enlace |
| Ver cita | enlace |
| No pudimos {…}. {…} | aviso o texto según el caso |
| Mi horario | aviso o texto según el caso |
| Cuándo te pueden agendar | párrafo |
| Mi horario | h1 |
| Estas citas quedaron fuera de tu horario. | título de ventana |
| Días de trabajo | h2 |
| Cargando tu horario… | texto |
| Día libre | texto |
| Trabajo el {…} | etiqueta de campo |
| Trabajo el {…} | interruptor (nombre) |
| {…}, tramo {…}, desde | etiqueta de campo |
| {…}, tramo {…}, hasta | etiqueta de campo |
| Quitar tramo {…} del {…} | botón |
| Dejar almuerzo libre, {…} | botón |
| Copiar el {…} a otros días | botón |
| Horario guardado. | aviso |
| Guardar horario | botón |
| Copiar el {…} | aviso o texto según el caso |
| Elige los días que tendrán el mismo horario. Se reemplaza el que tengan ahora. | párrafo |
| Copiar horario | botón |
| Cancelar | botón |
| Elige cuándo empieza. | aviso o texto según el caso |
| Ausencias | h2 |
| Estas citas caen dentro de tu ausencia. | título de ventana |
| No tienes ausencias programadas. | párrafo |
| Quitar ausencia: {…} | lectores de pantalla (aria-label) |
| Quitar ausencia: {…} | botón |
| Quitar | botón |
| Desde | etiqueta de campo |
| Hasta | etiqueta de campo |
| Motivo (opcional) | etiqueta de campo |
| Almuerzo, trámite, vacaciones… | texto de ayuda en el campo |
| Guardar ausencia | botón |
| Bloquear horas o días | botón |
| Las horas bloqueadas no aparecen como disponibles cuando un cliente agenda. | aviso |

## Barbero · Nueva cita

| Texto | Contexto |
| --- | --- |
| Escribe el nombre del cliente (entre 2 y 60 caracteres). | aviso o texto según el caso |
| Nueva cita | aviso o texto según el caso |
| Hoy · {…} | aviso o texto según el caso |
| Elige el servicio. | aviso o texto según el caso |
| Todavía no tenemos tu hora de inicio. Espera un momento o reintenta. | aviso o texto según el caso |
| Elige el día y la hora. | aviso o texto según el caso |
| No pudimos guardar la cita. {…} | aviso o texto según el caso |
| Para un cliente que llega o llama | párrafo |
| Nueva cita | h1 |
| Turno sin cita | párrafo |
| El cliente ya está aquí: se agenda en el primer hueco libre. | párrafo |
| Turno sin cita | etiqueta de campo |
| Servicio | lectores de pantalla (aria-label) |
| Servicio | título de sección |
| Cargando servicios… | texto |
| No pudimos cargar los servicios. {…} | aviso o texto según el caso |
| Hora de inicio | lectores de pantalla (aria-label) |
| Hora de inicio | título de sección |
| Elige un servicio para ver a qué hora empiezas. | párrafo |
| Calculando tu primer hueco libre… | texto |
| Empiezas a las | párrafo |
| No pudimos calcular la hora. {…} | aviso o texto según el caso |
| Día y hora | lectores de pantalla (aria-label) |
| Día y hora | título de sección |
| Duración: {…} | aviso o texto según el caso |
| Cliente | lectores de pantalla (aria-label) |
| Cliente | título de sección |
| Nombre | etiqueta de campo |
| ¿Cómo se llama? | texto de ayuda en el campo |
| Celular (WhatsApp, opcional) | etiqueta de campo |
| Con celular podrás recordarle su cita por WhatsApp. | ayuda bajo el campo |
| Resumen del turno | aviso o texto según el caso |
| Guardar cita | botón |

## Cambiar clave (/cambiar-clave)

| Texto | Contexto |
| --- | --- |
| Cambiar clave | aviso o texto según el caso |
| Cargando… | párrafo |
| Escribe tu clave temporal. | aviso o texto según el caso |
| La clave nueva debe tener al menos {…} caracteres. | aviso o texto según el caso |
| Las dos claves nuevas no coinciden. | aviso o texto según el caso |
| No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo. | aviso o texto según el caso |
| Crea tu clave | h1 |
| Entraste con una clave temporal. Elige una propia para continuar. | párrafo |
| Clave temporal | etiqueta de campo |
| Clave nueva | etiqueta de campo |
| Mínimo {…} caracteres. | ayuda bajo el campo |
| Mínimo {…} caracteres. | campo |
| Repite la clave nueva | etiqueta de campo |
| Guardar clave | botón |

## Carga de áreas

| Texto | Contexto |
| --- | --- |
| Cargando… | párrafo |

## Citas por revisar (barbero y admin)

| Texto | Contexto |
| --- | --- |
| Citas por revisar | h2 |
| Terminaron hace más de 2 horas y siguen pendientes. Márcalas para que las cifras queden al día. | párrafo |
| Atendida: {…}, {…} {…} | lectores de pantalla (aria-label) |
| Atendida: {…}, {…} {…} | botón |
| Atendida | botón |
| No asistió: {…}, {…} {…} | lectores de pantalla (aria-label) |
| No asistió: {…}, {…} {…} | botón |
| No asistió | botón |
| La cita | aviso o texto según el caso |
| Cita de {…} marcada como {…}. | aviso o texto según el caso |
| No pudimos guardar el cambio. {…} | aviso o texto según el caso |

## Componentes compartidos

| Texto | Contexto |
| --- | --- |
| Resumen de tu cita | lectores de pantalla (aria-label) |
| Fecha | texto |
| Hora | texto |
| Total (se paga en el local) | texto |
| Logo de Barbería Imperio | aviso o texto según el caso |
| Foto del producto | texto |
| No asistió | aviso o texto según el caso |
| Elige una hora | aviso o texto según el caso |
| Fecha y hora | aviso o texto según el caso |

## Error al cargar un área

| Texto | Contexto |
| --- | --- |
| No pudimos cargar esta pantalla. Inténtalo de nuevo. | aviso |
| Reintentar | botón |

## Error inesperado (pantalla global)

| Texto | Contexto |
| --- | --- |
| Algo salió mal | aviso o texto según el caso |
| Algo salió mal | h1 |
| No es tu culpa: la pantalla tuvo un problema inesperado. Puedes intentarlo de nuevo o volver al inicio. | párrafo |
| Reintentar | botón |
| Volver al inicio | botón |

## Ingresar (/ingresar)

| Texto | Contexto |
| --- | --- |
| No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo. | aviso o texto según el caso |
| Escribe tu correo. | aviso o texto según el caso |
| Escribe tu contraseña. | aviso o texto según el caso |
| Ingresar | h1 |
| Acceso para barberos y administración. | párrafo |
| Correo | etiqueta de campo |
| Contraseña | etiqueta de campo |
| Ingresar | botón |

## Página no encontrada (404)

| Texto | Contexto |
| --- | --- |
| Página no encontrada | aviso o texto según el caso |
| No encontramos esa página | h1 |
| Revisa el enlace o vuelve al inicio. | párrafo |
| Volver al inicio | botón |

## Política de privacidad

| Texto | Contexto |
| --- | --- |
| Política de privacidad | aviso o texto según el caso |
| PENDIENTE DE REVISIÓN LEGAL | párrafo |
| Política de tratamiento de datos | h1 |
| Texto provisional, en revisión. Aplica la Ley 1581 de 2012 de Colombia (protección de datos personales). | párrafo |
| Quién es el responsable | título de ventana |
| Imperio Barber es el responsable del tratamiento de tus datos. Los datos de contacto del responsable (razón social, NIT, dirección y correo) se publicarán aquí cuando termine la revisión. | párrafo |
| Qué datos guardamos | título de ventana |
| Tu nombre. | lista |
| Tu número de celular. | lista |
| Tu historial de citas: servicio, barbero, fecha, hora y estado. | lista |
| No te pedimos cuenta, contraseña, documento de identidad ni datos de pago. | párrafo |
| Para qué los usamos | título de ventana |
| Usamos tus datos para gestionar tus citas (agendar, reprogramar o cancelar) y para recordártelas. No los vendemos ni los usamos para publicidad de terceros. | párrafo |
| Tus derechos | título de ventana |
| Como titular puedes conocer, actualizar y corregir tus datos, pedir que los eliminemos, revocar tu autorización y consultar cómo los usamos. Para ejercer cualquiera de estos derechos, escríbele al local por WhatsApp o pídelo en persona; responderemos dentro de los plazos que fija la ley. | párrafo |
| Cuánto tiempo los conservamos | título de ventana |
| Mientras uses el servicio o hasta que pidas su eliminación. Este plazo se confirmará en la revisión legal. | párrafo |
| Volver a agendar | enlace |

## Productos (/productos)

| Texto | Contexto |
| --- | --- |
| Volver a agendar | lectores de pantalla (aria-label) |
| Productos del local | h1 |
| Disponibles para llevar en la barbería. | párrafo |
| Cargando productos… | texto |
| No pudimos cargar los productos. {…} | aviso o texto según el caso |
| Por ahora no hay productos para mostrar. | aviso |
| Productos | lectores de pantalla (aria-label) |
| Se compran directamente en el local. | párrafo |
| Agendar cita | botón |

## Sin conexión (/offline)

| Texto | Contexto |
| --- | --- |
| Sin conexión | aviso o texto según el caso |
| Sin conexión | h1 |
| Parece que no tienes internet. Revisa tu conexión y vuelve a intentarlo. | párrafo |
| Reintentar | botón |
| Volver al inicio | botón |

## Todas (enlace «Saltar al contenido»)

| Texto | Contexto |
| --- | --- |
| Saltar al contenido | enlace |

## Tu cita (/cita/…)

| Texto | Contexto |
| --- | --- |
| No encontramos tu cita | h1 |
| El enlace no es válido o la cita ya no existe. Revisa que lo hayas copiado completo. | párrafo |
| Agendar una cita | botón |
| Tu cita | aviso o texto según el caso |
| Cargando tu cita… | texto |
| No pudimos cargar tu cita. {…} | aviso o texto según el caso |
| No pudimos cancelar tu cita. {…} | aviso o texto según el caso |
| Acciones de tu cita | lectores de pantalla (aria-label) |
| Agregar al calendario | botón |
| Reprogramar | botón |
| Cancelar cita | botón |
| Para cambios de último momento, escríbele al local: desde aquí ya no se puede reprogramar ni cancelar. | aviso |
| Listo: cambiamos tu cita al nuevo horario. | aviso o texto según el caso |
| Llega a tu hora: esperamos hasta | texto |
| minutos después. | texto |
| Agendar otra cita | botón |
| Productos del local | texto |
| Mira qué puedes llevarte después de tu corte. | texto |
| ¿Cancelar tu cita? | título de ventana |
| Si cancelas, ese horario queda libre para otros clientes. | párrafo |
| Fecha y hora | dato (etiqueta) |
| Servicio | dato (etiqueta) |
| Barbero | dato (etiqueta) |
| Sí, cancelar cita | botón |
| Mantener mi cita | botón |
| Prefiero reprogramar | botón |
| No pudimos reprogramar tu cita. {…} | aviso o texto según el caso |
| Elige un nuevo horario | h2 |
| Mismo servicio ({…}) y mismo barbero ({…}). | nota |
| Mismo servicio ({…}) y mismo barbero ({…}). | horarios |
| Confirmar nuevo horario | aviso o texto según el caso |
| Mantener mi horario actual | botón |
| Cita en Imperio Barber | aviso o texto según el caso |

## Varias pantallas

| Texto | Contexto |
| --- | --- |
| Reintentar | botón |
| Revisa tu conexión e inténtalo de nuevo. | aviso o texto según el caso |
| No pudimos completar la solicitud. Inténtalo de nuevo. | aviso o texto según el caso |
| Imperio Barber | aviso o texto según el caso |
| Hola {…}, te escribo de Imperio Barber por tu cita {…}. | aviso o texto según el caso |
| Hola{…}, te recordamos tu cita en Imperio Barber: | aviso o texto según el caso |
| Te esperamos; tenemos {…} minutos de tolerancia. | aviso o texto según el caso |
| Si no puedes venir, respóndenos por aquí. | aviso o texto según el caso |

## Mensajes del servidor

Errores de la API que la app muestra tal cual a la persona (código estable + mensaje en español).

| Código | Mensaje |
| --- | --- |
| `(según el caso)` | Para {…} con menos de {…} de anticipación, escríbele al local. |
| `appointment_not_active` | Esta cita ya no está activa. |
| `appointment_not_found` | No encontramos esta cita. |
| `bad_request` | La solicitud no es válida. |
| `barber_inactive` | Ese barbero está inactivo y no recibe citas. |
| `barber_not_found` | No encontramos a ese barbero. |
| `business_not_found` | No encontramos este negocio. |
| `consent_required` | Necesitamos tu autorización para guardar tus datos y poder agendar tu cita. |
| `date_out_of_range` | Elige una fecha entre hoy y los próximos {…} días. |
| `email_taken` | Ya existe una cuenta con ese correo. |
| `forbidden` | No tienes permiso para hacer esto. |
| `invalid_credentials` | Correo o contraseña incorrectos. |
| `invalid_current_password` | La clave actual no es correcta. |
| `invalid_cursor` | El cursor de paginación no es válido. |
| `invalid_name` | Escribe el nombre del cliente (2 a 60 caracteres). |
| `invalid_name` | Escribe tu nombre (entre 2 y 60 caracteres). |
| `invalid_note` | La nota admite hasta {…} caracteres. |
| `invalid_order` | La lista debe traer todos los productos del negocio, una sola vez cada uno. |
| `invalid_order` | La lista debe traer todos los servicios del negocio, una sola vez cada uno. |
| `invalid_range` | Envía las dos fechas (from y to) o ninguna. |
| `invalid_range` | La fecha final no puede ser anterior a la inicial. |
| `invalid_refresh_token` | Tu sesión venció. Inicia sesión de nuevo. |
| `invalid_resource` | El recurso elegido no existe en este negocio. |
| `invalid_source` | El origen no coincide: usa 'walk_in' solo con turno sin cita. |
| `invalid_start` | Elige el día y la hora de la cita. |
| `invalid_start` | Un turno sin cita empieza ya: no envíes la hora. |
| `invalid_time_off` | El fin de la ausencia debe ser después del inicio. |
| `invalid_time_off` | El motivo admite hasta {…} caracteres. |
| `invalid_time_off` | Esa ausencia ya pasó. |
| `invalid_time_off` | Una ausencia no puede durar más de un año. |
| `invalid_token` | Tu sesión no es válida. Inicia sesión de nuevo. |
| `invalid_transition` | Esta cita ya está {…}; no se puede cambiar así. |
| `no_barber_profile` | Tu usuario no tiene un perfil de barbero activo. |
| `not_authenticated` | Inicia sesión para continuar. |
| `not_found` | No encontramos a ese barbero. |
| `not_found` | No encontramos a ese cliente. |
| `not_found` | No encontramos ese producto. |
| `not_found` | No encontramos ese servicio. |
| `password_change_required` | Debes cambiar tu clave temporal antes de continuar. |
| `password_unchanged` | La clave nueva debe ser distinta de la actual. |
| `range_too_large` | El rango máximo es de {…} días. |
| `reminder_not_applicable` | Esta cita ya está {…}; no lleva recordatorio. |
| `service_not_found` | No encontramos ese servicio. |
| `slot_taken` | Ese horario ya lo ocupó otra cita, así que no se puede marcar como atendida. |
| `slot_unavailable` | Ese horario ya no está disponible. Elige otro de los que te mostramos. |
| `slot_unavailable` | Ese hueco se ocupó hace un momento. Mira a qué hora puedes empezar ahora. |
| `time_off_not_found` | No encontramos esa ausencia. |
| `token_expired` | Tu sesión venció. Inicia sesión de nuevo. |
| `too_early_for_attended` | Solo puedes marcarla como atendida desde {…} minutos antes. |
| `too_early_for_no_show` | Todavía estás dentro de los {…} minutos de espera. |
| `too_many_active` | Ya tienes {…} citas agendadas con este celular. Cancela una para poder agendar otra. |
