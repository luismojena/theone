# The One 💍

*Tres sitios para los Piratas bajo el cielo,*
*Siete para los Otakus en sus palacios de piedra,*
*Nueve para los Hombres Mortales condenados a morir,*
*Uno para el Señor Oscuro sobre su trono oscuro,*
*En la Tierra de Node.js donde yacen los Animes.*

**Un Script para gobernarlos a todos, Un Script para encontrarlos,**
**Un Script para atraerlos a todos y atarlos en las tinieblas.**

Bienvenido a **The One** (`theone.ts`), la utilidad de línea de comandos (CLI) escrita en TypeScript, estrictamente tipada, ridículamente sobre-diseñada (Arquitectura DDD) y forjada en los fuegos del Monte del Destino (mi editor de código) para sincronizar sin problemas tus listas de anime entre **AnimeFLV**, **MyAnimeList (MAL)**, **JKAnime**, y **AnimeAV1**.

---

## 🌟 La Comunidad de las Características

1. **Soporte Multi-Plataforma**: Arquitectura de estrategia conectable que soporta AnimeFLV, MyAnimeList, JKanime, y AnimeAV1. Trae tus plataformas, el script las atará.
2. **Motor de Mapeo Canónico**: Resuelve y mapea de forma permanente los caóticos slugs de las diferentes plataformas a un único y canónico ID de MyAnimeList (MAL). El Único ID Verdadero.
3. **Sincronización Diferencial Inteligente**: Calcula las diferencias de estado (episodios vistos, estado de seguimiento) y sincroniza *solo* donde difieren. Ahorramos peticiones a la API como Elrond guarda rencores.
4. **Type Guards Autosanadores**: Aprovecha los estrictos "type guards" de TypeScript para parsear de forma segura conjuntos de datos JSON persistentes y recuperarse con gracia de los errores en tiempo de ejecución. Los Balrogs no pasarán los tipos `unknown`.
5. **Importador Masivo de AnimeAV1**: Realiza ingeniería inversa a los payloads de SvelteKit de AnimeAV1 para mapear automáticamente cientos de títulos de forma autónoma. Es prácticamente magia.

---

## 🛠️ Forjando el Script (Instalación)

1. **Requisitos**: Node.js v18+ es obligatorio.
2. **Instalar las dependencias**:
   ```bash
   npm install
   ```
3. **Las Runas Secretas (`.env`)**:
   Crea un archivo `.env` en el directorio raíz (revisa la plantilla `.env.example`). Mantenlo en secreto, mantenlo a salvo:
   ```env
   MAL_USER=tu_usuario_de_mal
   JKANIME_USER=tu_usuario_de_jkanime
   JKANIME_PASS=tu_contrasena_de_jkanime
   ANIMEAV1_SESSION=tu_cookie_de_sesion_de_animeav1
   ```

*Todos los resultados generados, copias de seguridad y estados de configuración se atesoran a salvo en el directorio `migrations/` como el tesoro de un dragón.*

---

## 🧙‍♂️ Blandiendo The One (Uso del CLI)

La herramienta utiliza `theone.ts` como el enrutador central de comandos. Puedes lanzar tus hechizos usando `npx tsx theone.ts <comando>` o compilarlo y ejecutar `node dist/theone.js <comando>`.

### ⚔️ Comandos de AnimeAV1

#### Obtener Lista de AnimeAV1
Invoca y muestra tu lista de seguimiento en vivo de AnimeAV1 utilizando la cookie de sesión.
```bash
npx tsx theone.ts animeav1 fetch
```

#### Sincronizar Lista a AnimeAV1
Empuja tu base de datos local hacia AnimeAV1. Actualiza las entradas donde el contador de episodios o el estado local está más avanzado que el del servidor remoto.
```bash
npx tsx theone.ts animeav1 sync
```

#### Importación / Resolución Automática
Recorre todos los IDs de MAL rastreados localmente, consulta AnimeAV1 en busca de coincidencias exactas, y auto-resuelve los IDs de mapeo sin esfuerzo.
```bash
npx tsx theone.ts animeav1 import
```

### 🗡️ Comandos de AnimeFLV

#### Obtener (Scrape) AnimeFLV
Saquea tu lista de seguimiento de AnimeFLV y la guarda en el almacenamiento local.
```bash
npx tsx theone.ts scrape
```

#### Resolver IDs de MAL
Mapea todos los títulos de AnimeFLV previamente obtenidos a sus IDs canónicos de MAL.
```bash
npx tsx theone.ts resolve
```

### 🥷 Comandos de JKanime

#### Obtener Estados de JKanime
Obtiene sigilosamente tus estados actuales de JKanime y los almacena en caché.
```bash
npx tsx theone.ts fetch-jkanime-list
```

#### Sincronizar Lista a JKanime
Empuja los estados de tu lista local hacia tu cuenta de JKanime en vivo. Usa `--autoskip` para permitir que el script se ejecute sin intervención manual.
```bash
npx tsx theone.ts sync-jkanime --force --autoskip
```

### 📖 Comandos de MyAnimeList (MAL)

#### Exportar XML de MAL
Forja un archivo XML importable basado en tus bases de datos mapeadas para subirlo directamente a MAL.
```bash
npx tsx theone.ts export
```

#### Completar Series en Emisión
Consulta la API de Jikan para marcar automáticamente como "Completado" en MAL cualquier serie "En Seguimiento" (Watching) que haya finalizado su emisión.
```bash
npx tsx theone.ts complete-watching
```

### 🧙‍♂️ Comandos de Utilidad

#### Revisión Interactiva de Coincidencias
Asistente interactivo de CLI para asignar manualmente IDs de MAL en caso de coincidencias ambiguas (para cuando la IA actúa como un insensato Tuk).
```bash
npx tsx theone.ts review
```

---

## 🏗️ La Arquitectura de Gondor

```text
├── docs/                     # Textos antiguos y Guía de Extensibilidad
│   └── ARCHITECTURE.md       # Lee esto antes de hacer un PR
├── migrations/               # La Bóveda: Bases de datos generadas y exportaciones
│   ├── mappings.json         # Base de datos permanente de mapeo a MAL
│   └── import.xml            # Importación generada de XML para MAL
├── src/                      # La Forja: Código fuente modular y fuertemente tipado
│   ├── cli/                  # Capa de interacción CLI (La Boca de Sauron)
│   ├── core/                 # Clases abstractas, decoradores, entidades de dominio
│   ├── platforms/            # Adaptadores concretos (Patrón Strategy)
│   ├── repositories/         # Capa de persistencia de datos
│   ├── services/             # Lógica de negocio core (Motores de Diff, Auto-Importadores)
│   └── utils.ts              # Hechizos auxiliares globales
├── tests/                    # Los Campos de Prueba
└── theone.ts                 # Enrutador principal CLI (El Único Script)
```

---

## 🛡️ Entrenando a las Tropas

Las pruebas unitarias están escritas usando el test runner nativo de Node.js. Prueba tu código, no vaya a ser que introduzcas bugs en el reino.
```bash
npm test
```

### Hechizos de Desarrollo
- `npm run build`: Compila el estricto proyecto de TypeScript en `dist/`.
- `npm run lint`: Ejecuta el linter Biome a lo largo de todo el repositorio.
- `npm run format`: Auto-formatea el código base con Biome.
