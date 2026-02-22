/**
 * JYOTISHA Module
 * Handles profile management and planetary calculations
 */

const J_CONSTANTS = {
    NAKSHATRAS: [
        "Aswini", "Bharni", "Kritik", "Rohini", "Mrigas", "Ardra", "Punarv", "Pushya", "Aslesa",
        "Magha", "P.Phal", "U.Phal", "Hasta", "Chitra", "Swati", "Vishak", "Anurad", "Jyesht",
        "Mula", "P.Asha", "U.Asha", "Sravan", "Dhanis", "Shatab", "P.Bhad", "U.Bhad", "Revati"
    ],
    DASHA_LORDS: [
        { lord: "Ketu", years: 7, code: "Ke" }, { lord: "Shukra", years: 20, code: "Sk" }, { lord: "Surya", years: 6, code: "Su" },
        { lord: "Chandra", years: 10, code: "Ch" }, { lord: "Kuja", years: 7, code: "Ku" }, { lord: "Rahu", years: 18, code: "Ra" },
        { lord: "Guru", years: 16, code: "Gu" }, { lord: "Shani", years: 19, code: "Sa" }, { lord: "Budha", years: 17, code: "Bu" }
    ],
    RASHI_NAMES: [
        "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", 
        "Tula", "Vrischika", "Dhanu", "Makara", "Kumbha", "Meena"
    ],
    NAKSHATRA_MAP: {
        "aswini": 1, "aswi": 1, "ashwini": 1, "bharani": 2, "bhar": 2, "krittika": 3, "krit": 3,
        "rohini": 4, "rohi": 4, "mrigasira": 5, "mrig": 5, "ardra": 6, "ardr": 6, "punarvasu": 7, "puna": 7,
        "pushyami": 8, "push": 8, "pushya": 8, "aslesha": 9, "asre": 9, "magha": 10, "magh": 10,
        "purva phalguni": 11, "ppha": 11, "uttara phalguni": 12, "upha": 12, "hasta": 13, "hast": 13,
        "chitra": 14, "chit": 14, "swati": 15, "swat": 15, "visakha": 16, "visa": 16, "anuradha": 17, "anu": 17,
        "jyeshta": 18, "jye": 18, "moola": 19, "mool": 19, "purva ashadha": 20, "psha": 20,
        "uttara ashadha": 21, "usha": 21, "sravana": 22, "srav": 22, "dhanishta": 23, "dhan": 23,
        "satabhisha": 24, "sata": 24, "purva bhadra": 25, "pbha": 25, "uttara bhadra": 26, "ubha": 26, "revati": 27, "reva": 27
    }
};

const JyotishaController = {
    profiles: JSON.parse(localStorage.getItem('epata_jyotisha_profiles') || '[]'),
    currentProfileId: null,
    transitData: null,
    moonTransitData: null,

    init() {
        this.renderProfiles();
        this.updateProfileDropdown();
        this.setupEventListeners();
        if(!this.transitData) this.loadTransitData();
    },

    async loadTransitData() {
        try {
            const [tRes, mRes] = await Promise.all([
                fetch('transit.json'),
                fetch('transit_moon.json')
            ]);
            this.transitData = await tRes.json();
            this.moonTransitData = await mRes.json();
        } catch (e) {
            console.error("Failed to load jyotisha data", e);
        }
    },

    setupEventListeners() {
        // Add Profile Button
        const addBtn = document.getElementById('addProfileBtn');
        if (addBtn) addBtn.onclick = () => this.openModal();

        // Save Button
        const saveBtn = document.getElementById('saveProfileBtn');
        if (saveBtn) saveBtn.onclick = () => this.saveProfile();

        // Close Modal
        const closeBtn = document.getElementById('closeJyotishaModal');
        if (closeBtn) closeBtn.onclick = () => this.closeModal();
        
        const modal = document.getElementById('jyotishaModal');
        if (modal) {
            modal.onclick = (e) => {
                if (e.target === modal) this.closeModal();
            }
        }

        // Profile Select
        const profileSelect = document.getElementById('profileSelect');
        if (profileSelect) {
            profileSelect.onchange = (e) => this.renderChart(e.target.value);
        }
    },

    renderProfiles() {
        const container = document.getElementById('jyotishaProfilesList');
        if (!container) return;

        if (this.profiles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i class="fas fa-user-astronaut"></i></div>
                    <h3>No Profiles Yet</h3>
                    <p>Add a profile to start.</p>
                </div>`;
            return;
        }

        container.innerHTML = this.profiles.map(p => `
            <div class="profile-card">
                <div class="profile-info">
                    <div class="profile-name">${p.name}</div>
                    <div class="profile-meta">
                        <span><i class="far fa-calendar-alt"></i> ${p.dob}</span>
                    </div>
                </div>
                <div class="profile-actions">
                    <button class="profile-btn edit" onclick="JyotishaController.openModal('${p.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="profile-btn delete" onclick="JyotishaController.deleteProfile('${p.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    updateProfileDropdown() {
        const select = document.getElementById('profileSelect');
        if (!select) return;

        const currentVal = select.value;
        select.innerHTML = '<option value="">Select Profile to View Chart</option>' + 
            this.profiles.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        
        if (currentVal && this.profiles.find(p => p.id === currentVal)) {
            select.value = currentVal;
        }
    },

    openModal(id = null) {
        const modal = document.getElementById('jyotishaModal');
        const title = document.getElementById('jyotishaModalTitle');
        const nameInput = document.getElementById('jName');
        const dobInput = document.getElementById('jDob');
        const planetsInput = document.getElementById('jPlanets');
        const moonDegInput = document.getElementById('jMoonDeg');
        const moonMinInput = document.getElementById('jMoonMin');

        this.currentProfileId = id;

        if (id) {
            const p = this.profiles.find(x => x.id === id);
            if (!p) return;
            title.textContent = "Edit Profile";
            nameInput.value = p.name;
            dobInput.value = p.dobRaw || ''; 
            planetsInput.value = p.planets.join(',');
            moonDegInput.value = p.moon.deg;
            moonMinInput.value = p.moon.min;
        } else {
            title.textContent = "Add Profile";
            nameInput.value = '';
            dobInput.value = '';
            planetsInput.value = '';
            moonDegInput.value = '';
            moonMinInput.value = '';
        }

        modal.classList.add('active');
    },

    closeModal() {
        document.getElementById('jyotishaModal').classList.remove('active');
        this.currentProfileId = null;
    },

    saveProfile() {
        const name = document.getElementById('jName').value.trim();
        const dobRaw = document.getElementById('jDob').value;
        const planetsStr = document.getElementById('jPlanets').value.trim();
        const moonDeg = parseInt(document.getElementById('jMoonDeg').value) || 0;
        const moonMin = parseInt(document.getElementById('jMoonMin').value) || 0;

        if (!name || !dobRaw || !planetsStr) {
            Utils.showToast('Please fill all fields', 'error');
            return;
        }

        // Validate Planets
        const planets = planetsStr.split(',').map(x => parseInt(x.trim()));
        if (planets.length !== 10 || planets.some(isNaN)) {
            Utils.showToast('Enter 10 numbers for planets (Lg to Ke)', 'error');
            return;
        }

        // Format Date for display (DD-MMM-YYYY)
        const dateObj = new Date(dobRaw);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dobDisplay = `${String(dateObj.getDate()).padStart(2, '0')}-${months[dateObj.getMonth()]}-${dateObj.getFullYear()}`;

        const profile = {
            id: this.currentProfileId || Date.now().toString(),
            name,
            dob: dobDisplay,
            dobRaw,
            planets,
            moon: {
                deg: moonDeg,
                min: moonMin,
                decimal: moonDeg + (moonMin / 60)
            }
        };

        if (this.currentProfileId) {
            const index = this.profiles.findIndex(p => p.id === this.currentProfileId);
            if (index > -1) this.profiles[index] = profile;
        } else {
            this.profiles.push(profile);
        }

        localStorage.setItem('epata_jyotisha_profiles', JSON.stringify(this.profiles));
        this.renderProfiles();
        this.updateProfileDropdown();
        this.closeModal();
        Utils.showToast('Profile Saved!');
    },

    deleteProfile(id) {
        if (confirm('Delete this profile?')) {
            this.profiles = this.profiles.filter(p => p.id !== id);
            localStorage.setItem('epata_jyotisha_profiles', JSON.stringify(this.profiles));
            this.renderProfiles();
            this.updateProfileDropdown();
            document.getElementById('chartContainer').style.display = 'none';
            Utils.showToast('Profile Deleted');
        }
    },

    renderChart(profileId) {
        const container = document.getElementById('chartContainer');
        if (!profileId) {
            container.style.display = 'none';
            return;
        }

        const profile = this.profiles.find(p => p.id === profileId);
        if (!profile) return;

        // Planet mapping: 0:Lg, 1:Su, 2:Ch, 3:Ku, 4:Bu, 5:Gu, 6:Sk, 7:Sa, 8:Ra, 9:Ke
        const planetNames = ['Lg', 'Su', 'Ch', 'Ku', 'Bu', 'Gu', 'Sk', 'Sa', 'Ra', 'Ke'];
        
        // Initialize houses (1 to 12)
        const houses = {};
        for (let i = 1; i <= 12; i++) houses[i] = [];

        // Distribute planets to houses
        profile.planets.forEach((rashi, index) => {
            if (rashi >= 1 && rashi <= 12) {
                houses[rashi].push(planetNames[index]);
            }
        });

        // South Indian Chart Layout (Fixed Signs)
        // 12: Pisces, 1: Aries, 2: Taurus, 3: Gemini
        // 11: Aquarius,                 4: Cancer
        // 10: Capricorn,                5: Leo
        // 9: Sagittarius, 8: Scorpio, 7: Libra, 6: Virgo

        const getBoxContent = (rashi) => {
            const planets = houses[rashi];
            return planets.length > 0 ? 
                `<div class="planets-list">${planets.map(p => `<span class="planet-tag ${p === 'Lg' ? 'lagna' : ''}">${p}</span>`).join('')}</div>` : 
                '';
        };

        container.innerHTML = `
            <div class="jyotisha-layout">
                <div class="chart-section">
            <div class="south-indian-chart">
                <!-- Row 1 -->
                <div class="chart-box rashi-12" data-rashi="Pisces">${getBoxContent(12)}<span class="rashi-label">12</span></div>
                <div class="chart-box rashi-1" data-rashi="Aries">${getBoxContent(1)}<span class="rashi-label">1</span></div>
                <div class="chart-box rashi-2" data-rashi="Taurus">${getBoxContent(2)}<span class="rashi-label">2</span></div>
                <div class="chart-box rashi-3" data-rashi="Gemini">${getBoxContent(3)}<span class="rashi-label">3</span></div>

                <!-- Row 2 -->
                <div class="chart-box rashi-11" data-rashi="Aquarius">${getBoxContent(11)}<span class="rashi-label">11</span></div>
                <div class="chart-center">
                    <div class="chart-info-name">${profile.name}</div>
                    <div class="chart-info-dob">${profile.dob}</div>
                </div>
                <div class="chart-box rashi-4" data-rashi="Cancer">${getBoxContent(4)}<span class="rashi-label">4</span></div>

                <!-- Row 3 -->
                <div class="chart-box rashi-10" data-rashi="Capricorn">${getBoxContent(10)}<span class="rashi-label">10</span></div>
                <!-- Center spans 2x2, defined in CSS -->
                <div class="chart-box rashi-5" data-rashi="Leo">${getBoxContent(5)}<span class="rashi-label">5</span></div>

                <!-- Row 4 -->
                <div class="chart-box rashi-9" data-rashi="Sagittarius">${getBoxContent(9)}<span class="rashi-label">9</span></div>
                <div class="chart-box rashi-8" data-rashi="Scorpio">${getBoxContent(8)}<span class="rashi-label">8</span></div>
                <div class="chart-box rashi-7" data-rashi="Libra">${getBoxContent(7)}<span class="rashi-label">7</span></div>
                <div class="chart-box rashi-6" data-rashi="Virgo">${getBoxContent(6)}<span class="rashi-label">6</span></div>
            </div>
                </div>
                <div class="details-section">
                    ${this.calculateDetails(profile)}
                </div>
            </div>
        `;
        
        container.style.display = 'block';
        // Scroll to chart
        container.scrollIntoView({ behavior: 'smooth' });
    },

    calculateDetails(profile) {
        // 1. Janma Rashi & Nakshatra
        // Moon is at index 2 in planets array (0-based: Lg, Su, Ch...)
        const moonRashiNum = profile.planets[2]; 
        const moonDeg = profile.moon.decimal;
        
        // Absolute longitude of Moon (0-360)
        // (Rashi - 1) * 30 + Degrees
        const absLong = ((moonRashiNum - 1) * 30) + moonDeg;
        
        // Nakshatra (13.3333 degrees per nakshatra)
        const nakshatraSpan = 13 + (20/60); // 13.3333
        const nakshatraIndex = Math.floor(absLong / nakshatraSpan); // 0-26
        const janmaNakshatra = J_CONSTANTS.NAKSHATRAS[nakshatraIndex];
        const janmaRashi = J_CONSTANTS.RASHI_NAMES[moonRashiNum - 1];

        // 2. Current Dasha (MD-AD-PD)
        const degInNakshatra = absLong % nakshatraSpan;
        const fractionPassed = degInNakshatra / nakshatraSpan;
        
        // Dasha Lord Index (0-8) -> Ketu to Budha
        let mdIndex = nakshatraIndex % 9;
        const birthMDYears = J_CONSTANTS.DASHA_LORDS[mdIndex].years;
        const passedInBirthMD = birthMDYears * fractionPassed;
        
        // Calculate Age
        const dob = new Date(profile.dobRaw);
        const today = new Date();
        const ageYears = (today - dob) / (1000 * 60 * 60 * 24 * 365.25);
        
        // Find Current MD
        let timeInSeq = passedInBirthMD + ageYears;
        let currentMD = null;
        
        // Loop to find MD (Safety break after 3 cycles)
        for(let i=0; i<27; i++) {
            const duration = J_CONSTANTS.DASHA_LORDS[mdIndex].years;
            if(timeInSeq < duration) {
                currentMD = J_CONSTANTS.DASHA_LORDS[mdIndex];
                break;
            }
            timeInSeq -= duration;
            mdIndex = (mdIndex + 1) % 9;
        }
        
        // Find AD (Antardasha)
        let adIndex = mdIndex;
        let timeInADSeq = timeInSeq; // Remaining time in current MD
        let currentAD = null;
        
        for(let i=0; i<9; i++) {
            const adLord = J_CONSTANTS.DASHA_LORDS[adIndex];
            const duration = (currentMD.years * adLord.years) / 120;
            if(timeInADSeq < duration) {
                currentAD = adLord;
                break;
            }
            timeInADSeq -= duration;
            adIndex = (adIndex + 1) % 9;
        }

        // Find PD (Pratyantardasha)
        let pdIndex = adIndex;
        let timeInPDSeq = timeInADSeq; // Remaining time in current AD
        let currentPD = null;

        for(let i=0; i<9; i++) {
            const pdLord = J_CONSTANTS.DASHA_LORDS[pdIndex];
            // PD Duration = (MD * AD * PD) / 14400
            const duration = (currentMD.years * currentAD.years * pdLord.years) / 14400;
            if(timeInPDSeq < duration) {
                currentPD = pdLord;
                break;
            }
            timeInPDSeq -= duration;
            pdIndex = (pdIndex + 1) % 9;
        }

        let dashaString = "Unknown";
        if (currentMD && currentAD && currentPD) {
            dashaString = `${currentMD.code}-${currentAD.code}-${currentPD.code}`;
        }

        // 3. Bhala Calculations
        let taraBhala = "Loading...", chandraBhala = "Loading...", guruBhala = "Loading...", shaniBhala = "Loading...";
        
        if (this.transitData && this.moonTransitData) {
            const todayStr = today.toISOString().split('T')[0];
            
            // Transit Moon
            const moonAbbr = this.moonTransitData[todayStr];
            const transitMoonIdx = moonAbbr ? J_CONSTANTS.NAKSHATRA_MAP[moonAbbr.toLowerCase()] - 1 : null; // 0-26
            
            // Transit Planets
            const getTransitRashi = (planet) => {
                const p = this.transitData.find(x => x.planet === planet && todayStr >= x.start && todayStr <= x.end);
                return p ? p.rashi : null;
            };
            const transitGuru = getTransitRashi('Guru');
            const transitShani = getTransitRashi('Shani');

            // Tara Bhala
            if (transitMoonIdx !== null) {
                // (Transit - Janma + 1 + 27) % 9. If 0 -> 9.
                // Using 0-based index: (Transit - Janma) % 9. 
                // Let's stick to 1-based logic for Tara: (TransitIndex+1 - JanmaIndex+1 + 27) % 9
                // Distance
                let dist = (transitMoonIdx - nakshatraIndex);
                if (dist < 0) dist += 27;
                const taraNum = (dist % 9) + 1;
                const isGoodTara = [2, 4, 6, 8, 9].includes(taraNum);
                taraBhala = `<span class="${isGoodTara ? 'good' : 'bad'}">${isGoodTara ? 'YES' : 'NO'} (${taraNum})</span>`;
                
                // Chandra Bhala (Transit Moon Rashi vs Janma Rashi)
                // Approx Transit Rashi from Nakshatra
                const transitMoonRashi = Math.ceil((transitMoonIdx + 1) * 12 / 27);
                let pos = (transitMoonRashi - moonRashiNum + 1);
                if (pos <= 0) pos += 12;
                const isGoodChandra = [1, 3, 6, 7, 10, 11].includes(pos);
                chandraBhala = `<span class="${isGoodChandra ? 'good' : 'bad'}">${isGoodChandra ? 'YES' : 'NO'} (${pos})</span>`;
            }

            // Guru Bhala
            if (transitGuru) {
                let pos = (transitGuru - moonRashiNum + 1);
                if (pos <= 0) pos += 12;
                const isGoodGuru = [2, 5, 7, 9, 11].includes(pos);
                guruBhala = `<span class="${isGoodGuru ? 'good' : 'bad'}">${isGoodGuru ? 'YES' : 'NO'} (${pos})</span>`;
            }

            // Shani Bhala
            if (transitShani) {
                let pos = (transitShani - moonRashiNum + 1);
                if (pos <= 0) pos += 12;
                const isGoodShani = [3, 6, 11].includes(pos);
                let text = isGoodShani ? "Good" : "Average";
                if ([1, 2, 12].includes(pos)) text = "Sade-Sathi";
                if (pos === 4) text = "Ardhashtama";
                if (pos === 8) text = "Ashtama";
                
                shaniBhala = `<span class="${isGoodShani ? 'good' : 'bad'}">${text} (${pos})</span>`;
            }
        }

        return `
            <div class="detail-row"><strong>Janma Rashi:</strong> <span>${janmaRashi}</span></div>
            <div class="detail-row"><strong>Janma Nakshatra:</strong> <span>${janmaNakshatra}</span></div>
            <div class="detail-row"><strong>Current Dasha:</strong> <span>${dashaString}</span></div>
            <div class="detail-divider"></div>
            <div class="detail-row"><strong>Tara Bhala:</strong> ${taraBhala}</div>
            <div class="detail-row"><strong>Chandra Bhala:</strong> ${chandraBhala}</div>
            <div class="detail-row"><strong>Guru Bhala:</strong> ${guruBhala}</div>
            <div class="detail-row"><strong>Shani Bhala:</strong> ${shaniBhala}</div>
        `;
    }
};