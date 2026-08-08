import type { GPSMathResults } from '../interfaces';

/**
 * Equipo 4: Lógica Matemática Espacial GPS
 * Convierte coordenadas polares/reales a coordenadas cartesianas 3D.
 */

/**
 * Convierte grados a radianes.
 */
function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convierte latitud, longitud y altitud real en un punto tridimensional (X, Y, Z).
 * Asume el eje Y como "Arriba" (Standard de Three.js).
 * 
 * @param lat Latitud en grados.
 * @param lng Longitud en grados.
 * @param alt Altitud en metros (proveniente de la API).
 * @param earthRadius Radio base de la tierra configurable para adaptarse a la escala de gráficos del Equipo 5.
 * @returns Objeto GPSMathResults.
 */
export function latLngAltToXYZ(
  lat: number,
  lng: number,
  alt: number,
  earthRadius: number = 6371000 // Por defecto en metros (~6371km)
): GPSMathResults {
  // Convertimos lat y lng a radianes
  const phi = degToRad(lat);
  const theta = degToRad(lng);

  // Distancia total desde el centro de la esfera
  const totalRadius = earthRadius + alt;

  // Transformación esférica estándar asumiendo Y hacia arriba y sistema de mano derecha.
  // En muchos sistemas 3D como Three.js:
  // x = R * cos(lat) * cos(lon)
  // y = R * sin(lat)
  // z = -R * cos(lat) * sin(lon)  (el negativo depende de dónde quede el meridiano 0)
  
  const x = totalRadius * Math.cos(phi) * Math.cos(theta);
  const y = totalRadius * Math.sin(phi);
  const z = -totalRadius * Math.cos(phi) * Math.sin(theta);

  // We need to return GPSMathResults
  return {
    cartesianCoordinate: { x, y, z },
    realAltitude: alt,
    totalRadius: totalRadius,
    zenithAngle: phi,
    azimuth: theta
  };
}
