# Avisos y créditos de terceros

La licencia MIT de `LICENSE` se aplica al código y a las modificaciones originales de este proyecto. No reemplaza los avisos de otros autores ni concede derechos sobre marcas, carátulas o contenido de terceros.

## Proyectos de referencia

- **FreeMyTvWebOS**, de Daniel: https://github.com/danielthejoker18/FreeMyTvWebOS . Base de empaquetado y de los componentes conservados. Se mantiene íntegro su aviso MIT de 2026 en `LICENSE.upstream`.
- **Free My TV**, de simbasjungles: https://github.com/simbasjungles/free-my-tv . Referencia de diseño e interacción del editor del estante. Su árbol de fuentes, paquetes y configuración privada no se distribuyen aquí.

## SDK de LG

`upstream/app/webOSTV.js` es webOSTV.js 1.2.13, sin modificar. Se verificó su coincidencia byte por byte con el ZIP oficial de LG, que incluye licencia **Apache 2.0**. Se conserva ese texto en `upstream/app/LICENSE-webOSTV-Apache-2.0.txt`. Procedencia y hash en `upstream/README.md`.

No es código original de Inicio LG y no se relicencia como MIT.

## Recursos gráficos

- Los assets originales del launcher conservados de FreeMyTvWebOS se mantienen junto con su aviso MIT.
- Los SVG de Simple Icons conservados en `upstream/app/assets/brands/` mantienen sus fuentes y texto CC0 en `SOURCES.md` y `SIMPLE-ICONS-LICENSE.md`.
- Las marcas representadas pertenecen a sus titulares. Sus nombres e iconos se utilizan para identificar aplicaciones; no implican afiliación ni patrocinio.
- **No se redistribuyen los iconos extraídos de paquetes de apps comerciales o de terceros instalados en una TV.** La herramienta de importación opcional guarda esos recursos localmente y quedan excluidos de Git. Cada usuario debe respetar sus condiciones originales.
- Las capturas de `docs/images/` ilustran la interfaz real. Pueden mostrar logotipos, títulos y carátulas de terceros, cuyos derechos no se transfieren ni se relicencian bajo MIT. No constituyen un paquete de recursos gráficos para su reutilización independiente.

## Servicios de datos

- Recomendaciones, imágenes y sinopsis: **TMDB**, https://www.themoviedb.org/ . Este producto utiliza la API de TMDB, pero no está avalado ni certificado por TMDB.
- Disponibilidad por plataforma: datos de proveedores de **JustWatch** servidos a través de TMDB. No se comprueban las suscripciones del usuario.
- Meteorología: **Open-Meteo**, https://open-meteo.com/ .

Los datos de esos servicios están sujetos a sus condiciones originales y no forman parte de la licencia del código. No se distribuyen credenciales compartidas ni un catálogo descargado de carátulas.

Inicio LG es un proyecto no oficial, sin afiliación con LG ni con las plataformas mostradas.
