import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import type { VectorMathResults, VectorRenderModule } from '../interfaces.ts';

// ---------------------------------------------------------------------------
// Design System Color Tokens & Palette
// ---------------------------------------------------------------------------

/** Initial velocity vector arrow and decomposition color (Cyan) */
const ARROW_COLOR = 0x00e5ff;
const ARROW_CSS_COLOR = '#00e5ff';

/** Trajectory main curve color (Vibrant Orange) */
const TRAJECTORY_COLOR = 0xff6d00;

/** Peak Height (Hmax) projection color (Gold/Amber) */
const PEAK_COLOR = 0xffb74d;
const PEAK_CSS_COLOR = '#ffb74d';

/** Range & Impact (Rmax) projection color (Purple) */
const IMPACT_COLOR = 0xc084fc;
const IMPACT_CSS_COLOR = '#c084fc';

/** Axis Component Colors */
const X_AXIS_CSS = '#ff5252';
const Y_AXIS_CSS = '#4caf50';
const Z_AXIS_CSS = '#29b6f6';

const CAMERA_PADDING_FACTOR = 0.35;
const CAMERA_MIN_DISTANCE = 8;

interface Disposable {
    dispose(): void;
}

export class VectorRender implements VectorRenderModule {
    private readonly scene: THREE.Scene;
    private readonly camera: THREE.PerspectiveCamera;
    private readonly group: THREE.Group;
    private readonly disposables: Disposable[] = [];
    
    private labelRenderer = new CSS2DRenderer();
    private animationFrameId: number | null = null;

    constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
        this.scene = scene;
        this.camera = camera;

        this.group = new THREE.Group();
        this.group.name = 'VectorRenderGroup';
        this.group.visible = false;
        this.scene.add(this.group);

        const container = document.getElementById('canvas-container') || document.body;
        const initialWidth = container.clientWidth || window.innerWidth;
        const initialHeight = container.clientHeight || window.innerHeight;

        this.labelRenderer.setSize(initialWidth, initialHeight);
        this.labelRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;display:none;';
        container.appendChild(this.labelRenderer.domElement);

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

        if (data.trajectoryPoints.length < 2) {
            console.warn('[VectorRender] Insufficient trajectory points to render.');
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

        const arrowLength = Math.max(magnitude * 0.15, 1.5);
        const headLength  = arrowLength * 0.25;
        const headWidth   = headLength  * 0.5;

        const arrow = new THREE.ArrowHelper(
            direction,
            new THREE.Vector3(0, 0, 0),
            arrowLength,
            ARROW_COLOR,
            headLength,
            headWidth
        );
        arrow.name = 'InitialVelocityArrow';

        if (arrow.line.geometry) this.track(arrow.line.geometry);
        if (arrow.cone.geometry) this.track(arrow.cone.geometry);
        if (arrow.line.material instanceof THREE.Material) this.track(arrow.line.material);
        if (arrow.cone.material instanceof THREE.Material) this.track(arrow.cone.material);

        this.group.add(arrow);

        // Flecha de punta del vector y proyecciones de velocidad inicial
        const tipPos = direction.clone().multiplyScalar(arrowLength);
        const groundPos = new THREE.Vector3(tipPos.x, 0, tipPos.z);
        const xPos = new THREE.Vector3(tipPos.x, 0, 0);
        const zPos = new THREE.Vector3(0, 0, tipPos.z);
        const yPos = new THREE.Vector3(0, tipPos.y, 0);

        this.addDashedLine([tipPos, groundPos], ARROW_COLOR);
        this.addDashedLine([groundPos, xPos], ARROW_COLOR);
        this.addDashedLine([groundPos, zPos], ARROW_COLOR);
        this.addDashedLine([tipPos, yPos], ARROW_COLOR);

        // Insignia del vector inicial
        this.addNeuBadge(
            `V₀ = ${magnitude.toFixed(1)} m/s (Vx: ${data.vx.toFixed(1)}, Vy: ${data.vy.toFixed(1)}, Vz: ${data.vz.toFixed(1)})`,
            new THREE.Vector3(tipPos.x, tipPos.y + 0.6, tipPos.z),
            ARROW_CSS_COLOR
        );
    }

    private drawTrajectoryLine(points: VectorMathResults['trajectoryPoints']): void {
        const geometry = new THREE.BufferGeometry();
        this.track(geometry);

        const threePoints = points.map(p => new THREE.Vector3(p.x, p.y, p.z));
        geometry.setFromPoints(threePoints);

        const material = new THREE.LineBasicMaterial({ color: TRAJECTORY_COLOR, linewidth: 3 });
        this.track(material);

        const line = new THREE.Line(geometry, material);
        line.name = 'TrajectoryLine';
        this.group.add(line);
    }

    /**
     * Dibuja las proyecciones geométricas exactas de Cúspide (Hmax) e Impacto (Rmax)
     * conectando de forma limpia los ejes X, Y y Z.
     */
    private drawProjectionsAndBadges(data: VectorMathResults): void {
        const points = data.trajectoryPoints;

        // 1. CÓMPUTO Y PROYECCIÓN DE CÚSPIDE (ALTURA MÁXIMA Hmax)
        let maxPoint = points[0];
        for (let i = 0; i < points.length; i++) {
            if (points[i].y > maxPoint.y) {
                maxPoint = points[i];
            }
        }

        const apexPos = new THREE.Vector3(maxPoint.x, maxPoint.y, maxPoint.z);
        const apexGround = new THREE.Vector3(maxPoint.x, 0, maxPoint.z);
        const apexYAxis = new THREE.Vector3(0, maxPoint.y, 0);

        // Líneas punteadas de cúspide
        this.addDashedLine([apexPos, apexGround], PEAK_COLOR);
        this.addDashedLine([apexPos, apexYAxis], PEAK_COLOR);

        // Insignia de Altura Máxima en la cúspide
        this.addNeuBadge(`Hmáx: ${data.maxHeight.toFixed(1)}m`, new THREE.Vector3(apexPos.x, apexPos.y + 0.7, apexPos.z), PEAK_CSS_COLOR);

        // Marca exacta sobre el eje Y
        this.addTickMark(apexYAxis, 'Y');
        this.addNeuBadge(`Y = ${data.maxHeight.toFixed(1)}m`, new THREE.Vector3(-0.8, apexYAxis.y, 0), Y_AXIS_CSS);


        // 2. CÓMPUTO Y PROYECCIÓN DE IMPACTO (ALCANCE Rmax Y COMPONENTES X/Z)
        const endPoint = points[points.length - 1];
        const landingPos = new THREE.Vector3(endPoint.x, endPoint.y, endPoint.z);

        // Proyección sobre el suelo hacia eje X y eje Z
        const landingXAxis = new THREE.Vector3(endPoint.x, 0, 0);
        const landingZAxis = new THREE.Vector3(0, 0, endPoint.z);

        this.addDashedLine([landingPos, landingXAxis], IMPACT_COLOR);
        this.addDashedLine([landingPos, landingZAxis], IMPACT_COLOR);

        // Insignia en el punto de impacto
        this.addNeuBadge(
            `Alcance: ${data.maxRange.toFixed(1)}m (${data.flightTime.toFixed(1)}s)`,
            new THREE.Vector3(landingPos.x, landingPos.y + 0.7, landingPos.z),
            IMPACT_CSS_COLOR
        );

        // Componente real de distancia en X (Vx * flightTime)
        const realComponentX = data.vx * data.flightTime;
        this.addTickMark(landingXAxis, 'X');
        this.addNeuBadge(`X = ${realComponentX.toFixed(1)}m`, new THREE.Vector3(landingXAxis.x, -0.6, 0), X_AXIS_CSS);

        // Componente real de distancia en Z (Vz * flightTime) si aplica
        if (Math.abs(data.vz) > 0.1) {
            const realComponentZ = data.vz * data.flightTime;
            this.addTickMark(landingZAxis, 'Z');
            this.addNeuBadge(`Z = ${realComponentZ.toFixed(1)}m`, new THREE.Vector3(0, -0.6, landingZAxis.z), Z_AXIS_CSS);
        }
    }

    private addDashedLine(points: THREE.Vector3[], colorHex: number): void {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        this.track(geometry);

        const material = new THREE.LineDashedMaterial({
            color: colorHex,
            dashSize: 0.35,
            gapSize: 0.2,
            linewidth: 2,
            transparent: true,
            opacity: 0.8
        });
        this.track(material);

        const line = new THREE.Line(geometry, material);
        line.computeLineDistances();
        this.group.add(line);
    }

    private addTickMark(pos: THREE.Vector3, axis: 'X' | 'Y' | 'Z'): void {
        let p1: THREE.Vector3, p2: THREE.Vector3;
        const s = 0.25;

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

        const matColor = axis === 'X' ? 0xff5252 : axis === 'Y' ? 0x4caf50 : 0x29b6f6;
        const mat = new THREE.LineBasicMaterial({ color: matColor, linewidth: 2 });
        this.track(mat);

        this.group.add(new THREE.Line(geom, mat));
    }

    /**
     * Crea una insignia flotante neumórfica limpia usando el Design System
     */
    private addNeuBadge(text: string, position: THREE.Vector3, accentColor: string): void {
        const div = document.createElement('div');
        div.textContent = text;
        div.style.cssText = `
            color: var(--text-primary, #ffffff);
            font-family: "Outfit", "Inter", sans-serif;
            font-size: 11px;
            font-weight: 700;
            background: var(--card-bg, rgba(13, 17, 26, 0.9));
            padding: 5px 12px;
            border-radius: 14px;
            border: 1px solid ${accentColor};
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            white-space: nowrap;
            user-select: none;
            transition: all 0.3s ease;
        `;

        const cssObject = new CSS2DObject(div);
        cssObject.position.copy(position);
        this.group.add(cssObject);
    }

    private frameCamera(points: VectorMathResults['trajectoryPoints']): void {
        const box = new THREE.Box3();
        for (const p of points) {
            box.expandByPoint(new THREE.Vector3(p.x, p.y, p.z));
        }

        const sphere = new THREE.Sphere();
        box.getBoundingSphere(sphere);

        const { center, radius } = sphere;
        const effectiveRadius = Math.max(radius, CAMERA_MIN_DISTANCE * 0.5);

        const vFovRadians  = THREE.MathUtils.degToRad(this.camera.fov / 2);
        const pullBack     = (effectiveRadius / Math.tan(vFovRadians)) * (1 + CAMERA_PADDING_FACTOR);
        const clampedPullBack = Math.max(pullBack, CAMERA_MIN_DISTANCE);

        const offset = new THREE.Vector3(1.1, 1.2, 1.3).normalize().multiplyScalar(clampedPullBack);
        this.camera.position.copy(center).add(offset);
        this.camera.lookAt(center);

        this.camera.near = Math.max(clampedPullBack * 0.01, 0.1);
        this.camera.far  = clampedPullBack * 5;
        this.camera.updateProjectionMatrix();
    }

    private startAnimationLoop = () => {
        if (this.group.visible) {
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

    private track(resource: Disposable): void {
        this.disposables.push(resource);
    }

    private clearScene(): void {
        this.group.children.forEach(child => {
            if (child instanceof CSS2DObject) {
                if (child.element && child.element.parentNode) {
                    child.element.parentNode.removeChild(child.element);
                }
            }
        });

        while (this.group.children.length > 0) {
            this.group.remove(this.group.children[0]);
        }

        for (const resource of this.disposables) {
            resource.dispose();
        }

        this.disposables.length = 0;
    }
}


