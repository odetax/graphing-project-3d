import * as THREE from 'three';
import './style.css';
import { SceneManager } from './core/scene-manager';
import { UIManager } from './core/ui-manager';
import { initSplashScreen } from './core/splash-screen';
import { fetchElevation, reverseGeocode } from './gps/gps-api';
import { calculateProjectile } from './vectors/vector-math';
import { VectorRender } from './vectors/vector-render';
import { GPSRender } from './gps/gps-render';
import { latLngAltToXYZ } from './gps/gps-math';
import type { AppMode } from './interfaces';

document.addEventListener('DOMContentLoaded', () => {
    initSplashScreen();

    const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;

    const sceneManager = new SceneManager(canvas);
    const uiManager    = new UIManager();

    const scene    = sceneManager.getScene();
    const camera   = sceneManager.getCamera();
    const controls = sceneManager.getControls();

    const vectorRenderModule = new VectorRender(scene, camera, controls, sceneManager);
    const gpsRenderModule    = new GPSRender(scene, camera, controls);

    let currentMode: AppMode | 'HOME' = 'HOME';

    /**
     * Último nombre de lugar obtenido por reverseGeocode.
     * Se usa para pasarlo a plotLocation cuando el usuario confirma.
     */
    let lastResolvedPlaceName = '';

    console.log('[Team 1] Core App Initialized.', sceneManager);

    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();

    /**
     * Extrae lat/lng del punto de intersección con el globo visual.
     */
    const pointToLatLng = (point: THREE.Vector3): { lat: number; lng: number } => {
        const r = 6.371;
        let lat = Math.asin(Math.min(Math.max(point.y / r, -1), 1)) * (180 / Math.PI);
        const lng = Math.atan2(-point.z, point.x) * (180 / Math.PI);
        if (lat > 90)  lat = 90;
        if (lat < -90) lat = -90;
        return { lat, lng };
    };

    const handleRaycast = (event: MouseEvent, action: 'hover' | 'click') => {
        if (currentMode !== 'GPS') return;

        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        mouse.x =  ((event.clientX - rect.left) / rect.width)  * 2 - 1;
        mouse.y = -((event.clientY - rect.top)  / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const gpsGroup = scene.children.find(c => c.name === 'GPSRenderGroup');
        if (!gpsGroup || !gpsGroup.visible) return;

        const intersects = raycaster.intersectObjects(gpsGroup.children, true);
        const hit = intersects.find(
            i => i.object.type === 'Mesh'
                && i.object.name !== 'PulsingRing'
                && i.object.name !== 'PreviewSphere'
                && i.object.name !== 'PreviewRing'
        );

        if (hit) {
            const { lat, lng } = pointToLatLng(hit.point);

            if (action === 'hover') {
                uiManager.updateStatusBar(lat, lng);
            } else {
                // Colocar preview pin + llenar inputs
                uiManager.setGpsInputs(lat, lng);

                // Colocar pin inmediatamente (sin nombre aún)
                gpsRenderModule.placePreviewPin(lat, lng, '');
                lastResolvedPlaceName = '';

                // Buscar nombre del lugar de forma asíncrona
                reverseGeocode(lat, lng).then(result => {
                    if (result.found) {
                        lastResolvedPlaceName = result.shortName;
                        // Actualizar el label del preview pin con el nombre
                        gpsRenderModule.updatePreviewLabel(lat, lng, result.shortName);
                    }
                });
            }
        } else {
            if (action === 'hover') uiManager.hideStatusBar();
        }
    };

    window.addEventListener('mousemove', e => handleRaycast(e, 'hover'));

    // Si el mouse se movió más de DRAG_THRESHOLD px entre down y up,
    // fue una rotación de OrbitControls, no un click intencional.
    const DRAG_THRESHOLD = 5;
    let mouseDownPos = { x: 0, y: 0 };

    window.addEventListener('mousedown', e => {
        mouseDownPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', e => {
        const dx = Math.abs(e.clientX - mouseDownPos.x);
        const dy = Math.abs(e.clientY - mouseDownPos.y);

        // Si se movió mucho, fue drag → ignorar
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) return;

        const t = e.target as HTMLElement;
        if (t.closest('#ui-panel') || t.closest('.app-header') || t.closest('.modal-overlay')) return;
        handleRaycast(e, 'click');
    });

    //  VECTOR SUBMIT
    uiManager.onVectorSubmit = (inputs) => {
        try {
            const results = calculateProjectile(inputs);
            vectorRenderModule.plotTrajectory(results);
        } catch (error) {
            console.error('[Team 1] Vector error:', error);
            uiManager.showError('Error interno al calcular el vector.');
        }
    };

    //  GPS SUBMIT
    uiManager.onGpsSubmit = async (inputs) => {
        try {
            uiManager.showLoading();

            // Lanzar ambas peticiones en paralelo para no esperar secuencialmente
            const [altitude, geoResult] = await Promise.all([
                fetchElevation(inputs.latitude, inputs.longitude),
                // Si ya tenemos el nombre (del click previo), no volver a buscar
                lastResolvedPlaceName
                    ? Promise.resolve({ shortName: lastResolvedPlaceName, found: true, displayName: '', country: '' })
                    : reverseGeocode(inputs.latitude, inputs.longitude),
            ]);

            const mathResults = latLngAltToXYZ(inputs.latitude, inputs.longitude, altitude);

            const placeName = geoResult.found ? geoResult.shortName : '';
            gpsRenderModule.plotLocation(mathResults, placeName);

            // Reset para la siguiente búsqueda
            lastResolvedPlaceName = '';
        } catch (error) {
            console.error('[Team 1] GPS error:', error);
            uiManager.showError('Error inesperado en la consulta GPS.');
        } finally {
            uiManager.hideLoading();
        }
    };

    //  CAMBIO DE MODO
    uiManager.onModeChange = (mode) => {
        currentMode = mode;
        lastResolvedPlaceName = '';

        if (mode === 'VECTORS') {
            gpsRenderModule.deactivate();
            vectorRenderModule.activate();
            sceneManager.setAxesVisible(true);
            sceneManager.applyZoomLimits('VECTORS');
        } else {
            vectorRenderModule.deactivate();
            gpsRenderModule.activate();
            sceneManager.setAxesVisible(false);
            sceneManager.applyZoomLimits('GPS');
        }
    };

    uiManager.onHome = () => {
        currentMode = 'HOME';
        lastResolvedPlaceName = '';
        vectorRenderModule.deactivate();
        gpsRenderModule.deactivate();
        sceneManager.setAxesVisible(false);
    };

    uiManager.onModeChange('VECTORS');
});