# Procedencia de los componentes conservados

## FreeMyTvWebOS

- Proyecto: https://github.com/danielthejoker18/FreeMyTvWebOS
- Base local utilizada: 1.2.4.
- Empaquetador adaptado: `../scripts/build.py`.
- Appinfo y assets del launcher conservados en `app/`.
- Licencia original MIT: `../LICENSE.upstream`.

## webOSTV.js 1.2.13

- Documentación oficial: https://webostv.developer.lge.com/develop/references/webostvjs-introduction
- Distribución oficial: https://webostv.developer.lge.com/assets/library/webOSTVjs-1.2.13.zip
- Archivo: `app/webOSTV.js`, sin modificar.
- SHA-256: `2e83e028aef8651ef0b79b25a70c7ebc076a36781486a68623634bc0c2162670`.
- Se comprobó que coincide byte por byte con el archivo del ZIP oficial.
- El ZIP oficial incluye `LICENSE-2.0.txt` (Apache 2.0), conservado íntegramente como `app/LICENSE-webOSTV-Apache-2.0.txt`.

## Iconos de marcas

Los SVG de Simple Icons conservados en `app/assets/brands/` mantienen su aviso CC0. Los logotipos tipográficos de Disney+ y Globoplay proceden de Wikimedia Commons y están identificados como PD-textlogo en `SOURCES.md`; no se declaran CC0. Las fuentes y condiciones se conservan en ese directorio. Las marcas pertenecen a sus titulares: ni CC0 ni PD-textlogo conceden derechos de marca o implican patrocinio.

No se distribuyen aquí los iconos extraídos de aplicaciones instaladas en un televisor. La herramienta opcional `scripts/import_icons.py` permite obtenerlos de un dispositivo propio y los guarda en archivos ignorados por Git.
