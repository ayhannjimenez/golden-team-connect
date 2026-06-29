# Difusion Local Privada

Aplicacion web privada, moderna y mobile-first para administrar contactos y preparar mensajes individuales por WhatsApp o SMS. Funciona sin backend, sin Firebase, sin Supabase, sin APIs pagadas y sin claves.

## Que Hace

- Guarda contactos, listas internas, plantillas, campanas, cola e historial localmente en IndexedDB.
- Crea una cola individual por destinatario.
- Personaliza mensajes con `{{nombre}}`, `{{apellido}}`, `{{pais}}`, `{{categoria}}` y `{{lista}}`.
- Abre el chat privado del contacto en WhatsApp o Mensajes.
- Permite marcar cada envio como pendiente, abierto, enviado, omitido o fallido.
- Exporta/importa contactos CSV y copias de seguridad JSON.
- Guarda imagenes opcionales localmente y permite compartirlas o descargarlas cuando el navegador lo soporte.
- Funciona como PWA instalable y puede operar sin conexion despues de la primera carga.

## Que No Hace

- No envia mensajes automaticamente.
- No crea grupos de WhatsApp.
- No crea SMS con multiples destinatarios.
- No usa bots, Selenium, scraping ni automatizaciones de WhatsApp Web.
- No usa Twilio, Meta WhatsApp Cloud API, WhatsApp Business API ni servicios SMS pagados.
- No sincroniza datos entre dispositivos automaticamente.

Cada destinatario recibe un chat privado e individual. El numero personal configurado por defecto (`14075063846`) se guarda solo como dato del propietario y nunca se usa como destinatario.

## Instalar Dependencias

```bash
pnpm install
```

## Ejecutar En Desarrollo

```bash
pnpm dev
```

Abre la direccion local que muestra Vite. Para probar desde un iPhone en la misma red, usa la URL de red que aparece en la terminal.

## Generar Build

```bash
pnpm build
```

## Probar Build Local

```bash
pnpm preview
```

## Pruebas

```bash
pnpm test
```

Las pruebas cubren normalizacion de telefono, duplicados, listas, variables, campanas, cola, exclusiones, WhatsApp, SMS, CSV, backup, imagen, persistencia offline, service worker, PWA y vistas movil/escritorio.

## Uso Basico

1. Entra a Contactos y crea personas con nombre, telefono, pais, categoria, consentimiento y canal preferido.
2. En Listas crea listas internas como Golden Team, Clientes u Orlando.
3. En Plantillas guarda mensajes frecuentes con variables.
4. En Crear envio selecciona listas o contactos individuales, revisa excluidos y confirma.
5. En Cola abre WhatsApp o Mensajes para cada destinatario, envia manualmente y marca el resultado.
6. En Historial puedes continuar campanas incompletas, duplicar, reintentar fallidos, exportar resumen o eliminar.
7. En Copia exporta un JSON regularmente para evitar perdida de informacion.

## Importar CSV

Columnas sugeridas:

```csv
nombre,apellido,telefono,codigo_pais,pais,categoria,lista,notas,consentimiento,canal_preferido
Maria,Santos,3215551234,1,Estados Unidos,Cliente,Orlando,Seguimiento,si,WhatsApp
```

La app revisa numeros duplicados, filas incompletas y telefonos invalidos antes de guardar.

## Exportar CSV

Desde Contactos puedes exportar todos los contactos filtrados. Desde Listas puedes exportar una lista especifica.

## Imagenes

Puedes seleccionar una foto desde camara, galeria o archivos. La app muestra vista previa, comprime imagenes grandes, las guarda localmente y ofrece compartir o descargar. WhatsApp y SMS no permiten adjuntar archivos automaticamente de forma segura desde esta app, asi que el flujo recomendado es compartir o guardar la imagen, abrir el chat privado, revisar el texto y enviar manualmente.

## WhatsApp

El enlace usa:

```text
https://wa.me/NUMERO_DEL_CONTACTO?text=MENSAJE_CODIFICADO
```

El numero va sin `+`, espacios, guiones ni parentesis. El mensaje usa `encodeURIComponent`. Si WhatsApp no esta instalado, copia el mensaje y usa WhatsApp Web cuando sea posible.

## SMS

La app intenta abrir:

```text
sms:NUMERO&body=MENSAJE
sms:NUMERO?body=MENSAJE
```

El formato varia por iPhone, Android y computadora. Siempre queda disponible copiar el mensaje.

## Instalar En iPhone

1. Abre la app en Safari.
2. Toca Compartir.
3. Toca Agregar a pantalla de inicio.
4. Abre la app desde el icono.

En iOS, la preparacion de SMS con cuerpo puede variar por version. El modo offline requiere haber abierto la app una vez con conexion.

## Instalar En Mac O Windows

En Chrome o Edge, abre la app y usa el icono de instalar en la barra del navegador. La app se abre como ventana independiente cuando el navegador lo permite.

## Modo Offline

Despues de la primera visita, el service worker guarda los archivos de la app. Sin internet puedes ver y editar datos, crear listas, plantillas, campanas, colas, imagenes y backups. WhatsApp necesita conexion; SMS depende del servicio celular.

Para probar:

1. Abre la app con conexion.
2. Ejecuta `pnpm build && pnpm preview`.
3. Abre la app, espera que cargue.
4. Activa modo avion o corta internet.
5. Recarga y verifica contactos, listas, campanas y cola.

## Copias De Seguridad

Exporta JSON desde Copia. Para mover datos a otro dispositivo, envia ese archivo por un metodo seguro y restauralo alli. Puedes combinar sin duplicar numeros o reemplazar todos los datos con confirmacion.

## Actualizaciones

La PWA usa actualizacion segura. IndexedDB no se borra durante builds nuevos. Si hay una nueva version, cierra y abre la app instalada.

## Publicar Gratis En GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube estos archivos.
3. Ejecuta:

```bash
pnpm build
pnpm deploy
```

Tambien puedes usar GitHub Actions con el workflow incluido. La configuracion de Vite detecta el nombre del repositorio para ajustar el `base path`. Si necesitas evitar problemas de rutas en GitHub Pages, esta app usa navegacion interna por estado y no depende de rutas profundas.

## Limitaciones

- Si borras datos del navegador, puedes perder informacion local.
- No hay sincronizacion automatica entre telefono y computadora.
- WhatsApp, iOS, Android y apps de escritorio pueden cambiar como manejan enlaces externos.
- Ningun navegador permite enviar WhatsApp o SMS automaticamente de forma segura sin APIs externas o automatizaciones prohibidas.
