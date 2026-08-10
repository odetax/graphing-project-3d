import * as THREE from 'three';
    
const SPLASH_DURATION_MS = 3200;

/* Inicializa y anima la pantalla de bienvenida (globo wireframe girando). */
export function initSplashScreen(): void {
    const splash       = document.getElementById('splash-overlay');
    const splashCanvas = document.getElementById('splash-globe') as HTMLCanvasElement | null;
    
    if (!splash || !splashCanvas) return;

    const sScene  = new THREE.Scene();
    const sCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
    sCamera.position.set(0, 0.3, 3.8);
    sCamera.lookAt(0, 0, 0);

    const sRenderer = new THREE.WebGLRenderer({ canvas: splashCanvas, antialias: true, alpha: true });
    sRenderer.setSize(window.innerWidth, window.innerHeight);
    sRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    sRenderer.setClearColor(0x000000, 0);

    // Estrellas de fondo
    const starCount = 400;
    const starPos   = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        const r  = 30 + Math.random() * 30;
        starPos[i * 3]     = r * Math.sin(ph) * Math.cos(th);
        starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
        starPos[i * 3 + 2] = r * Math.cos(ph);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.6 });
    sScene.add(new THREE.Points(starGeo, starMat));

    const globeGroup = new THREE.Group();
    globeGroup.rotation.z = THREE.MathUtils.degToRad(23.5);
    sScene.add(globeGroup);

    const GLOBE_RADIUS = 1.0;
    const SEGMENTS     = 72;
    const lineMat      = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });

    // Esfera sólida
    const solidGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 0.995, 48, 48);
    const solidMat = new THREE.MeshBasicMaterial({ color: 0x06090f });
    globeGroup.add(new THREE.Mesh(solidGeo, solidMat));

    // Paralelos cada 15°
    for (let lat = -75; lat <= 75; lat += 15) {
        const phi = THREE.MathUtils.degToRad(lat);
        const rr  = GLOBE_RADIUS * Math.cos(phi);
        const y   = GLOBE_RADIUS * Math.sin(phi);
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= SEGMENTS; i++) {
            const th = (i / SEGMENTS) * Math.PI * 2;
            pts.push(new THREE.Vector3(rr * Math.cos(th), y, -rr * Math.sin(th)));
        }
        globeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }

    // Meridianos cada 15°
    for (let lng = 0; lng < 360; lng += 15) {
        const th = THREE.MathUtils.degToRad(lng);
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= SEGMENTS; i++) {
            const phi = -Math.PI / 2 + (i / SEGMENTS) * Math.PI;
            pts.push(new THREE.Vector3(
                GLOBE_RADIUS * Math.cos(phi) * Math.cos(th),
                GLOBE_RADIUS * Math.sin(phi),
                -GLOBE_RADIUS * Math.cos(phi) * Math.sin(th)
            ));
        }
        globeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }

    const brightMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });

    // Ecuador
    const eqPts: THREE.Vector3[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
        const th = (i / SEGMENTS) * Math.PI * 2;
        eqPts.push(new THREE.Vector3(GLOBE_RADIUS * Math.cos(th), 0, -GLOBE_RADIUS * Math.sin(th)));
    }
    globeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(eqPts), brightMat));

    // Meridiano 0
    const m0Pts: THREE.Vector3[] = [];
    for (let i = 0; i <= SEGMENTS; i++) {
        const phi = -Math.PI / 2 + (i / SEGMENTS) * Math.PI;
        m0Pts.push(new THREE.Vector3(GLOBE_RADIUS * Math.cos(phi), GLOBE_RADIUS * Math.sin(phi), 0));
    }
    globeGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(m0Pts), brightMat));

    // Animacion
    let splashAnimId: number;

    const animateSplash = () => {
        globeGroup.rotation.y += 0.006;
        sRenderer.render(sScene, sCamera);
        splashAnimId = requestAnimationFrame(animateSplash);
    };
    animateSplash();

    const handleSplashResize = () => {
        const w = window.innerWidth, h = window.innerHeight;
        sCamera.aspect = w / h;
        sCamera.updateProjectionMatrix();
        sRenderer.setSize(w, h);
    };
    window.addEventListener('resize', handleSplashResize);

    // Fade-out y cleanup
    setTimeout(() => {
        splash.classList.add('fade-out');

        const cleanup = () => {
            cancelAnimationFrame(splashAnimId);
            window.removeEventListener('resize', handleSplashResize);
            lineMat.dispose();
            brightMat.dispose();
            solidGeo.dispose();
            solidMat.dispose();
            starGeo.dispose();
            starMat.dispose();
            sRenderer.dispose();
            splash.remove();
        };

        splash.addEventListener('transitionend', cleanup, { once: true });
        setTimeout(() => { if (splash.parentNode) cleanup(); }, 1000);
    }, SPLASH_DURATION_MS);
}