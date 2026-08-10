import type { AppMode, AppState, VectorInputs, GPSInputs } from '../interfaces';

export class UIManager {
    private state: AppState = {
        currentMode: 'VECTORS',
        loading: false,
        error: null
    };

    private currentTheme: 'light' | 'dark' = 'light';

    private btnModeVectors: HTMLButtonElement;
    private btnModeGps: HTMLButtonElement;
    private formVectors: HTMLFormElement;
    private formGps: HTMLFormElement;
    private loadingOverlay: HTMLElement;
    private notificationDiv: HTMLElement;
    private btnSubmitGps: HTMLButtonElement;

    private viewportTitle: HTMLElement;
    private viewportSubtitle: HTMLElement;
    private statusBar: HTMLElement;

    // Header buttons
    private btnThemeToggle: HTMLButtonElement;

    // Modal elements
    private btnInfo: HTMLButtonElement;
    private infoModal: HTMLElement;
    private btnCloseModal: HTMLButtonElement;
    private modalBody: HTMLElement;

    private btnCredits: HTMLButtonElement;
    private creditsModal: HTMLElement;
    private btnCloseCredits: HTMLButtonElement;

    public onVectorSubmit?: (inputs: VectorInputs) => void;
    public onGpsSubmit?: (inputs: GPSInputs) => void;
    public onModeChange?: (mode: AppMode) => void;
    public onHome?: () => void;

    constructor() {
        this.btnModeVectors = document.getElementById('btn-mode-vectors') as HTMLButtonElement;
        this.btnModeGps = document.getElementById('btn-mode-gps') as HTMLButtonElement;
        this.formVectors = document.getElementById('form-vectors') as HTMLFormElement;
        this.formGps = document.getElementById('form-gps') as HTMLFormElement;
        this.loadingOverlay = document.getElementById('loading-overlay') as HTMLElement;
        this.notificationDiv = document.getElementById('notification') as HTMLElement;
        this.btnSubmitGps = document.getElementById('btn-submit-gps') as HTMLButtonElement;

        this.viewportTitle = document.getElementById('viewport-title') as HTMLElement;
        this.viewportSubtitle = document.getElementById('viewport-subtitle') as HTMLElement;
        this.statusBar = document.getElementById('status-bar') as HTMLElement;

        // Theme Toggle elements
        this.btnThemeToggle = document.getElementById('btn-theme-toggle') as HTMLButtonElement;

        this.btnInfo = document.getElementById('btn-info') as HTMLButtonElement;
        this.infoModal = document.getElementById('info-modal') as HTMLElement;
        this.btnCloseModal = document.getElementById('btn-close-modal') as HTMLButtonElement;
        this.modalBody = document.getElementById('modal-body') as HTMLElement;

        this.btnCredits = document.getElementById('btn-credits') as HTMLButtonElement;
        this.creditsModal = document.getElementById('credits-modal') as HTMLElement;
        this.btnCloseCredits = document.getElementById('btn-close-credits') as HTMLButtonElement;

        this.initTheme();
        this.initEventListeners();
    }

    private initTheme() {
        const savedTheme = (localStorage.getItem('neu-theme') as 'light' | 'dark') || 'light';
        this.setTheme(savedTheme);
    }

    private setTheme(theme: 'light' | 'dark') {
        this.currentTheme = theme;
        localStorage.setItem('neu-theme', theme);

        const sunIcons = document.querySelectorAll('.theme-icon-sun');
        const moonIcons = document.querySelectorAll('.theme-icon-moon');

        if (theme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            sunIcons.forEach(el => el.classList.remove('hidden'));
            moonIcons.forEach(el => el.classList.add('hidden'));
        } else {
            document.body.removeAttribute('data-theme');
            sunIcons.forEach(el => el.classList.add('hidden'));
            moonIcons.forEach(el => el.classList.remove('hidden'));
        }
    }

    private toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    private initEventListeners() {
        if (this.btnThemeToggle) {
            this.btnThemeToggle.addEventListener('click', () => this.toggleTheme());
        }

        const btnThemeToggleMobile = document.getElementById('btn-theme-toggle-mobile');
        if (btnThemeToggleMobile) {
            btnThemeToggleMobile.addEventListener('click', () => this.toggleTheme());
        }

        this.btnModeVectors.addEventListener('click', () => this.setMode('VECTORS'));
        this.btnModeGps.addEventListener('click', () => this.setMode('GPS'));

        this.formVectors.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleVectorSubmit();
        });

        this.formGps.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleGpsSubmit();
        });

        // Modal listeners
        if (this.btnInfo) this.btnInfo.addEventListener('click', () => this.showInfoModal());
        this.btnCloseModal.addEventListener('click', () => this.hideInfoModal());
        this.infoModal.addEventListener('click', (e) => {
            if (e.target === this.infoModal) {
                this.hideInfoModal();
            }
        });

        // Credits listeners
        if (this.btnCredits) this.btnCredits.addEventListener('click', () => this.showCreditsModal());
        this.btnCloseCredits.addEventListener('click', () => this.hideCreditsModal());
        this.creditsModal.addEventListener('click', (e) => {
            if (e.target === this.creditsModal) {
                this.hideCreditsModal();
            }
        });

        // Mobile dropdown menu listeners
        const btnMobileMenu = document.getElementById('btn-mobile-menu');
        const mobileDropdown = document.getElementById('mobile-dropdown-menu');
        const btnInfoMobile = document.getElementById('btn-info-mobile');
        const btnCreditsMobile = document.getElementById('btn-credits-mobile');

        if (btnMobileMenu && mobileDropdown) {
            btnMobileMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                mobileDropdown.classList.toggle('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!mobileDropdown.contains(e.target as Node) && !btnMobileMenu.contains(e.target as Node)) {
                    mobileDropdown.classList.add('hidden');
                }
            });
        }

        if (btnInfoMobile) {
            btnInfoMobile.addEventListener('click', () => {
                if (mobileDropdown) mobileDropdown.classList.add('hidden');
                this.showInfoModal();
            });
        }

        if (btnCreditsMobile) {
            btnCreditsMobile.addEventListener('click', () => {
                if (mobileDropdown) mobileDropdown.classList.add('hidden');
                this.showCreditsModal();
            });
        }
    }

    private setMode(mode: AppMode) {
        this.state.currentMode = mode;

        if (mode === 'VECTORS') {
            this.btnModeVectors.classList.add('active');
            this.btnModeGps.classList.remove('active');
            this.formVectors.classList.remove('hidden');
            this.formGps.classList.add('hidden');

            if (this.viewportTitle) this.viewportTitle.textContent = 'Vista de trayectoria';
            if (this.viewportSubtitle) this.viewportSubtitle.textContent = 'Visualización 3D del proyectil con datos de magnitud y ángulo.';
        } else {
            this.btnModeGps.classList.add('active');
            this.btnModeVectors.classList.remove('active');
            this.formGps.classList.remove('hidden');
            this.formVectors.classList.add('hidden');

            if (this.viewportTitle) this.viewportTitle.textContent = 'Vista de satélite';
            if (this.viewportSubtitle) this.viewportSubtitle.textContent = 'Visualización orbital con datos de latitud y longitud.';
        }

        if (this.onModeChange) {
            this.onModeChange(mode);
        }

        this.hideStatusBar();
    }

    private handleVectorSubmit() {
        const magInput = document.getElementById('vec-magnitude') as HTMLInputElement;
        const eleInput = document.getElementById('vec-elevation') as HTMLInputElement;
        const aziInput = document.getElementById('vec-azimuth') as HTMLInputElement;

        const magnitude = parseFloat(magInput.value);
        const elevationAngle = parseFloat(eleInput.value);
        const azimuthAngle = parseFloat(aziInput.value);

        if (isNaN(magnitude) || isNaN(elevationAngle) || isNaN(azimuthAngle)) {
            return;
        }

        let hasError = false;

        if (magnitude <= 0) {
            this.highlightInputError('vec-magnitude', 'La magnitud debe ser mayor a 0.');
            hasError = true;
        }

        if (elevationAngle < 0 || elevationAngle > 90) {
            this.highlightInputError('vec-elevation', 'El ángulo de elevación debe estar entre 0° y 90°.');
            hasError = true;
        }

        if (azimuthAngle < 0 || azimuthAngle > 360) {
            this.highlightInputError('vec-azimuth', 'El ángulo de azimut debe estar entre 0° y 360°.');
            hasError = true;
        }

        if (hasError) return;

        if (this.onVectorSubmit) {
            this.onVectorSubmit({ magnitude, elevationAngle, azimuthAngle });
        }
    }

    private handleGpsSubmit() {
        const latInput = document.getElementById('gps-lat') as HTMLInputElement;
        const lngInput = document.getElementById('gps-lng') as HTMLInputElement;

        // Si el input está vacío, usar el placeholder como valor por defecto
        const rawLat = latInput.value.trim() || latInput.placeholder;
        const rawLng = lngInput.value.trim() || lngInput.placeholder;

        const latitude = parseFloat(rawLat);
        const longitude = parseFloat(rawLng);

        if (isNaN(latitude) || isNaN(longitude)) {
            this.showError('Coordenadas inválidas. Verifica los valores ingresados.');
            return;
        }

        let hasError = false;

        if (latitude < -90 || latitude > 90) {
            this.highlightInputError('gps-lat', 'La latitud debe estar entre -90 y 90 grados.');
            hasError = true;
        }

        if (longitude < -180 || longitude > 180) {
            this.highlightInputError('gps-lng', 'La longitud debe estar entre -180 y 180 grados.');
            hasError = true;
        }

        if (hasError) return;

        if (this.onGpsSubmit) {
            this.onGpsSubmit({ latitude, longitude });
        }
    }

    public showLoading() {
        this.state.loading = true;
        this.loadingOverlay.classList.add('visible');
        this.btnSubmitGps.disabled = true;
    }

    public hideLoading() {
        this.state.loading = false;
        this.loadingOverlay.classList.remove('visible');
        this.btnSubmitGps.disabled = false;
    }

    public showError(message: string) {
        this.notificationDiv.textContent = message;
        this.notificationDiv.classList.add('show');
        setTimeout(() => {
            this.notificationDiv.classList.remove('show');
        }, 4000);
    }

    public updateStatusBar(lat: number, lng: number) {
        const formattedLat = lat.toFixed(4);
        const formattedLng = lng.toFixed(4);
        this.statusBar.textContent = `Latitud: ${formattedLat}°, Longitud: ${formattedLng}°`;
        this.showStatusBar();
    }

    public showStatusBar() {
        if (this.state.currentMode === 'GPS') {
            this.statusBar.classList.remove('hidden');
        }
    }

    public hideStatusBar() {
        this.statusBar.classList.add('hidden');
    }

    public setGpsInputs(lat: number, lng: number) {
        const latInput = document.getElementById('gps-lat') as HTMLInputElement;
        const lngInput = document.getElementById('gps-lng') as HTMLInputElement;
        if (latInput) latInput.value = lat.toFixed(4);
        if (lngInput) lngInput.value = lng.toFixed(4);
    }

    private highlightInputError(inputId: string, message: string) {
        const input = document.getElementById(inputId) as HTMLInputElement;
        if (!input) return;

        const fieldContainer = input.closest('.input-field') || input.parentElement;
        if (fieldContainer) {
            fieldContainer.classList.add('input-error');
        }

        const small = fieldContainer ? fieldContainer.querySelector('small') : null;
        if (small) {
            if (!small.hasAttribute('data-original')) {
                small.setAttribute('data-original', small.textContent || '');
            }
            small.textContent = message;
            small.classList.add('error-text');
        }

        const onInput = () => {
            if (fieldContainer) {
                fieldContainer.classList.remove('input-error');
            }
            if (small) {
                small.textContent = small.getAttribute('data-original') || '';
                small.classList.remove('error-text');
            }
            input.removeEventListener('input', onInput);
        };
        input.addEventListener('input', onInput);
    }

    private showInfoModal() {
        if (this.state.currentMode === 'VECTORS') {
            this.modalBody.innerHTML = `
                <p><strong>Modo Vectores 3D</strong></p>
                <p style="margin-top: 8px;">Este módulo te permite visualizar la trayectoria parabólica de un proyectil en un espacio tridimensional neumórfico. Define tres parámetros fundamentales:</p>
                <ul>
                    <li><strong>Magnitud (Velocidad Inicial):</strong> Fuerza o rapidez con la que se lanza el proyectil en m/s.</li>
                    <li><strong>Ángulo de Elevación:</strong> Inclinación vertical del lanzamiento entre <strong>0° y 90°</strong> (θ).</li>
                    <li><strong>Ángulo de Azimut:</strong> Rotación horizontal en grados respecto al eje X.</li>
                </ul>
                <p><em>Haz clic en "Graficar Trayectoria" para calcular y renderizar la curva 3D.</em></p>
            `;
        } else {
            this.modalBody.innerHTML = `
                <p><strong>Modo GPS Satélite 3D</strong></p>
                <p style="margin-top: 8px;">Explora el globo terrestre interactivo y determina la ubicación satelital con elevación en tiempo real.</p>
                <ul>
                    <li><strong>Rotación & Zoom:</strong> Arrastra con el clic izquierdo para rotar la Tierra y usa la rueda para hacer zoom.</li>
                    <li><strong>Coordenadas en Vivo:</strong> Pasa el cursor sobre el globo para ver latitud y longitud en la insignia inferior.</li>
                    <li><strong>Selección Directa:</strong> Haz clic en cualquier lugar del mapa para autocompletar las coordenadas en el formulario.</li>
                </ul>
                <p><em>Presiona "Ubicar Satélite" para consultar la altitud real y situar el marcador.</em></p>
            `;
        }
        this.infoModal.classList.remove('hidden');
    }

    private hideInfoModal() {
        this.infoModal.classList.add('hidden');
    }

    private showCreditsModal() {
        this.creditsModal.classList.remove('hidden');
    }

    private hideCreditsModal() {
        this.creditsModal.classList.add('hidden');
    }
}
