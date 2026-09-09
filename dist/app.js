/**
 * ====================================================================
 * TYPY A ROZHRANÍ
 * ====================================================================
 */
export var CourseType;
(function (CourseType) {
    CourseType["PREDNASKA"] = "P\u0159edn\u00E1\u0161ka";
    CourseType["CVICENI"] = "Cvi\u010Den\u00ED";
    CourseType["SEMINAR"] = "Semin\u00E1\u0159";
})(CourseType || (CourseType = {}));
/**
 * ====================================================================
 * 1. DOMÉNOVÝ MODEL (OOP)
 * ====================================================================
 */
export class ScheduleEvent {
    id;
    katedra;
    predmet;
    typAkce;
    den;
    hodinaOd;
    hodinaDo;
    mistnost;
    ucitel;
    isSelected;
    laneIndex = 0;
    constructor(params) {
        this.id = params.id || Math.random().toString(36).substring(2, 9);
        this.katedra = params.katedra;
        this.predmet = params.predmet;
        this.typAkce = params.typAkce;
        this.den = params.den;
        this.hodinaOd = Number(params.hodinaOd);
        this.hodinaDo = Number(params.hodinaDo);
        this.mistnost = params.mistnost || '';
        this.ucitel = params.ucitel || '';
        this.isSelected = params.isSelected ?? true;
    }
    get fullSubjectCode() {
        return `${this.katedra}/${this.predmet}`;
    }
    get duration() {
        return (this.hodinaDo - this.hodinaOd) + 1;
    }
    /**
     * Zjistí, zda je akce v časovém konfliktu s jinou akcí
     */
    overlaps(other) {
        if (this.den !== other.den)
            return false;
        return Math.max(this.hodinaOd, other.hodinaOd) <= Math.min(this.hodinaDo, other.hodinaDo);
    }
}
/**
 * ====================================================================
 * 2. SPRÁVCE BAREV PŘEDMĚTŮ (SubjectColorPalette)
 * ====================================================================
 */
export class SubjectColorPalette {
    presetColors = {
        'KTVS/BVZZS': { bg: '#3a7e85', darkText: false },
        'KIKM/ZMI1': { bg: '#5c2228', darkText: false },
        'KIKM/UPROM': { bg: '#535b2e', darkText: false },
        'KIT/UOMO': { bg: '#fff293', darkText: true },
        'KIT/TPW1A': { bg: '#ffb2b8', darkText: true },
        'KIT/SYSP': { bg: '#bce8f1', darkText: true },
        'KIT/PRIPO': { bg: '#c7e8cf', darkText: true },
        'KKNS/BZTKK': { bg: '#714e2a', darkText: false }
    };
    assignedColors = new Map();
    getColor(subjectCode) {
        if (this.presetColors[subjectCode]) {
            return this.presetColors[subjectCode];
        }
        if (!this.assignedColors.has(subjectCode)) {
            let hash = 0;
            for (let i = 0; i < subjectCode.length; i++) {
                hash = subjectCode.charCodeAt(i) + ((hash << 5) - hash);
            }
            const hue = Math.abs(hash % 360);
            const lightness = 45 + (Math.abs(hash) % 25);
            this.assignedColors.set(subjectCode, {
                bg: `hsl(${hue}, 55%, ${lightness}%)`,
                darkText: lightness > 60
            });
        }
        return this.assignedColors.get(subjectCode);
    }
}
/**
 * ====================================================================
 * 3. ENGINE PRO ROZVRŽENÍ KOLIZÍ (Lanes)
 * ====================================================================
 */
export class ScheduleLayoutEngine {
    /**
     * Rozdělí akce v daném dni do nezávislých pater (lanes) pro zamezení překryvů
     */
    static computeLanesForDay(events) {
        const sorted = [...events].sort((a, b) => a.hodinaOd - b.hodinaOd || b.duration - a.duration);
        const lanes = [];
        for (const event of sorted) {
            let placed = false;
            for (let i = 0; i < lanes.length; i++) {
                const hasCollision = lanes[i].some(existing => existing.overlaps(event));
                if (!hasCollision) {
                    lanes[i].push(event);
                    event.laneIndex = i;
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                event.laneIndex = lanes.length;
                lanes.push([event]);
            }
        }
        return {
            lanesCount: Math.max(1, lanes.length),
            events: sorted
        };
    }
}
export class StagApiClient {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/+$/, '');
    }
    /**
     * Statická pomocná metoda pro sestavení plné STAG URL
     */
    static buildUrl(baseUrl, studentNumber, year, semester) {
        const cleanBase = baseUrl.trim().replace(/\/+$/, '');
        const osCislo = studentNumber.trim();
        const rok = year.trim();
        const sem = semester.trim();
        return `${cleanBase}/rozvrhy/getRozvrhByStudent?osCislo=${encodeURIComponent(osCislo)}&rok=${encodeURIComponent(rok)}&semestr=${encodeURIComponent(sem)}&outputFormat=JSON`;
    }
    async fetchStudentSchedule(studentNumber, year, semester, username, password) {
        const url = StagApiClient.buildUrl(this.baseUrl, studentNumber, year, semester);
        const headers = {
            'Accept': 'application/json'
        };
        // Přidání Basic Auth hlavičky, pokud jsou zadány přihlašovací údaje
        if (username && password) {
            const encodedCredentials = btoa(`${username}:${password}`);
            headers['Authorization'] = `Basic ${encodedCredentials}`;
        }
        const response = await fetch(url, { headers });
        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Chyba autorizace: Neplatné uživatelské jméno nebo heslo, nebo chybí práva.');
            }
            throw new Error(`Chyba HTTP: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return this.parseResponse(data);
    }
    parseResponse(data) {
        const rawActions = data.rozvrhovaAkce || [];
        const actionsArray = Array.isArray(rawActions) ? rawActions : [rawActions];
        return actionsArray.map(item => {
            let typ = CourseType.PREDNASKA;
            const typZkr = (item.typAkceZkr || item.typAkce || '').toUpperCase();
            if (typZkr.includes('CV') || typZkr === 'CVIČENÍ')
                typ = CourseType.CVICENI;
            else if (typZkr.includes('SE') || typZkr === 'SEMINÁŘ')
                typ = CourseType.SEMINAR;
            const teacher = item.ucitel
                ? (item.ucitel.prijmeni || item.ucitel.jmeno || '')
                : (item.ucitelPrijmeni || '');
            return new ScheduleEvent({
                id: String(item.roId || item.id || Math.random()),
                katedra: item.katedra || '',
                predmet: item.predmet || '',
                typAkce: typ,
                den: (item.den || 'Po'),
                hodinaOd: item.hodinaOd != null ? Number(item.hodinaOd) : 0,
                hodinaDo: item.hodinaDo != null ? Number(item.hodinaDo) : 0,
                mistnost: item.mistnost || item.budovaMistnost || '',
                ucitel: teacher,
                isSelected: true
            });
        });
    }
}
/**
 * ====================================================================
 * 5. HLAVNÍ APLIKACE A RENDEROVÁNÍ
 * ====================================================================
 */
export class ScheduleApp {
    days = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
    periodTimes = [
        { top: '07:25', bottom: '08:10' },
        { top: '08:15', bottom: '09:00' },
        { top: '09:05', bottom: '09:50' },
        { top: '09:55', bottom: '10:40' },
        { top: '10:45', bottom: '11:30' },
        { top: '11:35', bottom: '12:20' },
        { top: '12:25', bottom: '13:10' },
        { top: '13:15', bottom: '14:00' },
        { top: '14:05', bottom: '14:50' },
        { top: '14:55', bottom: '15:40' },
        { top: '15:45', bottom: '16:30' },
        { top: '16:35', bottom: '17:20' },
        { top: '17:25', bottom: '18:10' },
        { top: '18:15', bottom: '19:00' },
        { top: '19:05', bottom: '19:50' },
        { top: '19:55', bottom: '20:40' }
    ];
    events = [];
    palette = new SubjectColorPalette();
    // DOM elementy
    gridEl;
    hiddenDrawerEl;
    hiddenPillsContainerEl;
    fileInputEl;
    pasteDialog;
    pasteTextarea;
    // Inputs
    apiEndpointInput;
    usernameInput;
    passwordInput;
    studentNumberInput;
    scheduleYearInput;
    scheduleSemesterSelect;
    stplIdnoInput; // Nové
    apiUrlLinkEl;
    btnCopyApiUrlEl;
    constructor() {
        this.initDOMElements();
        this.bindEvents();
        this.updateApiUrlPreview();
        this.loadDemoData();
    }
    initDOMElements() {
        this.gridEl = document.getElementById('timetableGrid');
        this.hiddenDrawerEl = document.getElementById('hiddenDrawer');
        this.hiddenPillsContainerEl = document.getElementById('hiddenPillsContainer');
        this.fileInputEl = document.getElementById('fileInput');
        this.pasteDialog = document.getElementById('pasteDialog');
        this.pasteTextarea = document.getElementById('pasteTextarea');
        this.apiEndpointInput = document.getElementById('apiEndpoint');
        this.studentNumberInput = document.getElementById('studentNumber');
        this.scheduleYearInput = document.getElementById('scheduleYear');
        this.scheduleSemesterSelect = document.getElementById('scheduleSemester');
        this.stplIdnoInput = document.getElementById('stplIdno');
        this.apiUrlLinkEl = document.getElementById('apiUrlLink');
        this.btnCopyApiUrlEl = document.getElementById('btnCopyApiUrl');
    }
    bindEvents() {
        // Tlačítka
        document.getElementById('btnFetchStag')?.addEventListener('click', () => this.fetchFromStag());
        document.getElementById('btnGetStudentInfo')?.addEventListener('click', () => this.fetchStudentInfo());
        document.getElementById('btnFetchPlan')?.addEventListener('click', () => this.fetchStudyPlan());
        document.getElementById('btnLoadDemo')?.addEventListener('click', () => this.loadDemoData());
        // Nahrání souboru
        // Dialog
        document.getElementById('btnPasteJson')?.addEventListener('click', () => this.pasteDialog.showModal());
        document.getElementById('btnDialogClose')?.addEventListener('click', () => this.pasteDialog.close());
        document.getElementById('btnDialogConfirm')?.addEventListener('click', () => {
            try {
                const data = JSON.parse(this.pasteTextarea.value);
                const client = new StagApiClient('');
                this.events = client.parseResponse(data);
                this.render();
                this.pasteDialog.close();
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                alert(`Neplatný formát JSON: ${message}`);
            }
        });
        // Live Preview URL
        const inputsToWatch = [
            this.apiEndpointInput,
            this.studentNumberInput,
            this.scheduleYearInput,
            this.scheduleSemesterSelect
        ];
        inputsToWatch.forEach(input => {
            input.addEventListener('input', () => this.updateApiUrlPreview());
            input.addEventListener('change', () => this.updateApiUrlPreview());
        });
        // Hover efekty pro API linky
        const setDynamicUrl = (url) => {
            this.apiUrlLinkEl.href = url;
            this.apiUrlLinkEl.textContent = url;
        };
        document.getElementById('btnFetchStag')?.addEventListener('mouseenter', () => this.updateApiUrlPreview());
        document.getElementById('btnGetStudentInfo')?.addEventListener('mouseenter', () => {
            const ep = this.apiEndpointInput.value.replace(/\/+$/, '');
            const os = this.studentNumberInput.value.trim() || '{osCislo}';
            setDynamicUrl(`${ep}/student/getStudentInfo?osCislo=${os}&outputFormat=JSON`);
        });
        document.getElementById('btnFetchPlan')?.addEventListener('mouseenter', () => {
            const ep = this.apiEndpointInput.value.replace(/\/+$/, '');
            const stpl = this.stplIdnoInput.value.trim() || '{stplIdno}';
            setDynamicUrl(`${ep}/programy/getPredmetyPlanu?stplIdno=${stpl}&outputFormat=JSON`);
        });
        // Tlačítko pro zkopírování URL do schránky s vizuální zpětnou vazbou
        const endpoint = this.apiEndpointInput.value.trim();
        const studentNumber = this.studentNumberInput.value.trim();
        const year = this.scheduleYearInput.value.trim();
        const sem = this.scheduleSemesterSelect.value;
        const fullUrl = StagApiClient.buildUrl(endpoint, studentNumber, year, sem);
        this.apiUrlLinkEl.href = fullUrl;
        this.apiUrlLinkEl.textContent = fullUrl;
    }
    async fetchStudentInfo() {
        const endpoint = this.apiEndpointInput.value.trim().replace(/\/+$/, '');
        const osCislo = this.studentNumberInput.value.trim();
        if (!osCislo) {
            alert('Pro zjištění informací vyplňte osobní číslo (např. F23000).');
            return;
        }
        try {
            const res = await fetch(`${endpoint}/student/getStudentInfo?osCislo=${osCislo}&outputFormat=JSON`);
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            // Zobrazení dat do panelu
            const panel = document.getElementById('studentInfoDisplay');
            if (panel) {
                panel.style.display = 'grid';
                panel.innerHTML = Object.entries(data).map(([key, value]) => `
                    <div class="info-item">
                        <span class="info-label">${key}</span>
                        <span class="info-value">${value !== null && value !== '' ? value : '-'}</span>
                    </div>
                `).join('');
            }
            // Automatické předvyplnění ID studijního plánu, pokud existuje
            if (data.stplIdno) {
                this.stplIdnoInput.value = data.stplIdno;
            }
            else {
                alert('STAG nevrátil ID studijního plánu (stplIdno). Zkontrolujte platnost osobního čísla.');
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            alert(`Při načítání informací o studentovi došlo k chybě: ${msg}`);
        }
    }
    async fetchStudyPlan() {
        const endpoint = this.apiEndpointInput.value.trim().replace(/\/+$/, '');
        const stplIdno = this.stplIdnoInput.value.trim();
        if (!stplIdno) {
            alert('Chybí ID Plánu. Nejdříve klikněte na "1. Info o studentovi" nebo ID zadejte ručně.');
            return;
        }
        try {
            const res = await fetch(`${endpoint}/programy/getPredmetyPlanu?stplIdno=${stplIdno}&outputFormat=JSON`);
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const pocet = data.predmetPlanu ? data.predmetPlanu.length : 0;
            alert(`Úspěšně staženo ${pocet} předmětů plánu! (Data jsou dostupná v konzoli prohlížeče)`);
            console.log("Stažený plán:", data);
            // TODO: Zde budeme následně vykreslovat UI plánu (obdoba obrázku s kredity a barvičkami)
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            alert(`Při načítání plánu došlo k chybě: ${msg}`);
        }
    }
    loadDemoData() {
        this.events = [
            new ScheduleEvent({ id: 'p1', den: 'Po', hodinaOd: 6, hodinaDo: 6, katedra: 'KTVS', predmet: 'BVZZS', typAkce: CourseType.SEMINAR, mistnost: 'A-AULA', ucitel: 'Schlegel' }),
            new ScheduleEvent({ id: 'p2', den: 'Po', hodinaOd: 7, hodinaDo: 8, katedra: 'KIKM', predmet: 'ZMI1', typAkce: CourseType.SEMINAR, mistnost: 'J-J31', ucitel: 'Bauer' }),
            new ScheduleEvent({ id: 'p3', den: 'Po', hodinaOd: 9, hodinaDo: 9, katedra: 'KIKM', predmet: 'UPROM', typAkce: CourseType.SEMINAR, mistnost: 'J-J20', ucitel: 'Palla' }),
            new ScheduleEvent({ id: 'p4', den: 'Po', hodinaOd: 11, hodinaDo: 11, katedra: 'KIT', predmet: 'UOMO', typAkce: CourseType.CVICENI, mistnost: 'J-J9', ucitel: 'Žváčková' }),
            new ScheduleEvent({ id: 'u1', den: 'Út', hodinaOd: 5, hodinaDo: 6, katedra: 'KIKM', predmet: 'ZMI1', typAkce: CourseType.PREDNASKA, mistnost: 'J-1', ucitel: 'Bauer' }),
            new ScheduleEvent({ id: 'u2', den: 'Út', hodinaOd: 5, hodinaDo: 6, katedra: 'KIT', predmet: 'TPW1A', typAkce: CourseType.SEMINAR, mistnost: 'J-J8', ucitel: 'Rohrová' }),
            new ScheduleEvent({ id: 'u3', den: 'Út', hodinaOd: 7, hodinaDo: 7, katedra: 'KIT', predmet: 'SYSP', typAkce: CourseType.CVICENI, mistnost: 'J-J1', ucitel: 'Zanker' }),
            new ScheduleEvent({ id: 'u4', den: 'Út', hodinaOd: 8, hodinaDo: 8, katedra: 'KIT', predmet: 'UOMO', typAkce: CourseType.CVICENI, mistnost: 'A-AULA', ucitel: 'Nacházel' }),
            new ScheduleEvent({ id: 'u5', den: 'Út', hodinaOd: 9, hodinaDo: 10, katedra: 'KIT', predmet: 'PRIPO', typAkce: CourseType.CVICENI, mistnost: 'J-J12', ucitel: 'Šec' }),
            new ScheduleEvent({ id: 'u6', den: 'Út', hodinaOd: 11, hodinaDo: 11, katedra: 'KIT', predmet: 'SYSP', typAkce: CourseType.SEMINAR, mistnost: 'J-J22', ucitel: 'Zanker' }),
            new ScheduleEvent({ id: 's1', den: 'St', hodinaOd: 1, hodinaDo: 1, katedra: 'KIT', predmet: 'TPW1A', typAkce: CourseType.PREDNASKA, mistnost: 'J-1', ucitel: 'Ponce' }),
            new ScheduleEvent({ id: 's2', den: 'St', hodinaOd: 2, hodinaDo: 2, katedra: 'KIT', predmet: 'PRIPO', typAkce: CourseType.PREDNASKA, mistnost: 'J-1', ucitel: 'Mikulecký' }),
            new ScheduleEvent({ id: 's3', den: 'St', hodinaOd: 3, hodinaDo: 3, katedra: 'KKNS', predmet: 'BZTKK', typAkce: CourseType.PREDNASKA, mistnost: 'A-AULA', ucitel: 'Burda' })
        ];
        this.render();
    }
    async fetchFromStag() {
        const endpoint = this.apiEndpointInput.value.trim();
        const studentNumber = this.studentNumberInput.value.trim();
        const year = this.scheduleYearInput.value.trim();
        const sem = this.scheduleSemesterSelect.value;
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value.trim();
        if (!studentNumber) {
            alert('Vyplňte prosím osobní číslo studenta.');
            return;
        }
        try {
            const client = new StagApiClient(endpoint);
            this.events = await client.fetchStudentSchedule(studentNumber, year, sem, username, password);
            if (this.events.length === 0) {
                alert('Zvolené volání vrátilo prázdný rozvrh. Zkontrolujte zadání semestru/roku.');
            }
            this.render();
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            alert(`Při načítání API došlo k chybě:\n\n${msg}\n\nTip: Pokud používáte čisté HTML (file://) a STAG vrací CORS chybu, nejlepší způsob je zkopírovat "API odkaz", otevřít ho prohlížeči, tam se přihlásit (pokud je to vyžadováno), zkopírovat vypsaný JSON text a vložit ho k nám přes tlačítko "Vložit JSON".`);
        }
    }
    handleFileUpload(event) {
        const target = event.target;
        const file = target.files?.[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const jsonText = e.target?.result;
                const data = JSON.parse(jsonText);
                const client = new StagApiClient('');
                this.events = client.parseResponse(data);
                this.render();
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                alert(`Chyba při čtení JSON souboru: ${msg}`);
            }
        };
        reader.readAsText(file);
    }
    toggleEventSelection(id) {
        const event = this.events.find(e => e.id === id);
        if (event) {
            event.isSelected = !event.isSelected;
            this.render();
        }
    }
    render() {
        this.gridEl.innerHTML = '';
        const semesterText = this.scheduleSemesterSelect.value;
        // 1. Rohová buňka
        const corner = document.createElement('div');
        corner.className = 'cell cell-corner';
        corner.textContent = semesterText;
        this.gridEl.appendChild(corner);
        // 2. Záhlaví hodin
        for (let h = 0; h <= 15; h++) {
            const hourCell = document.createElement('div');
            hourCell.className = 'cell cell-header-hour';
            hourCell.style.gridColumn = `${h + 2}`;
            hourCell.style.gridRow = '1';
            const time = this.periodTimes[h];
            hourCell.innerHTML = `
                <span class="time-top">${time.top}</span>
                <span class="hour-num">${h}.</span>
                <span class="time-bottom">${time.bottom}</span>
            `;
            this.gridEl.appendChild(hourCell);
        }
        // 3. Řádky
        let currentRow = 2;
        const activeEvents = this.events.filter(e => e.isSelected);
        const hiddenEvents = this.events.filter(e => !e.isSelected);
        for (const day of this.days) {
            const dayEvents = activeEvents.filter(e => e.den === day);
            const { lanesCount, events: placedEvents } = ScheduleLayoutEngine.computeLanesForDay(dayEvents);
            const dayHeader = document.createElement('div');
            dayHeader.className = 'cell cell-day';
            dayHeader.textContent = day;
            dayHeader.style.gridColumn = '1';
            dayHeader.style.gridRow = `${currentRow} / span ${lanesCount}`;
            this.gridEl.appendChild(dayHeader);
            for (let lane = 0; lane < lanesCount; lane++) {
                const laneRow = currentRow + lane;
                for (let h = 0; h <= 15; h++) {
                    const slot = document.createElement('div');
                    slot.className = 'cell cell-slot';
                    slot.style.gridColumn = `${h + 2}`;
                    slot.style.gridRow = `${laneRow}`;
                    this.gridEl.appendChild(slot);
                }
            }
            for (const event of placedEvents) {
                const card = document.createElement('div');
                card.className = 'event-card';
                const colorInfo = this.palette.getColor(event.fullSubjectCode);
                card.style.backgroundColor = colorInfo.bg;
                card.style.gridColumn = `${event.hodinaOd + 2} / ${event.hodinaDo + 3}`;
                card.style.gridRow = `${currentRow + event.laneIndex}`;
                let badgeClass = 'prednaska';
                if (event.typAkce === CourseType.CVICENI)
                    badgeClass = 'cviceni';
                if (event.typAkce === CourseType.SEMINAR)
                    badgeClass = 'seminar';
                card.innerHTML = `
                    <div class="card-badge ${badgeClass}">${event.fullSubjectCode}</div>
                    <div class="card-body ${colorInfo.darkText ? 'dark-text' : ''}">
                        <div>${event.mistnost}</div>
                        <div>${event.ucitel}</div>
                    </div>
                    <div class="purple-check-btn" title="Odebrat z rozvrhu">✓</div>
                `;
                const checkBtn = card.querySelector('.purple-check-btn');
                checkBtn?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleEventSelection(event.id);
                });
                this.gridEl.appendChild(card);
            }
            currentRow += lanesCount;
        }
        this.renderHiddenDrawer(hiddenEvents);
    }
    renderHiddenDrawer(hiddenEvents) {
        if (hiddenEvents.length === 0) {
            this.hiddenDrawerEl.style.display = 'none';
            return;
        }
        this.hiddenDrawerEl.style.display = 'flex';
        this.hiddenPillsContainerEl.innerHTML = '';
        for (const event of hiddenEvents) {
            const pill = document.createElement('div');
            const color = this.palette.getColor(event.fullSubjectCode);
            pill.className = 'hidden-pill';
            pill.innerHTML = `
                <span class="pill-indicator" style="background:${color.bg};"></span>
                <span>${event.den} ${event.hodinaOd}.h: ${event.fullSubjectCode} (${event.typAkce})</span>
                <span class="pill-plus">+</span>
            `;
            pill.addEventListener('click', () => this.toggleEventSelection(event.id));
            this.hiddenPillsContainerEl.appendChild(pill);
        }
    }
}
window.addEventListener('DOMContentLoaded', () => {
    new ScheduleApp();
});
