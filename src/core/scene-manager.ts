import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import {
    VECTORS_ZOOM_MIN, VECTORS_ZOOM_MAX,
    GPS_ZOOM_MIN, GPS_ZOOM_MAX,
    DEFAULT_AXIS_LENGTH, AXIS_LABEL_GAP,
    AXIS_COLORS, AXIS_CSS_COLORS,
    STAR_COUNT, STAR_FIELD_RADIUS,
} from './constants';

export class SceneManager {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private canvasContainer: HTMLElement;

    // Ejes con flecha
    private axesGroup: THREE.Group;
    private axisLabelRenderer: CSS2DRenderer;

    // Estrellas del fondo
    private starField: THREE.Points;

    /** Longitud actual de los ejes (se actualiza con updateAxesScale) */
    private currentAxisLength = DEFAULT_AXIS_LENGTH;

    constructor(canvas: HTMLCanvasElement) {
        this.scene = new THREE.Scene();
        // Fondo oscuro para que las estrellas resalten
        this.scene.background = new THREE.Color(0x020408);

        this.canvasContainer = canvas.parentElement || document.body;
        const initialWidth = this.canvasContainer.clientWidth || window.innerWidth;
        const initialHeight = this.canvasContainer.clientHeight || window.innerHeight;

        // Cámara
        this.camera = new THREE.PerspectiveCamera(
            45,
            initialWidth / initialHeight,
            0.1,
            20000000
        );
        this.camera.position.set(15, 12, 15);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        this.renderer.setSize(initialWidth, initialHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        // Desactivar paneo (click derecho arrastrando) para evitar perderse
        this.controls.enablePan = false;

        // Luces
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
        dirLight.position.set(5, 10, 7).normalize();
        this.scene.add(dirLight);

        // Fondo estrellado
        this.starField = this.createStarField();
        this.scene.add(this.starField);

        // Ejes con flecha y labels
        this.axesGroup = new THREE.Group();
        this.axesGroup.name = 'CustomAxesGroup';
        this.scene.add(this.axesGroup);

        this.axisLabelRenderer = new CSS2DRenderer();
        this.axisLabelRenderer.setSize(initialWidth, initialHeight);
        this.axisLabelRenderer.domElement.style.cssText =
            'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:4;';
        this.canvasContainer.appendChild(this.axisLabelRenderer.domElement);

        this.buildAxes(DEFAULT_AXIS_LENGTH);

        // Resize
        const resizeObserver = new ResizeObserver(() => this.onResize());
        resizeObserver.observe(this.canvasContainer);
        window.addEventListener('resize', this.onResize.bind(this));

        this.animate();
    }

    //  EJES CON FLECHAS + LABELS
    /**
     * Destruye ejes previos y los reconstruye con la longitud indicada.
     * Cada eje: ArrowHelper (línea + cono) + CSS2DObject (label "X"/"Y"/"Z").
     */
    private buildAxes(length: number): void {
        this.axesGroup.children.forEach(child => {
            if (child instanceof CSS2DObject && child.element?.parentNode) {
                child.element.parentNode.removeChild(child.element);
            }
        });
        while (this.axesGroup.children.length > 0) {
            this.axesGroup.remove(this.axesGroup.children[0]);
        }

        this.currentAxisLength = length;

        const headLength = length * 0.08;
        const headWidth  = headLength * 0.5;

        const axisData: Array<{
            name: 'X' | 'Y' | 'Z';
            dir: THREE.Vector3;
        }> = [
            { name: 'X', dir: new THREE.Vector3(1, 0, 0) },
            { name: 'Y', dir: new THREE.Vector3(0, 1, 0) },
            { name: 'Z', dir: new THREE.Vector3(0, 0, 1) },
        ];

        for (const axis of axisData) {
            const color = AXIS_COLORS[axis.name];

            // Flecha 3D
            const arrow = new THREE.ArrowHelper(
                axis.dir,
                new THREE.Vector3(0, 0, 0),
                length,
                color,
                headLength,
                headWidth
            );
            arrow.name = `Axis_${axis.name}`;
            this.axesGroup.add(arrow);

            const labelPos = axis.dir.clone().multiplyScalar(length + AXIS_LABEL_GAP);
            const div = document.createElement('div');
            div.textContent = axis.name;
            const cssColor = AXIS_CSS_COLORS[axis.name];
            div.style.cssText = `
                color: ${cssColor};
                font-family: "Outfit", "Inter", monospace;
                font-size: 18px;
                font-weight: 900;
                text-shadow: 0 0 8px ${cssColor}90, 0 0 20px ${cssColor}40;
                user-select: none;
            `;
            const cssObj = new CSS2DObject(div);
            cssObj.position.copy(labelPos);
            this.axesGroup.add(cssObj);
        }
    }

    /**
     * Escala dinámica de los ejes para que se adapten al contenido visible.
     * Llamado por VectorRender después de calcular el bounding box de la
     * trayectoria, pasando el radio de la esfera envolvente.
     */
    public updateAxesScale(contentRadius: number): void {
        // Que los ejes cubran ~120% del contenido visible para no quedar cortos
        const newLength = Math.max(contentRadius * 1.2, DEFAULT_AXIS_LENGTH);
        if (Math.abs(newLength - this.currentAxisLength) > 0.5) {
            this.buildAxes(newLength);
        }
    }

    //  FONDO ESTRELLADO

    private createStarField(): THREE.Points {
        const positions = new Float32Array(STAR_COUNT * 3);
        const sizes     = new Float32Array(STAR_COUNT);

        for (let i = 0; i < STAR_COUNT; i++) {
            // Distribución esférica uniforme
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos(2 * Math.random() - 1);
            const r     = STAR_FIELD_RADIUS * (0.6 + Math.random() * 0.4);

            positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            sizes[i] = 0.5 + Math.random() * 2.0;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            sizeAttenuation: true,
            size: 1.2,
            transparent: true,
            opacity: 0.85,
        });

        return new THREE.Points(geometry, material);
    }

    //  RESIZE & ANIMATION LOOP

    private onResize(): void {
        const width  = this.canvasContainer.clientWidth;
        const height = this.canvasContainer.clientHeight;
        if (width === 0 || height === 0) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        this.axisLabelRenderer.setSize(width, height);
    }

    private animate(): void {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        this.axisLabelRenderer.render(this.scene, this.camera);
    }

    //  API PÚBLICA

    public getScene(): THREE.Scene { return this.scene; }
    public getCamera(): THREE.PerspectiveCamera { return this.camera; }
    public getControls(): OrbitControls { return this.controls; }

    public setAxesVisible(visible: boolean): void {
        this.axesGroup.visible = visible;
    }

    /**
     * Configura zoom + target de OrbitControls al cambiar de modo.
     * Reposiciona la cámara al default de cada modo para que la transición
     * no deje la cámara en un lugar absurdo.
     */
    public applyZoomLimits(mode: 'VECTORS' | 'GPS'): void {
        if (mode === 'VECTORS') {
            this.controls.minDistance = VECTORS_ZOOM_MIN;
            this.controls.maxDistance = VECTORS_ZOOM_MAX;
            // Target al origen para vectores
            this.controls.target.set(0, 0, 0);
            this.camera.position.set(15, 12, 15);
            this.camera.near = 0.1;
            this.camera.far = 5000;
            this.camera.updateProjectionMatrix();
        } else {
            this.controls.minDistance = GPS_ZOOM_MIN;
            this.controls.maxDistance = GPS_ZOOM_MAX;
            this.controls.target.set(0, 0, 0);
            this.camera.position.set(0, 0, 18);
            this.camera.near = 0.1;
            this.camera.far = 20000000;
            this.camera.updateProjectionMatrix();
        }
        this.controls.update();
    }
}