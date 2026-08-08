import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GPSRenderModule, GPSMathResults } from '../interfaces';

export class GPSRender implements GPSRenderModule {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls?: OrbitControls;
  
  private labelRenderer = new CSS2DRenderer();
  private earthGroup = new THREE.Group();
  private marker: THREE.Group | null = null;
  
  private isAnimating = false;
  private animProgress = 0;
  private camStart = new THREE.Vector3();
  private camEnd = new THREE.Vector3();
  private target = new THREE.Vector3();

  // Guardamos las luces para poder removerlas al desactivar
  private lights: THREE.Light[] = [];
  
  // Guardamos la animación ID para detenerla
  private animationFrameId: number | null = null;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls?: OrbitControls) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;

    const container = document.getElementById('canvas-container') || document.body;
    const initialWidth = container.clientWidth || window.innerWidth;
    const initialHeight = container.clientHeight || window.innerHeight;

    // Configurar renderizador de etiquetas CSS2D dentro del contenedor del canvas
    this.labelRenderer.setSize(initialWidth, initialHeight);
    this.labelRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;display:none;';
    container.appendChild(this.labelRenderer.domElement);

    this.earthGroup.name = 'GPSRenderGroup';
    // Oculto por defecto
    this.earthGroup.visible = false;
    this.scene.add(this.earthGroup);

    this.createEarth();

    const updateSize = () => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (width > 0 && height > 0) {
            this.labelRenderer.setSize(width, height);
        }
    };

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    window.addEventListener('resize', updateSize);
  }

  activate(): void {
    this.earthGroup.visible = true;
    this.labelRenderer.domElement.style.display = 'block';
    
    // Reset camera projection planes & position for Earth view
    this.camera.near = 0.1;
    this.camera.far = 20000000;
    this.camera.position.set(0, 0, 18);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }

    // Agregar luces específicas para la tierra si no están agregadas
    if (this.lights.length === 0) {
      const pointLight = new THREE.PointLight(0x00d4ff, 0.5, 20);
      pointLight.position.set(0, 5, 5);
      this.earthGroup.add(pointLight);
      this.lights.push(pointLight);
    }

    this.startAnimationLoop();
  }

  deactivate(): void {
    this.earthGroup.visible = false;
    this.labelRenderer.domElement.style.display = 'none';
    this.stopAnimationLoop();
    
    // Cleanup marker if exists
    this.clearMarker();
    
    // Cleanup lights
    this.lights.forEach(light => this.earthGroup.remove(light));
    this.lights = [];
  }

  plotLocation(data: GPSMathResults): void {
    // Eliminar marcador anterior si existe
    this.clearMarker();
    
    const pos = data.cartesianCoordinate;
    // Escalar la posición para la representación visual (Radio visual = ~6.371)
    // El radio matemático era ~6371000. Factor de escala: / 1000000
    const scaleFactor = 1 / 1000000;
    const visualPos = new THREE.Vector3(pos.x * scaleFactor, pos.y * scaleFactor, pos.z * scaleFactor);

    const group = new THREE.Group();
    group.position.copy(visualPos);

    // Esfera principal del marcador en morado radiante (Purple Accent)
    group.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 32, 32),
      new THREE.MeshPhongMaterial({ 
        color: 0xa855f7, 
        emissive: 0xa855f7, 
        emissiveIntensity: 0.6, 
        specular: 0xffffff, 
        shininess: 100 
      })
    ));

    // Anillo pulsante morado
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.6, 32),
      new THREE.MeshBasicMaterial({ 
        color: 0xc084fc, 
        transparent: true, 
        opacity: 0.4, 
        side: THREE.DoubleSide 
      })
    );
    ring.lookAt(0, 0, 0); // Apuntar siempre al centro de la Tierra
    ring.name = 'PulsingRing';
    group.add(ring);

    // Etiqueta HTML morada neumórfica
    const label = new CSS2DObject(
      Object.assign(document.createElement('div'), {
        textContent: `📍 Alt: ${data.realAltitude}m`,
        style: { 
          color: '#ffffff', 
          font: 'bold 14px "Outfit", "Inter", sans-serif', 
          background: 'rgba(15, 10, 26, 0.85)', 
          padding: '8px 16px', 
          borderRadius: '20px', 
          border: '2px solid #c084fc', 
          boxShadow: '0 0 14px rgba(168, 85, 247, 0.6)',
          backdropFilter: 'blur(10px)' 
        }
      })
    );
    label.position.set(0, 0.6, 0);
    group.add(label);

    this.earthGroup.add(group);
    this.marker = group;
    
    // Iniciar animación de cámara hacia el marcador
    this.startCameraAnimation(visualPos);
  }

  private createEarth() {
    this.earthGroup.children.length = 0;
    const radius = 6.371; // Radio visual

    const texture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg');

    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 64, 64),
      new THREE.MeshPhongMaterial({ 
        map: texture, 
        specular: new THREE.Color('grey'), 
        shininess: 5, 
        emissive: new THREE.Color(0x000022), 
        emissiveIntensity: 0.1 
      })
    );
    earth.name = 'EarthMesh';
    this.earthGroup.add(earth);

    // Malla de alambre (wireframe)
    const wireframe = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.001, 24, 16),
      new THREE.MeshBasicMaterial({ 
        color: 0x4488ff, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.15 
      })
    );
    this.earthGroup.add(wireframe);
  }

  private startCameraAnimation(target: THREE.Vector3) {
    const dist = target.length();
    this.camStart.copy(this.camera.position);
    // Calcular posición final
    this.camEnd.copy(target.clone().add(target.clone().normalize().multiplyScalar(dist * 1.5)).add(new THREE.Vector3(1, 0.5, 0)));
    this.target.copy(target);
    this.isAnimating = true;
    this.animProgress = 0;
  }

  private updateCameraAnimation() {
    if (!this.isAnimating) return;
    
    this.animProgress = Math.min(this.animProgress + 0.008, 1);
    
    const ease = this.animProgress < 0.5 
      ? 4 * this.animProgress ** 3 
      : 1 - (-2 * this.animProgress + 2) ** 3 / 2;
    
    this.camera.position.lerpVectors(this.camStart, this.camEnd, ease);
    this.camera.lookAt(this.target);
    if (this.controls) {
      this.controls.target.copy(this.target);
    }
    
    if (this.animProgress >= 1) this.isAnimating = false;
  }

  private animateMarker() {
    if (!this.marker) return;
    
    const time = Date.now() * 0.001;
    
    this.marker.children.forEach(child => {
      if (child.name === 'PulsingRing' && child instanceof THREE.Mesh) {
          const s = 1 + Math.sin(time * 1.5) * 0.2;
          child.scale.set(s, s, s);
          if (child.material instanceof THREE.MeshBasicMaterial) {
            child.material.opacity = 0.2 + Math.sin(time * 1.5) * 0.15;
          }
      }
    });
  }

  private startAnimationLoop = () => {
    this.updateCameraAnimation();
    this.animateMarker();
    
    if (this.earthGroup.visible) {
        this.labelRenderer.render(this.scene, this.camera);
    }
    
    this.animationFrameId = requestAnimationFrame(this.startAnimationLoop);
  }

  private stopAnimationLoop() {
      if (this.animationFrameId !== null) {
          cancelAnimationFrame(this.animationFrameId);
          this.animationFrameId = null;
      }
  }

  private clearMarker() {
      if (this.marker) {
          this.marker.children.forEach(child => {
              if (child instanceof CSS2DObject) {
                  if (child.element && child.element.parentNode) {
                      child.element.parentNode.removeChild(child.element);
                  }
              }
          });
          this.earthGroup.remove(this.marker);
          this.marker = null;
      }
  }
}


