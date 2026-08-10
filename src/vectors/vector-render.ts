import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { VectorMathResults, VectorRenderModule } from '../interfaces';
import type { SceneManager } from '../core/scene-manager';
import { AXIS_COLORS, AXIS_CSS_COLORS } from '../core/constants';

const ARROW_COLOR     = 0x00e5ff;
const ARROW_CSS_COLOR = '#00e5ff';
const TRAJECTORY_COLOR = 0xff6d00;
const PEAK_COLOR      = 0xffb74d;
const PEAK_CSS_COLOR  = '#ffb74d';
const IMPACT_COLOR    = 0xc084fc;
const IMPACT_CSS_COLOR = '#c084fc';

const CAMERA_PADDING_FACTOR = 0.35;
const CAMERA_MIN_DISTANCE   = 5;

/** Magnitud visual mínima del vector flecha para que no quede invisible */
const MIN_VISUAL_ARROW_LENGTH = 2.0;
const ARROW_LENGTH_FACTOR     = 0.15;
const MAX_HEAD_BODY_RATIO     = 0.30;

interface Disposable { dispose(): void; }

export class VectorRender implements VectorRenderModule {
    private readonly scene: THREE.Scene;
    private readonly camera: THREE.PerspectiveCamera;
    private readonly controls: OrbitControls;
    private readonly sceneManager: SceneManager;
    private readonly group: THREE.Group;
    private readonly disposables: Disposable[] = [];

    private labelRenderer = new CSS2DRenderer();
    private animationFrameId: number | null = null;

    /**
     * @param scene       Escena compartida
     * @param camera      Cámara compartida
     * @param controls    OrbitControls — necesarios para sincronizar target al encuadrar
     * @param sceneManager SceneManager — para escalar ejes dinámicamente
     */
    constructor(
        scene: THREE.Scene,
        camera: THREE.PerspectiveCamera,
        controls: OrbitControls,
        sceneManager: SceneManager
    ) {
        this.scene = scene;
        this.camera = camera;
        this.controls = controls;
        this.sceneManager = sceneManager;

        this.group = new THREE.Group();
        this.group.name = 'VectorRenderGroup';
        this.group.visible = false;
        this.scene.add(this.group);

        const container = document.getElementById('canvas-container') || document.body;
        const initialWidth  = container.clientWidth  || window.innerWidth;
        const initialHeight = container.clientHeight || window.innerHeight;

        this.labelRenderer.setSize(initialWidth, initialHeight);
        this.labelRenderer.domElement.style.cssText =
            'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;display:none;';
        container.appendChild(this.labelRenderer.domElement);

        const updateSize = () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            if (w > 0 && h > 0) this.labelRenderer.setSize(w, h);
        };
        const ro = new ResizeObserver(updateSize);
        ro.observe(container);
        window.addEventListener('resize', updateSize);
    }

    activate(): void {
        this.group.visible = true;
        this.labelRenderer.domElement.style.display = 'block';
        this.startAnimationLoop();
    }

    deactivate(): void {
        this.group.visible = false;
        this.labelRenderer.domElement.style.display = 'none';
        this.stopAnimationLoop();
        this.clearScene();
    }

    plotTrajectory(data: VectorMathResults): void {
        this.clearScene();

        const totalMag = Math.sqrt(data.vx ** 2 + data.vy ** 2 + data.vz ** 2);

        // Guard: magnitud = 0
        if (totalMag === 0) {
            this.addNeuBadge('Vector nulo — magnitud = 0', new THREE.Vector3(0, 1, 0), ARROW_CSS_COLOR);
            return;
        }

        // Guard: sin trayectoria (vy ≤ 0)
        if (data.trajectoryPoints.length < 2) {
            this.drawInitialArrow(data);
            this.addNeuBadge('Sin trayectoria — vy ≤ 0', new THREE.Vector3(0, 2, 0), PEAK_CSS_COLOR);
            this.frameCamera([{ x: 0, y: 0, z: 0 }, { x: data.vx, y: data.vy, z: data.vz }]);
            return;
        }

        this.drawInitialArrow(data);
        this.drawTrajectoryLine(data.trajectoryPoints);
        this.drawProjectionsAndBadges(data);
        this.frameCamera(data.trajectoryPoints);
    }

    private drawInitialArrow(data: VectorMathResults): void {
        const direction = new THREE.Vector3(data.vx, data.vy, data.vz);
        const magnitude = direction.length();
        if (magnitude === 0) return;

        direction.normalize();

        // Clamping: vectores pequeños siguen visibles
        const rawLength  = magnitude * ARROW_LENGTH_FACTOR;
        const arrowLength = Math.max(rawLength, MIN_VISUAL_ARROW_LENGTH);

        // Punta proporcional con tope
        const headLength = Math.min(arrowLength * 0.25, arrowLength * MAX_HEAD_BODY_RATIO);
        const headWidth  = headLength * 0.5;

        const arrow = new THREE.ArrowHelper(
            direction, new THREE.Vector3(0, 0, 0),
            arrowLength, ARROW_COLOR, headLength, headWidth
        );
        arrow.name = 'InitialVelocityArrow';

        if (arrow.line.geometry) this.track(arrow.line.geometry);
        if (arrow.cone.geometry) this.track(arrow.cone.geometry);
        if (arrow.line.material instanceof THREE.Material) this.track(arrow.line.material);
        if (arrow.cone.material instanceof THREE.Material) this.track(arrow.cone.material);
        this.group.add(arrow);

        // Proyecciones
        const tipPos    = direction.clone().multiplyScalar(arrowLength);
        const groundPos = new THREE.Vector3(tipPos.x, 0, tipPos.z);
        const xPos = new THREE.Vector3(tipPos.x, 0, 0);
        const zPos = new THREE.Vector3(0, 0, tipPos.z);
        const yPos = new THREE.Vector3(0, tipPos.y, 0);

        this.addDashedLine([tipPos, groundPos], ARROW_COLOR);
        this.addDashedLine([groundPos, xPos], ARROW_COLOR);
        this.addDashedLine([groundPos, zPos], ARROW_COLOR);
        this.addDashedLine([tipPos, yPos], ARROW_COLOR);

        this.addNeuBadge(
            `V₀ = ${magnitude.toFixed(2)} m/s (Vx: ${data.vx.toFixed(2)}, Vy: ${data.vy.toFixed(2)}, Vz: ${data.vz.toFixed(2)})`,
            new THREE.Vector3(tipPos.x, tipPos.y + 0.6, tipPos.z),
            ARROW_CSS_COLOR
        );
    }

    private drawTrajectoryLine(points: VectorMathResults['trajectoryPoints']): void {
        const geometry = new THREE.BufferGeometry();
        this.track(geometry);
        geometry.setFromPoints(points.map(p => new THREE.Vector3(p.x, p.y, p.z)));

        const material = new THREE.LineBasicMaterial({ color: TRAJECTORY_COLOR, linewidth: 3 });
        this.track(material);

        const line = new THREE.Line(geometry, material);
        line.name = 'TrajectoryLine';
        this.group.add(line);
    }

    private drawProjectionsAndBadges(data: VectorMathResults): void {
        const points = data.trajectoryPoints;

        let apexIdx = 0;
        for (let i = 1; i < points.length; i++) {
            if (points[i].y > points[apexIdx].y) apexIdx = i;
        }
        const mp = points[apexIdx];
        const apexPos    = new THREE.Vector3(mp.x, mp.y, mp.z);
        const apexGround = new THREE.Vector3(mp.x, 0, mp.z);
        const apexYAxis  = new THREE.Vector3(0, mp.y, 0);

        this.addDashedLine([apexPos, apexGround], PEAK_COLOR);
        this.addDashedLine([apexPos, apexYAxis], PEAK_COLOR);

        this.addNeuBadge(
            `Hmáx: ${data.maxHeight.toFixed(2)}m`,
            new THREE.Vector3(apexPos.x, apexPos.y + 0.5, apexPos.z),
            PEAK_CSS_COLOR
        );
        this.addTickMark(apexYAxis, 'Y');
        this.addNeuBadge(`Y = ${data.maxHeight.toFixed(2)}m`, new THREE.Vector3(-0.8, apexYAxis.y, 0), AXIS_CSS_COLORS.Y);

        const ep = points[points.length - 1];
        const landingPos   = new THREE.Vector3(ep.x, ep.y, ep.z);
        const landingXAxis = new THREE.Vector3(ep.x, 0, 0);
        const landingZAxis = new THREE.Vector3(0, 0, ep.z);

        this.addDashedLine([landingPos, landingXAxis], IMPACT_COLOR);
        this.addDashedLine([landingPos, landingZAxis], IMPACT_COLOR);

        this.addNeuBadge(
            `Alcance: ${data.maxRange.toFixed(2)}m (${data.flightTime.toFixed(2)}s)`,
            new THREE.Vector3(landingPos.x, landingPos.y + 0.5, landingPos.z),
            IMPACT_CSS_COLOR
        );

        const realX = data.vx * data.flightTime;
        this.addTickMark(landingXAxis, 'X');
        this.addNeuBadge(`X = ${realX.toFixed(2)}m`, new THREE.Vector3(landingXAxis.x, -0.6, 0), AXIS_CSS_COLORS.X);

        if (Math.abs(data.vz) > 0.01) {
            const realZ = data.vz * data.flightTime;
            this.addTickMark(landingZAxis, 'Z');
            this.addNeuBadge(`Z = ${realZ.toFixed(2)}m`, new THREE.Vector3(0, -0.6, landingZAxis.z), AXIS_CSS_COLORS.Z);
        }
    }

    private frameCamera(points: VectorMathResults['trajectoryPoints']): void {
        const box = new THREE.Box3();
        for (const p of points) {
            box.expandByPoint(new THREE.Vector3(p.x, p.y, p.z));
        }
        // Siempre incluir el origen
        box.expandByPoint(new THREE.Vector3(0, 0, 0));

        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);
        const { center, radius } = sphere;

        const effectiveRadius = Math.max(radius, 1);

        // Distancia de retroceso basada en FOV para que todo quepa
        const vFov     = THREE.MathUtils.degToRad(this.camera.fov / 2);
        const pullBack = (effectiveRadius / Math.tan(vFov)) * (1 + CAMERA_PADDING_FACTOR);
        const clamped  = Math.max(pullBack, CAMERA_MIN_DISTANCE);

        // Posicionar cámara
        const offset = new THREE.Vector3(1.1, 1.2, 1.3).normalize().multiplyScalar(clamped);
        this.camera.position.copy(center).add(offset);
        this.camera.lookAt(center);

        // near/far dinámicos para no recortar geometría
        this.camera.near = Math.max(clamped * 0.005, 0.01);
        this.camera.far  = Math.max(clamped * 10, 5000);
        this.camera.updateProjectionMatrix();

        this.controls.target.copy(center);
        this.controls.update();

        // Escalar los ejes del SceneManager para que cubran el contenido
        this.sceneManager.updateAxesScale(effectiveRadius);
    }

    //  HELPERS DE DIBUJO

    private addDashedLine(points: THREE.Vector3[], colorHex: number): void {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.track(geometry);
        const material = new THREE.LineDashedMaterial({
            color: colorHex, dashSize: 0.35, gapSize: 0.2,
            linewidth: 2, transparent: true, opacity: 0.8,
        });
        this.track(material);
        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        this.group.add(line);
    }

    private addTickMark(pos: THREE.Vector3, axis: 'X' | 'Y' | 'Z'): void {
        const s = 0.25;
        let p1: THREE.Vector3, p2: THREE.Vector3;

        if (axis === 'X') {
            p1 = new THREE.Vector3(pos.x, -s, 0);
            p2 = new THREE.Vector3(pos.x, s, 0);
        } else if (axis === 'Y') {
            p1 = new THREE.Vector3(-s, pos.y, 0);
            p2 = new THREE.Vector3(s, pos.y, 0);
        } else {
            p1 = new THREE.Vector3(0, -s, pos.z);
            p2 = new THREE.Vector3(0, s, pos.z);
        }

        const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        this.track(geom);
        const color = AXIS_COLORS[axis];
        const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
        this.track(mat);
        this.group.add(new THREE.Line(geom, mat));
    }

    private addNeuBadge(text: string, position: THREE.Vector3, accentColor: string): void {
        const div = document.createElement('div');
        div.textContent = text;
        div.style.cssText = `
            color: var(--text-primary, #ffffff);
            font-family: "Outfit", "Inter", sans-serif;
            font-size: 11px; font-weight: 700;
            background: var(--card-bg, rgba(13, 17, 26, 0.9));
            padding: 5px 12px; border-radius: 14px;
            border: 1px solid ${accentColor};
            box-shadow: 0 4px 12px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.15);
            backdrop-filter: blur(10px);
            white-space: nowrap; user-select: none;
        `;
        const cssObject = new CSS2DObject(div);
        cssObject.position.copy(position);
        this.group.add(cssObject);
    }

    //  ANIMATION LOOP & CLEANUP

    private startAnimationLoop = () => {
        if (this.group.visible) {
            this.labelRenderer.render(this.scene, this.camera);
        }
        this.animationFrameId = requestAnimationFrame(this.startAnimationLoop);
    };

    private stopAnimationLoop(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    private track(resource: Disposable): void {
        this.disposables.push(resource);
    }

    private clearScene(): void {
        this.group.children.forEach(child => {
            if (child instanceof CSS2DObject && child.element?.parentNode) {
                child.element.parentNode.removeChild(child.element);
            }
        });
        while (this.group.children.length > 0) {
            this.group.remove(this.group.children[0]);
        }
        for (const r of this.disposables) r.dispose();
        this.disposables.length = 0;
    }
}