import * as THREE from 'three';
import './style.css';
import { SceneManager } from './core/scene-manager';
import { UIManager } from './core/ui-manager';
import { fetchElevation } from './gps/gps-api';
import { calculateProjectile } from './vectors/vector-math';
import { VectorRender } from './vectors/vector-render';
import { GPSRender } from './gps/gps-render';
import { latLngAltToXYZ } from './gps/gps-math';
import type { AppMode } from './interfaces';

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement;
    
    // Initialize Core Modules (Team 1)
    const sceneManager = new SceneManager(canvas);
    const uiManager = new UIManager();

    const scene = sceneManager.getScene();
    const camera = sceneManager.getCamera();

    // Initialize Render Modules (Team 3 & Team 5)
    const vectorRenderModule = new VectorRender(scene, camera);
    const gpsRenderModule = new GPSRender(scene, camera, sceneManager.getControls());

    let currentMode: AppMode | 'HOME' = 'HOME';

    console.log('[Team 1] Core App Initialized. Scene and UI are ready.', sceneManager);

    // --- Raycasting for GPS Mode ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleRaycast = (event: MouseEvent, action: 'hover' | 'click') => {
        if (currentMode !== 'GPS') return;

        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const gpsGroup = scene.children.find(child => child.name === 'GPSRenderGroup');
        if (!gpsGroup || !gpsGroup.visible) return;

        const intersects = raycaster.intersectObjects(gpsGroup.children, true);
        const validIntersect = intersects.find(i => i.object.type === 'Mesh' && i.object.name !== 'PulsingRing');

        if (validIntersect) {
            const point = validIntersect.point;
            const radius = 6.371; // Earth visual radius

            // Reverse math from Cartesian to Lat/Lng
            let lat = Math.asin(point.y / radius) * (180 / Math.PI);
            let lng = Math.atan2(-point.z, point.x) * (180 / Math.PI);

            // Clamp just in case due to float precision
            if (lat > 90) lat = 90;
            if (lat < -90) lat = -90;

            if (action === 'hover') {
                uiManager.updateStatusBar(lat, lng);
            } else if (action === 'click') {
                uiManager.setGpsInputs(lat, lng);
            }
        } else {
            if (action === 'hover') {
                uiManager.hideStatusBar();
            }
        }
    };

    window.addEventListener('mousemove', (e) => handleRaycast(e, 'hover'));
    window.addEventListener('click', (e) => {
        // Ignore clicks on UI cards or header controls
        const target = e.target as HTMLElement;
        if (target.closest('#ui-panel') || target.closest('.app-header') || target.closest('.modal-overlay')) return;
        handleRaycast(e, 'click');
    });

    // --- Vector Mode Integration ---
    uiManager.onVectorSubmit = (inputs) => {
        try {
            console.log('[Team 1] Vector form submitted:', inputs);
            
            // Math call (Team 2)
            const results = calculateProjectile(inputs);
            console.log('[Team 1] Math results (Team 2):', results);
            
            // Plot results (Team 3)
            vectorRenderModule.plotTrajectory(results);
            
        } catch (error) {
            console.error('[Team 1] Error in Vector calculation:', error);
            uiManager.showError('Error interno al calcular el vector.');
        }
    };

    // --- GPS Mode Integration ---
    uiManager.onGpsSubmit = async (inputs) => {
        try {
            console.log('[Team 1] GPS form submitted:', inputs);
            
            // Show loading state BEFORE network call (Team 1 Tip)
            uiManager.showLoading();
            
            // Network call (Team 4). Awaits resolution.
            const altitude = await fetchElevation(inputs.latitude, inputs.longitude);
            console.log('[Team 1] Altitude fetched (Team 4):', altitude);
            
            // Math call (Team 4) - Convert to cartesian
            const mathResults = latLngAltToXYZ(inputs.latitude, inputs.longitude, altitude);
            
            // Render call (Team 5)
            gpsRenderModule.plotLocation(mathResults);
            
        } catch (error) {
            console.error('[Team 1] Unhandled error in GPS flow:', error);
            uiManager.showError('Error inesperado en la consulta GPS.');
        } finally {
            // Hide loading state AFTER network call (Team 1 Tip)
            uiManager.hideLoading();
        }
    };

    // --- Mode Switching Logic ---
    uiManager.onModeChange = (mode) => {
        currentMode = mode;
        console.log(`[Team 1] Switched to mode: ${mode}`);
        if (mode === 'VECTORS') {
            gpsRenderModule.deactivate();
            vectorRenderModule.activate();
            sceneManager.setAxesVisible(true);
        } else {
            vectorRenderModule.deactivate();
            gpsRenderModule.activate();
            sceneManager.setAxesVisible(false);
        }
    };

    uiManager.onHome = () => {
        currentMode = 'HOME';
        console.log(`[Team 1] Returning to Home Screen`);
        vectorRenderModule.deactivate();
        gpsRenderModule.deactivate();
        sceneManager.setAxesVisible(false);
    };

    // Trigger initial mode activation
    uiManager.onModeChange('VECTORS');
});
