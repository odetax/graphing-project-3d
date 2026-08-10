import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GPSRenderModule, GPSMathResults } from '../interfaces';
import { EARTH_VISUAL_RADIUS } from '../core/constants';

const PARALLEL_STEP_DEG  = 15;
const MERIDIAN_STEP_DEG  = 15;
const GRID_LINE_SEGMENTS = 64;

/** Color del preview pin (blanco tenue) */
const CLR_PREVIEW = 0xffffff;
/** Color del marcador final confirmado */
const CLR_MARKER  = 0xa855f7;

export class GPSRender implements GPSRenderModule {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls?: OrbitControls;

  private labelRenderer = new CSS2DRenderer();
  private earthGroup = new THREE.Group();

  /** Marcador final (después de presionar "Ubicar Satélite") */
  private marker: THREE.Group | null = null;
  /** Pin de preview (al hacer click en el globo, antes de confirmar) */
  private previewPin: THREE.Group | null = null;

  private isAnimating  = false;
  private animProgress = 0;
  private camStart     = new THREE.Vector3();
  private camEnd       = new THREE.Vector3();
  private target       = new THREE.Vector3();

  private lights: THREE.Light[] = [];
  private animationFrameId: number | null = null;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls?: OrbitControls) {
    this.scene    = scene;
    this.camera   = camera;
    this.controls = controls;

    const container     = document.getElementById('canvas-container') || document.body;
    const initialWidth  = container.clientWidth  || window.innerWidth;
    const initialHeight = container.clientHeight || window.innerHeight;

    this.labelRenderer.setSize(initialWidth, initialHeight);
    this.labelRenderer.domElement.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;display:none;';
    container.appendChild(this.labelRenderer.domElement);

    this.earthGroup.name    = 'GPSRenderGroup';
    this.earthGroup.visible = false;
    this.scene.add(this.earthGroup);

    this.createEarth();

    const updateSize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) this.labelRenderer.setSize(w, h);
    };
    new ResizeObserver(updateSize).observe(container);
    window.addEventListener('resize', updateSize);
  }

  //  RenderModule

  activate(): void {
    this.earthGroup.visible = true;
    this.labelRenderer.domElement.style.display = 'block';

    this.camera.near = 0.1;
    this.camera.far  = 20000000;
    this.camera.position.set(0, 0, 18);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }

    if (this.lights.length === 0) {
      const pl = new THREE.PointLight(0x00d4ff, 0.5, 20);
      pl.position.set(0, 5, 5);
      this.earthGroup.add(pl);
      this.lights.push(pl);
    }

    this.startAnimationLoop();
  }

  deactivate(): void {
    this.earthGroup.visible = false;
    this.labelRenderer.domElement.style.display = 'none';
    this.stopAnimationLoop();
    this.clearMarker();
    this.clearPreviewPin();
    this.lights.forEach(l => this.earthGroup.remove(l));
    this.lights = [];
  }

  //  PREVIEW PIN — punto temporal al hacer click en el globo

  /**
   * Coloca un pequeño punto blanco en la superficie del globo donde el
   * usuario hizo click. Es temporal — se reemplaza cuando el usuario
   * confirma con "Ubicar Satélite" o hace click en otro lugar.
   *
   * No mueve la cámara, solo marca visualmente la selección.
   *
   * @param lat Latitud en grados
   * @param lng Longitud en grados
   * @param placeName Nombre del lugar (de reverseGeocode), puede ser vacío
   */
  public placePreviewPin(lat: number, lng: number, placeName: string = ''): void {
    this.clearPreviewPin();

    // Convertir lat/lng a posición 3D sobre la superficie visual
    const phi   = THREE.MathUtils.degToRad(lat);
    const theta = THREE.MathUtils.degToRad(lng);
    const r     = EARTH_VISUAL_RADIUS * 1.005; // Ligeramente sobre la superficie

    const x =  r * Math.cos(phi) * Math.cos(theta);
    const y =  r * Math.sin(phi);
    const z = -r * Math.cos(phi) * Math.sin(theta);

    const group = new THREE.Group();
    group.name = 'PreviewPin';
    group.position.set(x, y, z);

    // Esfera pequeña blanca semitransparente
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 16),
      new THREE.MeshBasicMaterial({
        color: CLR_PREVIEW,
        transparent: true,
        opacity: 0.85,
      })
    );
    sphere.name = 'PreviewSphere';
    group.add(sphere);

    // Anillo exterior pulsante
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.28, 24),
      new THREE.MeshBasicMaterial({
        color: CLR_PREVIEW,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      })
    );
    ring.lookAt(0, 0, 0);
    ring.name = 'PreviewRing';
    group.add(ring);

    // Label con coordenadas + nombre del lugar
    const labelText = placeName
      ? `📌 ${placeName}\n${lat.toFixed(4)}°, ${lng.toFixed(4)}°`
      : `📌 ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;

    const labelDiv = document.createElement('div');
    labelDiv.style.cssText = `
      color: #e0e0e0;
      font: 600 11px "Outfit", "Inter", system-ui, sans-serif;
      background: rgba(10, 12, 20, 0.82);
      padding: 5px 12px;
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.25);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(8px);
      white-space: pre-line;
      text-align: center;
      line-height: 1.4;
      user-select: none;
    `;
    labelDiv.textContent = labelText;

    const label = new CSS2DObject(labelDiv);
    label.position.set(0, 0.45, 0);
    group.add(label);

    this.earthGroup.add(group);
    this.previewPin = group;
  }

  /**
   * Actualiza el texto del label del preview pin (para cuando llega
   * el nombre del lugar de forma asíncrona después de colocar el pin).
   */
  public updatePreviewLabel(lat: number, lng: number, placeName: string): void {
    if (!this.previewPin) return;

    const labelObj = this.previewPin.children.find(
      ch => ch instanceof CSS2DObject
    ) as CSS2DObject | undefined;

    if (labelObj && labelObj.element) {
      labelObj.element.textContent = placeName
        ? `📌 ${placeName}\n${lat.toFixed(4)}°, ${lng.toFixed(4)}°`
        : `📌 ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
    }
  }

  public clearPreviewPin(): void {
    if (this.previewPin) {
      this.previewPin.children.forEach(ch => {
        if (ch instanceof CSS2DObject && ch.element?.parentNode) {
          ch.element.parentNode.removeChild(ch.element);
        }
      });
      this.earthGroup.remove(this.previewPin);
      this.previewPin = null;
    }
  }

  //  MARCADOR FINAL — plotLocation (después de confirmar)

  /**
   * Marcador definitivo con esfera brillante, anillo pulsante, label con
   * altitud + nombre del lugar, y animación de cámara.
   *
   * @param data     Resultados de GPSMath
   * @param placeName Nombre del lugar (opcional, de reverseGeocode)
   */
  plotLocation(data: GPSMathResults, placeName?: string): void {
    this.clearMarker();
    this.clearPreviewPin(); // El preview se reemplaza por el marcador final

    const pos = data.cartesianCoordinate;
    const sf  = 1 / 1000000;
    const visualPos = new THREE.Vector3(pos.x * sf, pos.y * sf, pos.z * sf);

    const group = new THREE.Group();
    group.position.copy(visualPos);

    // Esfera marcador principal
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 32, 32),
      new THREE.MeshPhongMaterial({
        color: CLR_MARKER, emissive: CLR_MARKER, emissiveIntensity: 0.6,
        specular: 0xffffff, shininess: 100,
      })
    ));

    // Halo exterior
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 16, 16),
      new THREE.MeshBasicMaterial({
        color: CLR_MARKER, transparent: true, opacity: 0.1,
      })
    ));

    // Anillo pulsante
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.6, 32),
      new THREE.MeshBasicMaterial({
        color: 0xc084fc, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
      })
    );
    ring.lookAt(0, 0, 0);
    ring.name = 'PulsingRing';
    group.add(ring);

    const altText = `Alt: ${data.realAltitude.toFixed(2)}m`;
    const fullText = placeName
      ? `📍 ${placeName}\n${altText}`
      : `📍 ${altText}`;

    const labelDiv = document.createElement('div');
    labelDiv.style.cssText = `
      color: #ffffff;
      font: bold 13px "Outfit", "Inter", system-ui, sans-serif;
      background: rgba(15, 10, 26, 0.88);
      padding: 8px 16px;
      border-radius: 20px;
      border: 2px solid #c084fc;
      box-shadow: 0 0 16px rgba(168, 85, 247, 0.5), 0 4px 12px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(12px);
      white-space: pre-line;
      text-align: center;
      line-height: 1.4;
      max-width: 260px;
      user-select: none;
    `;
    labelDiv.textContent = fullText;

    const label = new CSS2DObject(labelDiv);
    label.position.set(0, 0.7, 0);
    group.add(label);

    this.earthGroup.add(group);
    this.marker = group;
    this.startCameraAnimation(visualPos);
  }

  //  TIERRA + GRILLA

  private createEarth(): void {
    this.earthGroup.children.length = 0;
    const radius = EARTH_VISUAL_RADIUS;

    const texture = new THREE.TextureLoader().load(
      'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'
    );

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 64, 64),
      new THREE.MeshPhongMaterial({
        map: texture, specular: new THREE.Color('grey'),
        shininess: 5, emissive: new THREE.Color(0x000022), emissiveIntensity: 0.1,
      })
    );
    earth.name = 'EarthMesh';
    this.earthGroup.add(earth);

    this.createGraticule(radius);
  }

  private createGraticule(radius: number): void {
    const gr = radius * 1.002;
    const mat = new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.2 });

    for (let lat = -90 + PARALLEL_STEP_DEG; lat < 90; lat += PARALLEL_STEP_DEG) {
      const phi = THREE.MathUtils.degToRad(lat);
      const rr  = gr * Math.cos(phi);
      const y   = gr * Math.sin(phi);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= GRID_LINE_SEGMENTS; i++) {
        const th = (i / GRID_LINE_SEGMENTS) * Math.PI * 2;
        pts.push(new THREE.Vector3(rr * Math.cos(th), y, -rr * Math.sin(th)));
      }
      this.earthGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }

    for (let lng = 0; lng < 360; lng += MERIDIAN_STEP_DEG) {
      const th = THREE.MathUtils.degToRad(lng);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= GRID_LINE_SEGMENTS; i++) {
        const phi = -Math.PI / 2 + (i / GRID_LINE_SEGMENTS) * Math.PI;
        pts.push(new THREE.Vector3(
          gr * Math.cos(phi) * Math.cos(th),
          gr * Math.sin(phi),
          -gr * Math.cos(phi) * Math.sin(th)
        ));
      }
      this.earthGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
    }
  }

  //  ANIMACIÓN DE CÁMARA

  private startCameraAnimation(target: THREE.Vector3): void {
    const dist = target.length();
    this.camStart.copy(this.camera.position);
    this.camEnd.copy(
      target.clone()
        .add(target.clone().normalize().multiplyScalar(dist * 1.5))
        .add(new THREE.Vector3(1, 0.5, 0))
    );
    this.target.copy(target);
    this.isAnimating  = true;
    this.animProgress = 0;
  }

  private updateCameraAnimation(): void {
    if (!this.isAnimating) return;
    this.animProgress = Math.min(this.animProgress + 0.008, 1);
    const e = this.animProgress < 0.5
      ? 4 * this.animProgress ** 3
      : 1 - (-2 * this.animProgress + 2) ** 3 / 2;

    this.camera.position.lerpVectors(this.camStart, this.camEnd, e);
    this.camera.lookAt(this.target);
    if (this.controls) this.controls.target.copy(this.target);
    if (this.animProgress >= 1) this.isAnimating = false;
  }

  private animateMarker(): void {
    if (!this.marker) return;
    const t = Date.now() * 0.001;
    this.marker.children.forEach(ch => {
      if (ch.name === 'PulsingRing' && ch instanceof THREE.Mesh) {
        const s = 1 + Math.sin(t * 1.5) * 0.2;
        ch.scale.set(s, s, s);
        if (ch.material instanceof THREE.MeshBasicMaterial) {
          ch.material.opacity = 0.2 + Math.sin(t * 1.5) * 0.15;
        }
      }
    });

    // También animar el preview pin si existe
    if (this.previewPin) {
      const pr = this.previewPin.children.find(ch => ch.name === 'PreviewRing');
      if (pr && pr instanceof THREE.Mesh) {
        const s = 1 + Math.sin(t * 2.5) * 0.15;
        pr.scale.set(s, s, s);
      }
    }
  }

  private startAnimationLoop = () => {
    this.updateCameraAnimation();
    this.animateMarker();
    if (this.earthGroup.visible) this.labelRenderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(this.startAnimationLoop);
  };

  private stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private clearMarker(): void {
    if (this.marker) {
      this.marker.children.forEach(ch => {
        if (ch instanceof CSS2DObject && ch.element?.parentNode) {
          ch.element.parentNode.removeChild(ch.element);
        }
      });
      this.earthGroup.remove(this.marker);
      this.marker = null;
    }
  }
}