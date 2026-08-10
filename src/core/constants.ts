// Física
export const GRAVITY = 9.8;
export const SCENE_SCALE_VECTORS = 0.05;

// Zoom (OrbitControls.minDistance / maxDistance)
export const VECTORS_ZOOM_MIN = 3;
export const VECTORS_ZOOM_MAX = 800;

export const GPS_ZOOM_MIN = 7.5;
export const GPS_ZOOM_MAX = 60;

// Radio visual de la Tierra
export const EARTH_VISUAL_RADIUS = 6.371;

// Ejes con flecha
/** Longitud por defecto de cada eje (se escala dinámicamente en vectores) */
export const DEFAULT_AXIS_LENGTH = 10;
/** Offset extra del label respecto a la punta de la flecha del eje */
export const AXIS_LABEL_GAP = 2.5;
/** Colores de cada eje */
export const AXIS_COLORS = {
    X: 0xff5252,
    Y: 0x4caf50,
    Z: 0x29b6f6,
} as const;
export const AXIS_CSS_COLORS = {
    X: '#ff5252',
    Y: '#4caf50',
    Z: '#29b6f6',
} as const;

// Fondo estrellado
export const STAR_COUNT = 1200;
export const STAR_FIELD_RADIUS = 900;