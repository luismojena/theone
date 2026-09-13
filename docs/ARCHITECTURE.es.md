# Guía de Arquitectura y Extensibilidad

Este documento describe la arquitectura de Diseño Guiado por el Dominio (DDD), los modelos de datos y los patrones de extensión para la **Utilidad de Migración y Sincronización de Listas de Anime**.

---

## 1. Filosofía de Diseño

El principio central de este proyecto es **la sincronización multi-plataforma desacoplada con MyAnimeList (MAL) como la única fuente de la verdad**, construida sobre una base estricta de TypeScript.

### Conceptos Arquitectónicos Clave:
- **MAL como Ancla Universal**: Los sitios externos (AnimeFLV, JKanime, AnimeAV1, etc.) tienen formatos de título, convenciones de nombres de temporadas e IDs internos que varían. En lugar de intentar $N \times N$ mapeos directos de sitio a sitio, **cada entrada de sitio se mapea a un ID canónico de MyAnimeList**.
- **Diseño Guiado por el Dominio (DDD)**: La lógica de negocio (Sincronización, Importación) está completamente aislada de la Infraestructura (peticiones HTTP, scraping de HTML) y de la Persistencia (almacenamiento de archivos JSON).
- **Patrón Estrategia (Strategy)**: Todas las plataformas implementan la clase abstracta `IAnimePlatform`, lo que hace que añadir nuevas plataformas sea trivial sin modificar la lógica de sincronización central.
- **Reconciliación Incremental**: Las acciones de sincronización operan sobre un modelo de diferencias delta (diff), actualizando solo las entradas cuyo progreso de episodios o estado haya cambiado desde la última sincronización.

---

## 2. Estructura de Directorios DDD

- **`src/core/`**: Define la columna vertebral estructural de la aplicación. Incluye `domain.ts` (Entidades/Interfaces como `WatchlistEntry` y `MappingEntry`), `IAnimePlatform.ts` (Definición abstracta de plataforma), y `typeGuards.ts` (Validadores de JSON/Errores en tiempo de ejecución tipo Zod).
- **`src/repositories/`**: Maneja la persistencia. `FileMappingRepository` abstrae la lectura y escritura a `migrations/mappings.json`.
- **`src/platforms/`**: La capa de infraestructura. Contiene implementaciones concretas de `IAnimePlatform` (ej. `AnimeAV1Platform`, `JKAnimePlatform`). 
- **`src/services/`**: La capa de lógica de negocio. 
  - `WatchlistSyncService`: Calcula las diferencias de estado entre la verdad local y una plataforma remota.
  - `PlatformImporterService`: Cruza automáticamente referencias de entradas no mapeadas con una plataforma remota para construir puentes de mapeo.
- **`src/cli/`**: La capa de controladores. Une repositorios, plataformas y servicios en respuesta a los comandos de la terminal.

---

## 3. Esquema de Base de Datos de Mapeo Persistente

Ubicación: `migrations/mappings.json`

Las entradas se identifican mediante la clave `${platform}:${platform_id}`.

### Definición del Esquema:
```json
{
  "animeav1:4382": {
    "platform": "animeav1",
    "platform_id": "4382",
    "title": "Aishiteru Game wo Owarasetai",
    "mal_id": 61839,
    "mal_title": "Aishiteru Game wo Owarasetai",
    "last_synced_episodes": 0,
    "last_synced_status": "Watching",
    "updated_at": "2026-07-19T11:00:00.000Z"
  }
}
```

---

## 4. Motor de Reconciliación Incremental

El motor de reconciliación es provisto por `src/services/WatchlistSyncService.ts` a través del helper `computeIncrementalDiff(incomingEntries)`.

### Flujo del Cálculo de Diff:
1. **`newEntries`**: Artículos presentes en la lista de la plataforma entrante pero aún no mapeados en `mappings.json`.
2. **`modifiedEntries`**: Artículos mapeados donde el actual `episodesWatched` o `status` difiere de `last_synced_episodes` o `last_synced_status`.
3. **`unchangedEntries`**: Artículos mapeados con idéntico progreso. Son omitidos durante las exportaciones/sincronizaciones para ahorrar tiempo y cuota de API.

---

## 5. Guía Paso a Paso: Añadir un Nuevo Sitio

Para integrar una nueva plataforma (ej. `CrunchyrollPlatform`):

### Paso 1: Crear la Clase de la Plataforma
Crea `src/platforms/CrunchyrollPlatform.ts`:
```typescript
import { IAnimePlatform } from "../core/IAnimePlatform.js";
import { WatchlistEntry, SearchResult } from "../core/domain.js";

export class CrunchyrollPlatform extends IAnimePlatform {
	get platformName(): string {
		return "crunchyroll";
	}

	async authenticate(credentials: Record<string, string>): Promise<void> {
		this.defaultHeaders.Authorization = `Bearer ${credentials.token}`;
	}

	async fetchWatchlist(): Promise<WatchlistEntry[]> {
		// Scrape/fetch watchlist
		return [];
	}

	async updateEntryStatus(entry: WatchlistEntry): Promise<void> {
		// POST API update
	}

	async searchAnime(query: string): Promise<SearchResult[]> {
		// Search the platform for MAL mapping
		return [];
	}
}
```

### Paso 2: Crear un Handler CLI
Crea `src/cli/crunchyrollCli.ts` para conectar la nueva plataforma utilizando los servicios existentes (`WatchlistSyncService`, `PlatformImporterService`).

### Paso 3: Registrar el Comando en `theone.ts`
En `theone.ts`, importa tu nuevo archivo CLI y añádelo a la estructura "switch" de enrutamiento.

---

## 6. Type Guards y Manejo de Errores

No hagas casts a ciegas de `any` o `unknown` con las respuestas de la API. Usa o extiende siempre `src/core/typeGuards.ts`.
- Usa `isMappingRecord(data)` antes de leer del disco.
- Usa `isError(err)` en bloques `catch` para extraer de forma segura `err.message` en lugar de lanzar `undefined`.
