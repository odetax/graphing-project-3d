import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class SceneManager {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private axesHelper: THREE.AxesHelper;
    private canvasContainer: HTMLElement;

    constructor(canvas: HTMLCanvasElement) {
        this.scene = new THREE.Scene();
        this.scene.background = null;

        this.canvasContainer = canvas.parentElement || document.body;
        const initialWidth = this.canvasContainer.clientWidth || window.innerWidth;
        const initialHeight = this.canvasContainer.clientHeight || window.innerHeight;

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            45,
            initialWidth / initialHeight,
            0.1,
            20000000 // Large view distance for the globe
        );
        // Initial position
        this.camera.position.set(200, 150, 200);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.setSize(initialWidth, initialHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.85);
        directionalLight.position.set(5, 10, 7).normalize();
        this.scene.add(directionalLight);

        // Axes Helper for orientation
        this.axesHelper = new THREE.AxesHelper(100);
        this.scene.add(this.axesHelper);

        // Resize observer for container-relative sizing
        const resizeObserver = new ResizeObserver(() => {
            this.onResize();
        });
        resizeObserver.observe(this.canvasContainer);

        window.addEventListener('resize', this.onResize.bind(this));

        // Start loop
        this.animate();
    }

    private onResize() {
        const width = this.canvasContainer.clientWidth;
        const height = this.canvasContainer.clientHeight;
        if (width === 0 || height === 0) return;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    private animate() {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    public getScene(): THREE.Scene {
        return this.scene;
    }

    public getCamera(): THREE.PerspectiveCamera {
        return this.camera;
    }

    public getControls(): OrbitControls {
        return this.controls;
    }

    public setAxesVisible(visible: boolean) {
        this.axesHelper.visible = visible;
    }
}
