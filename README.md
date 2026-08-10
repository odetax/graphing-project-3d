# 🌐 Graphing Project (Vectors & GPS 3D)

> [!TIP]
> Este proyecto se encuentra actualmente desplegado en: https://odetax.github.io/graphing-project-3d/

Este programa es un graficador 3D interactivo desarrollado con **TypeScript, Vite y Three.js**. El sistema permite visualizar vectores cinemáticos (proyectiles) y coordenadas geográficas reales sobre un globo terráqueo.

- **Modo Vectores:** el usuario ingresa velocidad inicial y ángulos de un proyectil, y la app calcula y grafica en 3D la trayectoria balística (vector inicial + curva completa).
- **Modo GPS:** el usuario ingresa latitud y longitud, la app consulta la altitud real (Open-Elevation), transforma esa coordenada a un sistema 3D esférico y ubica un marcador sobre un globo terráqueo.

---
## Tabla de contenido

- [🌐 Graphing Project (Vectors \& GPS 3D)](#-graphing-project-vectors--gps-3d)
  - [Tabla de contenido](#tabla-de-contenido)
  - [👥 Equipos y Responsabilidades](#-equipos-y-responsabilidades)
    - [Equipo 1: Interfaz Principal y Entorno 3D (Core)](#equipo-1-interfaz-principal-y-entorno-3d-core)
    - [Equipo 2: Lógica y Matemáticas de Vectores](#equipo-2-lógica-y-matemáticas-de-vectores)
    - [Equipo 3: Gráficos 3D de Vectores](#equipo-3-gráficos-3d-de-vectores)
    - [Equipo 4: Lógica GPS y Conexión a Internet](#equipo-4-lógica-gps-y-conexión-a-internet)
    - [Equipo 5: Gráficos 3D de GPS](#equipo-5-gráficos-3d-de-gps)
  - [📂 Estructura de Carpetas](#-estructura-de-carpetas)
  - [🔀 Flujo de Trabajo (GitHub Flow)](#-flujo-de-trabajo-github-flow)
  - [📜 Convenciones de Código y Documentación](#-convenciones-de-código-y-documentación)
    - [Documentación](#documentación)
    - [TypeScript](#typescript)
    - [Nomenclatura](#nomenclatura)
  - [💬 Convenciones de Commits](#-convenciones-de-commits)

---

## 👥 Equipos y Responsabilidades

El proyecto está dividido en **5 equipos**, cada uno dueño de una responsabilidad concreta y aislada, comunicados entre sí exclusivamente a través de los contratos definidos en [`src/interfaces.ts`](./src/interfaces.ts).

### Equipo 1: Interfaz Principal y Entorno 3D (Core)
**Objetivo:** Construir la base de la aplicación, manejar la página principal y el espacio 3D vacío.
* **Responsabilidades clave:**
  * Crear el espacio virtual base con luces, cámara orbital (rotación con mouse) y ejes XYZ.
  * Crear los menús y botones para cambiar fluidamente entre "Modo Vectores" y "Modo GPS".
  * Diseñar y validar las cajas de texto (inputs) evitando campos vacíos o letras donde van números.
  * Conectar el trabajo de los demás equipos a la escena principal sin que el programa se congele.

### Equipo 2: Lógica y Matemáticas de Vectores
**Objetivo:** Motor de cálculo numérico (Sin programación visual).
* **Responsabilidades clave:**
  * Calcular los componentes del vector $(X, Y, Z)$ a partir de la velocidad inicial y los ángulos.
  * Calcular tiempo total de vuelo, altura máxima y distancia máxima recorrida.
  * Generar la fórmula con los puntos iterativos para trazar la curva del proyectil.
  * Manejar casos extremos (ej. velocidad $0$, ángulos negativos o totalmente verticales).

### Equipo 3: Gráficos 3D de Vectores
**Objetivo:** Transformar los números del Equipo 2 en gráficos interactivos.
* **Responsabilidades clave:**
  * Crear la flecha 3D del vector inicial partiendo desde el origen $(0,0,0)$.
  * Trazar la línea curva de la trayectoria del proyectil.
  * **Auto-escala:** Lograr que la cámara se adapte dinámicamente según la magnitud (ya sean 5 metros o 5,000 metros) para que la curva siempre encaje en la pantalla.

### Equipo 4: Lógica GPS y Conexión a Internet
**Objetivo:** Obtención de datos reales y matemáticas esféricas (Sin programación visual).
* **Responsabilidades clave:**
  * Conexión a la API (Open-Elevation) enviando Latitud/Longitud para extraer altitud real.
  * Manejo de errores de red (timeout, API caída) usando altitud $0$ por defecto para evitar colapsos.
  * Transformación Espacial: Convertir coordenadas esféricas a cartesianas $(X, Y, Z)$ 3D.

### Equipo 5: Gráficos 3D de GPS
**Objetivo:** Experiencia visual planetaria a partir de los datos del Equipo 4.
* **Responsabilidades clave:**
  * Diseñar un indicador/pantalla de "Cargando..." mientras se espera la respuesta de la API.
  * Generar la esfera 3D o malla de líneas que represente a la Tierra.
  * Dibujar un marcador llamativo (pin/esfera) en la coordenada $(X, Y, Z)$ exacta.
  * Animar la cámara para que realice un "zoom/vuelo" automático hacia la ubicación encontrada.

---

## 📂 Estructura de Carpetas

El proyecto está organizado por *Features* (Módulos de características) para evitar conflictos de código:

```text
/Graphing_Project_TS
│── .gitignore
│── index.html                # (Equipo 1) Punto de entrada web
│── package.json              # Dependencias
│── README.md                 # Convenciones
│── tsconfig.json             # Configuración estricta de TypeScript
├── /public
│   └── /assets               # Texturas, íconos
└── /src
    │── interfaces.ts         # Contratos de datos entre equipos
    │── main.ts               # (Equipo 1) Archivo principal que inicia todo
    │── style.css             # (Equipo 1) Estilos de la UI
    │
    ├── /core                 # EQUIPO 1: UI y Escena base
    │   ├── constants.ts      # Constantes
    │   ├── scene-manager.ts
    │   └── ui-manager.ts
    │
    ├── /vectors              # EQUIPOS 2 Y 3: Física
    │   ├── vector-math.ts     # (Equipo 2) Lógica y cálculos puros
    │   └── vector-render.ts   # (Equipo 3) Dibujado en THREE.js
    │
    └── /gps                  # EQUIPOS 4 Y 5: Planeta
        ├── gps-api.ts         # (Equipo 4) API Open-Elevation (Opcional, unificable en Math)
        ├── gps-math.ts        # (Equipo 4) Transformadas esféricas
        └── gps-render.ts      # (Equipo 5) Esfera y cámara de vuelo
```

---

## 🔀 Flujo de Trabajo (GitHub Flow)

Cada equipo es libre de organizarse internamente usando **Forks** o trabajando directamente sobre ramas del repositorio principal (ej. `feature/team-2-physics`).

- Lo estrictamente regulado es cómo ese código llega a `main`: siempre a través de un **Pull Request (PR)** que debe ser **aprobado** antes de hacer merge, para evitar que la interfaz principal colapse.
- Se debe sincronizar la rama o fork con los cambios que esten en main antes de hacer PR.

---

## 📜 Convenciones de Código y Documentación

El código debe ser mantenible a largo plazo y no debe romper el trabajo de los demás equipos. Nos basamos en el **Principio de Responsabilidad Única**: por ejemplo, el código que calcula la trayectoria (Equipo 2) **no** debe contener lógica de Three.js para dibujarla (eso es del Equipo 3); cada función hace una sola cosa.

### Documentación

* **Funciones complejas:** Toda lógica matemática o consultas a la API debe documentarse usando **JSDoc**.
* **Bloques confusos:** Comentar el *por qué* se hizo, no el *qué* hace.

```typescript
// Restamos 90 a la latitud para ajustarlo al ángulo cenital de la transformada
const phi = (90 - latitude) * (Math.PI / 180);

```



### TypeScript

* **Estricto:** Obligatorio `"strict": true` en `tsconfig.json`.
* **Cero Any:** PROHIBIDO el uso de `any`. Usar `unknown` y forzar casteo validado si es estrictamente necesario.

### Nomenclatura

* **Archivos y Carpetas:** `kebab-case` (ej. `vector-math.ts`).
* **Funciones y Variables:** `camelCase` (ej. `calculateFlightTime`, `startScene`).
* **Constantes Globales:** `UPPER_SNAKE_CASE` (ej. `RADIUS_SPHERE = 6371000`).
* **Interfaces/Tipos:** `PascalCase` sin prefijos (ej. `CoordinateGPS`).

---

## 💬 Convenciones de Commits

Es obligatorio el uso de **Conventional Commits** y **Gitmojis**. Todo mensaje debe estar en **inglés**.

**Formato estricto:**

```
:gitmoji: type(scope): commit message in english

```

El `scope` especifica el alcance del commit (ej. el paquete o módulo que se está modificando).

**Tipos permitidos:**

| Type | Descripción |
|---|---|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de un bug |
| `refactor` | Cambio de código que no corrige un bug ni añade funcionalidad (ej. reestructurar una carpeta) |
| `docs` | Nuevos o cambios exclusivos en la documentación |
| `remove` | Se ha eliminado algo del proyecto |
| `chore` | Cambios que no afectan el código fuente |
| `build` | Cambios al sistema de compilación o dependencias externas (ej. `package.json`) |
| `style` | Cambios de formato (espacios, indentación, punto y coma, etc.) que no afectan el significado del código |
| `perf` | Cambio de código que mejora el rendimiento |
| `test` | Agregar pruebas faltantes o corregir pruebas existentes |

**Ejemplos:**

```
✨ feat(vectors): add trajectory calculation for negative elevation angles
🐛 fix(gps): handle Open-Elevation timeout with default altitude
♻️ refactor(core): extract DOM ids into constants.ts
📝 docs(readme): add team responsibilities section
🔧 build(deps): add three and @types/three to package.json
```

[def]: #-graphing-project-vectors--gps-3d
