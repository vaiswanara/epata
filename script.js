/**
 * e-PATA - Mobile-First Vedic Astrology Learning Platform
 * Optimized for smartphones with touch gestures and PWA support
 */

// ============================================
// CONFIG LOADER
// ============================================
let APP_CONFIG = null;
let configRetryTimer = null;
let configRetryActive = false;
const CONFIG_RETRY_INTERVAL_MS = 20000;
let appInitialized = false;

function scheduleConfigRetry() {
    if (configRetryTimer) return;
    configRetryActive = true;
    configRetryTimer = setTimeout(() => {
        configRetryTimer = null;
        loadAppConfig();
    }, CONFIG_RETRY_INTERVAL_MS);
}

function clearConfigRetry() {
    if (configRetryTimer) {
        clearTimeout(configRetryTimer);
        configRetryTimer = null;
    }
    configRetryActive = false;
}

async function loadAppConfig() {
    try {
        const res = await fetch('config.json?t=' + Date.now());
        if (!res.ok) throw new Error("Config fetch failed");
        APP_CONFIG = await res.json();
        console.log("CONFIG LOADED", APP_CONFIG);
        if (configRetryActive) {
            clearConfigRetry();
        }
        initializeAppAfterConfig();
    } catch (e) {
        console.error("Failed to load config.json", e);
        showConfigError();
        scheduleConfigRetry();
    }
}



async function initializeAppAfterConfig() {
    if (appInitialized) return;
    appInitialized = true;

    try {
        await loadCoursesMeta();
    } catch (e) {
        console.error("Courses load failed", e);
    }

    try {
        await DataManager.loadData();
    } catch (e) {
        console.error("Lessons load failed", e);
    }

    // Always render UI even if partial data
    ViewManager.renderCurrentView();
}



// ============================================
// PWA INSTALL PROMPT
// ============================================
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log("PWA Install Event captured!");
    
    // Check if user dismissed recently (24 hours cooldown)
    const lastDismissed = localStorage.getItem('epata_install_dismissed');
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000; // 24 hours

    if (!lastDismissed || (now - parseInt(lastDismissed)) > cooldown) {
        // Auto-show Install Modal when prompt is ready (after 3 seconds)
        setTimeout(() => {
            const installModal = document.getElementById('installModal');
            if (installModal) installModal.classList.add('active');
        }, 3000);
    }
});

// When app installed → reset variable
window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    console.log("PWA installed successfully");
});

// Helper: check if install available
function isInstallAvailable() {
    return deferredPrompt !== null && deferredPrompt !== undefined;
}

// ============================================
// GLOBAL STATE
// ============================================
const AppState = {
    lessons: [],
    playlists: [],
    favorites: JSON.parse(localStorage.getItem('epata_favorites') || '[]'),
    completed: JSON.parse(localStorage.getItem('epata_completed') || '[]'),
    enrolledCourse: JSON.parse(localStorage.getItem('epata_enrolled_course') || 'null'),
    coursesMeta: [],
    recentlyWatched: JSON.parse(localStorage.getItem('epata_recent') || '[]'),
    currentView: 'dashboard',
    currentVideo: null,
    searchQuery: '',
    filters: { playlist: '', language: '' },
    resources: [],
    displayCount: 12,
    quiz: { questions: [], current: 0, score: 0, date: null, loaded: false },
    isOnline: navigator.onLine
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const Utils = {
    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        const icon = toast.querySelector('i');
        
        toastMessage.textContent = message;
        icon.className = type === 'success' ? 'fas fa-check-circle' : 
                         type === 'error' ? 'fas fa-exclamation-circle' : 'fas fa-info-circle';
        icon.style.color = type === 'success' ? 'var(--success)' : 
                          type === 'error' ? 'var(--danger)' : 'var(--warning)';
        
        toast.classList.add('active');
        setTimeout(() => toast.classList.remove('active'), 2500);
    },

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    },

    getYouTubeThumbnail(videoId) {
        return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    },

    getLanguage(playlistName) {
        const name = (playlistName || '').toLowerCase();
        if (name.includes('ಕನ್ನಡ') || name.includes('kannada')) return 'kannada';
        if (name.includes('తెలుగు') || name.includes('telugu')) return 'telugu';
        return 'other';
    },

    getLanguageDisplay(playlistName) {
        const name = (playlistName || '').toLowerCase();
        if (name.includes('ಕನ್ನಡ') || name.includes('kannada')) return 'ಕನ್ನಡ';
        if (name.includes('తెలుగు') || name.includes('telugu')) return 'తెలుగు';
        return 'Other';
    },

    getCategoryIcon(playlistName) {
        const name = playlistName.toLowerCase();
        if (name.includes('jyotisha')) return 'fa-star';
        if (name.includes('mana')) return 'fa-brain';
        if (name.includes('prashna')) return 'fa-question-circle';
        if (name.includes('app')) return 'fa-mobile-alt';
        return 'fa-book';
    },

    getCategoryColor(playlistName) {
        const name = playlistName.toLowerCase();
        if (name.includes('jyotisha')) return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        if (name.includes('mana')) return 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
        if (name.includes('prashna')) return 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
        if (name.includes('app')) return 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)';
        return 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)';
    },

    formatPlaylistName(name) {
        return name.replace(/[()]/g, '').trim();
    },

    saveToStorage(key, data) {
        localStorage.setItem(`epata_${key}`, JSON.stringify(data));
    },

    parseCSV(text) {
        const rows = [];
        let current = '';
        let row = [];
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const next = text[i + 1];
            if (char === '"' && inQuotes && next === '"') {
                current += '"';
                i++;
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row.push(current);
                current = '';
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && next === '\n') i++;
                row.push(current);
                if (row.length > 1 || row[0].trim() !== '') rows.push(row);
                row = [];
                current = '';
            } else {
                current += char;
            }
        }
        if (current.length > 0 || row.length > 0) {
            row.push(current);
            if (row.length > 1 || row[0].trim() !== '') rows.push(row);
        }
        return rows.map(r => r.map(cell => cell.trim()));
    },

    // Share functionality
    async shareLesson(lesson) {
        const url = lesson.videoId ? `https://youtube.com/watch?v=${lesson.videoId}` : '';
        const text = `Check out this Vedic Astrology lesson: ${lesson.title}`;
        
        if (navigator.share) {
            try {
                await navigator.share({ title: lesson.title, text, url });
            } catch (err) {
                // User cancelled
            }
        }
    },

    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            Utils.showToast('Link copied!');
        } catch (err) {
            // Fallback
            const input = document.createElement('input');
            input.value = text;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            Utils.showToast('Link copied!');
        }
    }
};

function parseFlexibleDate(str) {
    if (!str) return null;
    const s = str.trim();
    if (!s) return null;
    
    // Handle DD-MM-YYYY or DD/MM/YYYY
    const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmy) {
        return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}`).getTime();
    }
    
    // Handle YYYY-MM-DD
    const ymd = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (ymd) {
        return new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}`).getTime();
    }
    
    return null;
}

function isCourseActive(course) {
    if ((course.course_status || '').toUpperCase() !== 'ON') return false;
    
    const now = Date.now();
    const start = parseFlexibleDate(course.start_date);
    const end = parseFlexibleDate(course.end_date);
    
    if (start && now < start) return false;
    if (end && now > end) return false;
    
    return true;
}

async function loadCoursesFromSheet() {
    if (!APP_CONFIG || !APP_CONFIG.std_courses) {
        console.error("std_courses URL missing in config.json");
        return;
    }

    try {
        const res = await fetch(APP_CONFIG.std_courses + '&t=' + Date.now());
        const text = await res.text();
        const rows = Utils.parseCSV(text);
        
        if (rows.length < 2) return;
        
        // Map headers dynamically
        const headers = rows[0].map(h => h.toLowerCase().trim());
        const getIdx = (key) => headers.indexOf(key);
        
        const courses = [];
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length < 2) continue;
            
            const course = {
                id: row[getIdx('id')] || '',
                name: row[getIdx('name')] || '',
                playlist: row[getIdx('playlist')] || '',
                description: row[getIdx('description')] || '',
                course_type: row[getIdx('course_type')] || '',
                start_date: row[getIdx('start_date')] || '',
                end_date: row[getIdx('end_date')] || '',
                course_status: row[getIdx('course_status')] || 'OFF'
            };
            
            if ((course.course_status || '').toUpperCase() === 'ON') {
                courses.push(course);
            }
        }
        
        AppState.coursesMeta = courses;
        console.log("Courses loaded from Sheet", AppState.coursesMeta);
        
        if(ViewManager && typeof ViewManager.renderCurrentView === 'function'){
            ViewManager.renderCurrentView();
        }
    } catch (e) {
        console.error("Failed to load courses from sheet", e);
    }
}

async function loadCoursesMeta() {
    await loadCoursesFromSheet();
}

// ============================================
// DATA MANAGEMENT
// ============================================
let activeFetches = 0;
const MAX_FETCH_TIME = 15000; // 15 seconds
const DataManager = {
    async loadData(options = {}) {
        if (!APP_CONFIG) return { success: false, updated: false };
        const { forceRefresh = false } = options;
        const localUrl = 'links.txt';
        const googleSheetUrl = APP_CONFIG.urls;
        
        // Append timestamp to prevent caching
        const sheetUrlWithCache = googleSheetUrl + '&t=' + new Date().getTime();

        // 1. Check cache and load immediately (unless force refresh)
        let isCachedLoaded = false;
        const cachedData = localStorage.getItem('epata_cached_lessons');
        
        if (!forceRefresh && cachedData) {
            try {
                const parsedLessons = JSON.parse(cachedData);
                if (Array.isArray(parsedLessons) && parsedLessons.length > 0) {
                    AppState.lessons = parsedLessons;
                    // Reconstruct playlists from lessons
                    const playlists = new Set(parsedLessons.map(l => l.playlistId || l.playlist));
                    AppState.playlists = Array.from(playlists).sort();
                    isCachedLoaded = true;
                    console.log('Loaded lessons from cache');
                }
            } catch (e) {
                console.error('Error parsing cached lessons:', e);
            }
        }

        // 2. Define fetch logic for background update
        const fetchFreshData = async () => {
            activeFetches += 1;
            if (activeFetches === 1) {
                UIRenderer.showUpdatingBadge();
            }
            let timeoutFired = false;
            const timeoutId = setTimeout(() => {
                timeoutFired = true;
                activeFetches = Math.max(0, activeFetches - 1);
                if (activeFetches === 0) {
                    UIRenderer.hideUpdatingBadge();
                }
            }, MAX_FETCH_TIME);
            try {
                let primaryText = null;
                try {
                    const sheetRes = await fetch(sheetUrlWithCache);
                    if (!sheetRes.ok) throw new Error('Failed to load Google Sheet');
                    primaryText = await sheetRes.text();
                } catch (sheetError) {
                    console.warn('Google Sheets failed, falling back to local file:', sheetError);
                    const localRes = await fetch(localUrl);
                    if (!localRes.ok) throw new Error('Failed to load local file');
                    primaryText = await localRes.text();
                }

                const lessons = [];
                const playlists = new Set();
                let globalIndex = 0;
                
                const processCSV = (text) => {
                    const rows = Utils.parseCSV(text);
                    rows.forEach((parts, index) => {
                        if (index === 0) {
                            const header = (parts[0] || '').toLowerCase();
                            if (header.includes('playlist')) return;
                        }
                        if (parts.length >= 3) {
                            const [playlist, title, videoId, pdfLink] = parts;
                            if (playlist && title) {
                                playlists.add(playlist);
                                lessons.push({
                                    id: `lesson_${globalIndex++}`,
                                    playlistId: playlist,
                                    playlist: Utils.formatPlaylistName(playlist),
                                    title,
                                    videoId: videoId?.length === 11 ? videoId : null,
                                    pdfLink: pdfLink && pdfLink !== 'none' ? pdfLink : null,
                                    language: Utils.getLanguage(playlist),
                                    thumbnail: videoId?.length === 11 ? Utils.getYouTubeThumbnail(videoId) : null,
                                    hasNotes: pdfLink && pdfLink !== 'none'
                                });
                            }
                        }
                    });
                };
                
                processCSV(primaryText);

                if (lessons.length === 0) return { success: false, updated: false };

                // Check if data differs from current AppState
                const currentDataStr = JSON.stringify(AppState.lessons);
                const newDataStr = JSON.stringify(lessons);

                let updated = false;
                if (currentDataStr !== newDataStr) {
                    console.log('New data found, updating...');
                    AppState.lessons = lessons;
                    AppState.playlists = Array.from(playlists).sort();
                    if(ViewManager && typeof ViewManager.renderCurrentView === 'function'){
                        ViewManager.renderCurrentView();
                    }
                    updated = true;
                    
                    // Save to cache
                    localStorage.setItem('epata_cached_lessons', newDataStr);

                    // If we already rendered (cache was loaded), re-render silently
                    if (isCachedLoaded) {
                        UIRenderer.populateFilters();
                        UIRenderer.populateDrawerCategories();
                        ViewManager.renderCurrentView();
                        UIRenderer.renderStats();
                    } else {
                        UIRenderer.populateFilters();
                        UIRenderer.populateDrawerCategories();
                        UIRenderer.renderQuickActions();
                        UIRenderer.renderStats();
                        ViewManager.renderCurrentView();
                    }
                }
                return { success: true, updated };
            } catch (error) {
                console.error('Error loading fresh data:', error);
                return { success: false, updated: false };
            } finally {
                if (!timeoutFired) {
                    clearTimeout(timeoutId);
                    activeFetches = Math.max(0, activeFetches - 1);
                    if (activeFetches === 0) {
                        UIRenderer.hideUpdatingBadge();
                    }
                }
            }
        };

        const scheduleBackgroundFetch = () => {
            const runFetch = () => {
                fetchFreshData().catch((error) => {
                    console.error('Error loading fresh data:', error);
                });
            };

            // Defer until after current render cycle
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => setTimeout(runFetch, 0));
            } else {
                setTimeout(runFetch, 0);
            }
        };

        // 3. Force refresh should block; otherwise always return immediately
        if (forceRefresh) {
            return await fetchFreshData();
        }

        scheduleBackgroundFetch();
        return { success: true, updated: false };
    },

    async loadResources() {
        if (!APP_CONFIG) return;
        const url = APP_CONFIG.app_urls;
        try {
            const response = await fetch(url + '&t=' + Date.now());
            if (!response.ok) return;
            const text = await response.text();
            const rows = Utils.parseCSV(text);
            
            if (rows.length < 2) return;
            
            // Headers: Date, App_name, app_url, user_guide
            const headers = rows[0].map(h => h.toLowerCase().trim());
            const dateIdx = headers.indexOf('date');
            const nameIdx = headers.indexOf('app_name');
            const urlIdx = headers.indexOf('app_url');
            const guideIdx = headers.indexOf('user_guide');
            
            if (nameIdx === -1) return;

            const resources = rows.slice(1).map(row => {
                if (!row[nameIdx]) return null;
                
                const dateStr = row[dateIdx] ? row[dateIdx].trim() : '';
                let timestamp = 0;
                if (dateStr) {
                    // Parse DD-MM-YYYY
                    const parts = dateStr.split(/[-/.]/);
                    if (parts.length === 3) {
                        timestamp = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
                    } else {
                        timestamp = Date.parse(dateStr) || 0;
                    }
                }
                
                return {
                    date: dateStr,
                    timestamp: timestamp,
                    name: row[nameIdx],
                    url: row[urlIdx],
                    guide: row[guideIdx]
                };
            }).filter(Boolean);
            
            // Sort descending by date (latest first)
            resources.sort((a, b) => b.timestamp - a.timestamp);
            AppState.resources = resources;
        } catch (e) {
            console.error('Error loading resources:', e);
        }
    },

    async loadQuizData() {
        if (!APP_CONFIG) return false;
        const url = APP_CONFIG.quiz;
        try {
            const response = await fetch(url + '&t=' + Date.now());
            if (!response.ok) throw new Error('Failed to load quiz');
            const text = await response.text();
            const rows = Utils.parseCSV(text);
            
            // Headers: Question, Option A, Option B, Option C, Option D, Answer, Explanation, QuizDate
            // Assuming row 0 is header
            const questions = rows.slice(1).map(row => {
                if (row.length < 6) return null;
                return {
                    question: row[0],
                    options: [row[1], row[2], row[3], row[4]],
                    answer: row[5], // Can be 'A', 'B' or full text
                    explanation: row[6] || '',
                    date: row[7] || ''
                };
            }).filter(q => q && q.question);

            if (questions.length > 0) {
                AppState.quiz.questions = questions;
                AppState.quiz.date = questions[0].date;
                AppState.quiz.loaded = true;
                return true;
            }
            return false;
        } catch (e) {
            console.error('Quiz load error:', e);
            return false;
        }
    },

    async loadDailyMessage() {
        if (!APP_CONFIG) return;
        const url = APP_CONFIG.welcome;
        try {
            // Add timestamp to avoid caching
            const response = await fetch(url + '&t=' + Date.now());
            if (!response.ok) return;
            const text = await response.text();
            const rows = Utils.parseCSV(text);
            
            if (rows.length < 2) return;
            
            // Normalize headers to find columns
            const headers = rows[0].map(h => h.toLowerCase().trim());
            const dateIdx = headers.indexOf('date');
            const msgIdx = headers.indexOf('message');
            
            if (dateIdx === -1 || msgIdx === -1) return;
            
            let latestDate = -1;
            let latestMsg = null;
            let latestDateStr = '';

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length <= Math.max(dateIdx, msgIdx)) continue;
                
                const dateStr = row[dateIdx].trim();
                const msg = row[msgIdx].trim();
                
                if (!dateStr || !msg) continue;
                
                // Try parsing date (Handle DD-MM-YYYY or standard formats)
                let timestamp = Date.parse(dateStr);
                if (isNaN(timestamp)) {
                    const parts = dateStr.split(/[-/.]/);
                    if (parts.length === 3) {
                        timestamp = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
                    }
                }

                if (!isNaN(timestamp) && timestamp > latestDate) {
                    latestDate = timestamp;
                    latestMsg = msg;
                    latestDateStr = dateStr;
                }
            }
            
            if (latestMsg) {
                UIRenderer.renderDailyMessage(latestMsg, latestDateStr);
            }
        } catch (e) {
            console.error('Error loading daily message:', e);
        }
    },

    // Backup User Data
    async backupData() {
        // Helper to get data safely
        const getLocal = (k) => localStorage.getItem(k);
        const getLocalJSON = (k) => {
            try { return JSON.parse(getLocal(k)); } catch(e){ return null; }
        };

        const data = {
            favorites: AppState.favorites,
            completed: AppState.completed,
            recent: AppState.recentlyWatched,
            
            // Extended Data (v2.0)
            enrolledCourse: getLocalJSON('epata_enrolled_course'),
            videoPositions: getLocalJSON('epata_video_positions') || {},
            theme: getLocal('epata_theme'),
            quiz: {
                score: getLocal('epata_quiz_score'),
                date: getLocal('epata_quiz_date'),
                completed: getLocal('epata_quiz_completed')
            },
            timestamp: new Date().toISOString(),
            version: '2.0'
        };
        
        const fileName = `epata_backup_${new Date().toISOString().slice(0,10)}.json`;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        
        // Try Web Share API first (Optimized for Android App/Mobile)
        try {
            const file = new File([blob], fileName, { type: 'application/json' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'e-PATA Backup',
                    text: 'e-PATA User Progress Backup'
                });
                return; // Share successful, stop here
            }
        } catch (e) {
            console.log('Web Share API skipped or cancelled, falling back to download');
        }

        // Fallback to classic download (Desktop / Chrome)
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Utils.showToast('Progress backed up successfully!');
    },

    // Restore User Data
    async restoreData(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (data.favorites && Array.isArray(data.favorites)) {
                AppState.favorites = data.favorites;
                Utils.saveToStorage('favorites', data.favorites);
            }
            if (data.completed && Array.isArray(data.completed)) {
                AppState.completed = data.completed;
                Utils.saveToStorage('completed', data.completed);
            }

            // Restore Extended Data (v2.0)
            if (data.enrolledCourse != null) {
                Utils.saveToStorage('enrolled_course', data.enrolledCourse);
            }

            if (data.videoPositions) {
                Utils.saveToStorage('video_positions', data.videoPositions);
            }

            if (data.theme) {
                localStorage.setItem('epata_theme', data.theme);
            }

            if (data.quiz) {
                if (data.quiz.score != null) localStorage.setItem('epata_quiz_score', data.quiz.score);
                if (data.quiz.date != null) localStorage.setItem('epata_quiz_date', data.quiz.date);
                if (data.quiz.completed != null) localStorage.setItem('epata_quiz_completed', data.quiz.completed);
            }
            
            Utils.showToast('Progress restored! Reloading...');
            setTimeout(() => window.location.reload(), 1500);
        } catch (e) {
            Utils.showToast('Invalid backup file', 'error');
            console.error(e);
        }
    },

    getLessonsByPlaylist(playlist) {
        return AppState.lessons.filter(l => l.playlistId === playlist);
    },

    getFilteredLessons() {
        let filtered = [...AppState.lessons];
        
        if (AppState.filters.playlist) {
            filtered = filtered.filter(l => l.playlistId === AppState.filters.playlist);
        }
        if (AppState.filters.language) {
            filtered = filtered.filter(l => l.language === AppState.filters.language);
        }
        if (AppState.searchQuery) {
            const query = AppState.searchQuery.toLowerCase();
            filtered = filtered.filter(l => 
                l.title.toLowerCase().includes(query) ||
                l.playlist.toLowerCase().includes(query)
            );
        }
        
        return filtered;
    },

    getFavoriteLessons() {
        return AppState.lessons.filter(l => AppState.favorites.includes(l.id));
    },

    getRecentLessons() {
        const recentIds = AppState.recentlyWatched.slice(0, 10);
        return recentIds.map(id => AppState.lessons.find(l => l.id === id)).filter(Boolean);
    },

    getLessonById(id) {
        return AppState.lessons.find(l => l.id === id);
    },

    toggleFavorite(lessonId) {
        const index = AppState.favorites.indexOf(lessonId);
        if (index > -1) {
            AppState.favorites.splice(index, 1);
            Utils.saveToStorage('favorites', AppState.favorites);
            return false;
        }
        AppState.favorites.push(lessonId);
        Utils.saveToStorage('favorites', AppState.favorites);
        return true;
    },

    toggleCompleted(lessonId) {
        const index = AppState.completed.indexOf(lessonId);
        if (index > -1) {
            AppState.completed.splice(index, 1);
            Utils.saveToStorage('completed', AppState.completed);
            return false;
        }
        AppState.completed.push(lessonId);
        Utils.saveToStorage('completed', AppState.completed);
        if(isEnrolledCourseCompleted()){
            const modal = document.getElementById('courseCompleteModal');
            if(modal) modal.style.display = 'flex';
        }
        return true;
    },

    addToRecent(lessonId) {
        const index = AppState.recentlyWatched.indexOf(lessonId);
        if (index > -1) AppState.recentlyWatched.splice(index, 1);
        AppState.recentlyWatched.unshift(lessonId);
        if (AppState.recentlyWatched.length > 20) AppState.recentlyWatched.pop();
        Utils.saveToStorage('recent', AppState.recentlyWatched);
    },

    getPlaylistProgress(playlist) {
        const lessons = this.getLessonsByPlaylist(playlist);
        const completed = lessons.filter(l => AppState.completed.includes(l.id)).length;
        return {
            total: lessons.length,
            completed,
            percent: lessons.length > 0 ? Math.round((completed / lessons.length) * 100) : 0
        };
    },

    getVideoPosition(lessonId) {
        const positions = JSON.parse(localStorage.getItem('epata_video_positions') || '{}');
        return positions[lessonId] || 0;
    },

    saveVideoPosition(lessonId, time) {
        const positions = JSON.parse(localStorage.getItem('epata_video_positions') || '{}');
        positions[lessonId] = Math.floor(time);
        localStorage.setItem('epata_video_positions', JSON.stringify(positions));
    },

    removeVideoPosition(lessonId) {
        const positions = JSON.parse(localStorage.getItem('epata_video_positions') || '{}');
        if (positions[lessonId]) {
            delete positions[lessonId];
            localStorage.setItem('epata_video_positions', JSON.stringify(positions));
        }
    },

    getContinueLesson() {
        return AppState.lessons.find(l => l.videoId && !AppState.completed.includes(l.id));
    },

    async loadUpdates() {
        if (!APP_CONFIG || !APP_CONFIG.updates) return;

        const container = document.getElementById("updatesContainer");
        if (!container) return;
        container.innerHTML = '<p class="loading-text">Loading updates...</p>';

        try {
            const res = await fetch(APP_CONFIG.updates + "&t=" + Date.now());
            const text = await res.text();

            // Use Utils.parseCSV for robust handling of quotes/commas
            const rows = Utils.parseCSV(text).slice(1); // Skip header

            let html = "";
            const today = new Date();

            rows.forEach(cols => {
                if (cols.length < 5) return;

                const status = cols[0]?.trim();
                // const batch = cols[1]?.trim();
                const date = cols[2]?.trim();
                const title = cols[3]?.trim();
                const message = cols[4]?.trim();
                const link = cols[5]?.trim();
                const expiry = cols[6]?.trim();

                if (status !== "ON") return;

                if (expiry) {
                    const expDate = new Date(expiry);
                    if (!isNaN(expDate) && today > expDate) return;
                }

                html += `
                <div class="update-card">
                    <div class="update-date"><i class="far fa-calendar-alt"></i> ${date}</div>
                    <div class="update-title">${title}</div>
                    <div class="update-message">${message}</div>
                    ${link ? `<a class="update-link" href="${link}" target="_blank">Open Link <i class="fas fa-external-link-alt"></i></a>` : ``}
                </div>
                `;
            });

            container.innerHTML = html || '<div class="empty-state"><p>No current updates.</p></div>';

        } catch (e) {
            container.innerHTML = "<p>Unable to load updates.</p>";
            console.error(e);
        }
    }
};

// ============================================
// UI RENDERERS
// ============================================
const UIRenderer = {
    renderWelcomeStats() {
        document.getElementById('welcomeProgress').textContent = getEnrolledCourseProgress() + "%";
    },

    renderQuickActions() {
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'continue') {
                    const nextLesson = getNextLessonForEnrolledCourse();
                    if(nextLesson){
                        AppActions.openVideo(nextLesson);
                        return;
                    }
                    const lesson = DataManager.getContinueLesson();
                    if (lesson) AppActions.openVideo(lesson);
                    else Utils.showToast('All lessons completed!');
                } else if (action === 'favorites') {
                    ViewManager.switchView('favorites');
                } else if (action === 'progress') {
                    ViewManager.switchView('progress');
                } else if (action === 'all') {
                    ViewManager.switchView('courses');
                }
            });
        });
    },

    renderContinueCard() {
        const section = document.getElementById('continueSection');
        const container = document.getElementById('continueCard');
        let lesson = DataManager.getContinueLesson();

        const enrolledNext = getNextLessonForEnrolledCourse();
        if(enrolledNext){
            lesson = enrolledNext;
        }
        
        if (!lesson) {
            section.style.display = 'none';
            document.getElementById('fab').classList.add('hidden');
            container.onclick = null;
            return;
        }
        
        section.style.display = 'block';
        document.getElementById('fab').classList.remove('hidden');
        
        const progress = DataManager.getPlaylistProgress(lesson.playlist);
        
        container.innerHTML = `
            <div class="continue-thumbnail">
                <img src="${lesson.thumbnail}" alt="" loading="lazy">
                <div class="continue-overlay">
                    <button class="continue-play-btn">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
            </div>
            <div class="continue-info">
                <h4>${lesson.title}</h4>
                <div class="continue-meta">
                    <span><i class="fas fa-list"></i> ${Utils.formatPlaylistName(lesson.playlist)}</span>
                    <span><i class="fas fa-globe"></i> ${Utils.getLanguageDisplay(lesson.playlist)}</span>
                </div>
                <div class="continue-progress">
                    <div class="continue-progress-bar">
                        <div class="continue-progress-fill" style="width: ${progress.percent}%"></div>
                    </div>
                    <span>${progress.percent}%</span>
                </div>
            </div>
        `;
        
        container.onclick = () => AppActions.openVideo(lesson);
        
        // FAB action
        document.getElementById('fab').onclick = () => AppActions.openVideo(lesson);
    },

    renderStats() {
        let syllabusLessons = [];

        if(AppState.enrolledCourse){

            // STUDY MODE → only enrolled course
            const course = AppState.coursesMeta.find(c => c.id === AppState.enrolledCourse);

            if(course){
                syllabusLessons = AppState.lessons.filter(l => l.playlistId === course.playlist);
            }

        }else{

            // CURRICULUM MODE → all courses
            const coursePlaylists = AppState.coursesMeta.map(c => c.playlist);
            syllabusLessons = AppState.lessons.filter(l => coursePlaylists.includes(l.playlistId));

        }

        // completed lessons inside current scope
        const syllabusCompleted = syllabusLessons.filter(l => AppState.completed.includes(l.id));

        const totalLessons = syllabusLessons.length;
        const doneLessons = syllabusCompleted.length;
        const progressPercent = totalLessons > 0 ? Math.round((doneLessons / totalLessons) * 100) : 0;
        
        document.getElementById('totalLessons').textContent = totalLessons;
        
        const nameEl = document.getElementById('activeCourseNameValue');
        const statusEl = document.getElementById('activeCourseStatus');

        if(nameEl && statusEl){

            if(AppState.enrolledCourse){

                const course = AppState.coursesMeta.find(c => c.id === AppState.enrolledCourse);

                nameEl.textContent = course ? course.name : "";
                statusEl.textContent = "Enrolled";
                statusEl.style.color = "var(--primary)";

            }else{

                nameEl.textContent = "";
                statusEl.textContent = "Not Enrolled";
                statusEl.style.color = "#d9534f";
            }
        }
        document.getElementById('completedLessons').textContent = doneLessons;
        document.getElementById('progressPercent').textContent = `${progressPercent}%`;
        document.getElementById('favCount').textContent = AppState.favorites.length;
        document.getElementById('drawerFavCount').textContent = AppState.favorites.length;

        const label = document.getElementById('activeCourseLabel');

        if(label){
            if(AppState.enrolledCourse){
                const course = AppState.coursesMeta.find(c => c.id === AppState.enrolledCourse);
                if(course){
                    label.textContent = "(" + course.name + ")";
                }else{
                    label.textContent = "";
                }
            }else{
                label.textContent = "No course enrolled";
            }
        }
    },

    renderFeaturedPlaylists() {
        const container = document.getElementById('featuredPlaylists');
        const featured = AppState.playlists.slice(0, 6);
        
        container.innerHTML = featured.map(playlist => {
            const lessons = DataManager.getLessonsByPlaylist(playlist);
            const progress = DataManager.getPlaylistProgress(playlist);
            
            const coursePlaylists = AppState.coursesMeta.map(c => c.playlist);
            const isCourse = coursePlaylists.includes(playlist);
            
            return `
                <div class="playlist-card" data-playlist="${playlist}">
                    <div class="playlist-header" style="background: ${Utils.getCategoryColor(playlist)}">
                        <div class="playlist-icon"><i class="fas ${Utils.getCategoryIcon(playlist)}"></i></div>
                        <div class="playlist-name">${Utils.formatPlaylistName(playlist)}</div>
                    </div>
                    <div class="playlist-body">
                        <div class="playlist-count"><i class="fas fa-video"></i> ${lessons.length} videos</div>
                        ${(isCourse && progress.percent > 0) ? `<div class="playlist-progress">${progress.percent}% complete</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        container.querySelectorAll('.playlist-card').forEach(card => {
            card.addEventListener('click', () => {
                AppState.filters.playlist = card.dataset.playlist;
                document.getElementById('playlistFilter').value = card.dataset.playlist;
                ViewManager.switchView('all');
            });
        });
    },

    renderRecentLessons() {
        const container = document.getElementById('recentLessons');
        const recent = AppState.lessons.slice(-8).reverse();
        
        container.innerHTML = recent.map(lesson => `
            <div class="lesson-card-small" data-id="${lesson.id}">
                <div class="lesson-thumb">
                    <img src="${lesson.thumbnail}" alt="" loading="lazy">
                    <div class="lesson-thumb-overlay">
                        <div class="play-btn-small"><i class="fas fa-play"></i></div>
                    </div>
                </div>
                <div class="lesson-info-small">
                    <div class="lesson-title-small">${lesson.title}</div>
                    <div class="lesson-meta-small">
                        <span>${Utils.formatPlaylistName(lesson.playlist)}</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        container.querySelectorAll('.lesson-card-small').forEach(card => {
            card.addEventListener('click', () => {
                const lesson = DataManager.getLessonById(card.dataset.id);
                if (lesson) AppActions.openVideo(lesson);
            });
        });
    },

    renderLessonCards(containerId, lessons, limit = null) {
        const container = document.getElementById(containerId);
        const displayLessons = limit ? lessons.slice(0, limit) : lessons;
        
        if (displayLessons.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        container.innerHTML = displayLessons.map(lesson => {
            const isCompleted = AppState.completed.includes(lesson.id);
            const isFavorite = AppState.favorites.includes(lesson.id);
            
            const coursePlaylists = AppState.coursesMeta.map(c => c.playlist);
            const isCourseVideo = coursePlaylists.includes(lesson.playlistId);
            const labelText = isCourseVideo ? "Lesson" : "Video";
            
            return `
                <div class="lesson-card ${isCompleted ? 'completed' : ''}" data-id="${lesson.id}">
                    <div class="lesson-thumbnail">
                        <img src="${lesson.thumbnail}" alt="" loading="lazy">
                        <div class="lesson-overlay">
                            <div class="play-icon"><i class="fas fa-play"></i></div>
                        </div>
                        ${lesson.hasNotes ? '<span class="lesson-badge"><i class="fas fa-file-pdf"></i></span>' : ''}
                    </div>
                    <div class="lesson-content">
                        <div class="lesson-card-title">${labelText}: ${lesson.title}</div>
                        <div class="lesson-card-meta">
                            <span class="lesson-playlist-name">${Utils.formatPlaylistName(lesson.playlist)}</span>
                            ${lesson.hasNotes ? '<span class="lesson-has-notes"><i class="fas fa-file-alt"></i></span>' : ''}
                        </div>
                    </div>
                    <div class="lesson-actions-row">
                        <button class="lesson-action-btn primary" onclick="event.stopPropagation(); AppActions.playVideo('${lesson.id}')">
                            <i class="fas fa-play"></i> Watch ${labelText}
                        </button>
                        <button class="lesson-action-btn favorite ${isFavorite ? 'active' : ''}" onclick="event.stopPropagation(); AppActions.toggleFavorite('${lesson.id}')">
                            <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>
                        </button>
                        ${lesson.pdfLink ? `
                            <a href="${lesson.pdfLink}" target="_blank" class="lesson-action-btn" onclick="event.stopPropagation()">
                                <i class="fas fa-file-pdf"></i>
                            </a>
                        ` : '<button class="lesson-action-btn" disabled><i class="fas fa-file-pdf"></i></button>'}
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click handlers for cards
        container.querySelectorAll('.lesson-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Don't trigger if clicking action buttons
                if (e.target.closest('.lesson-action-btn')) return;
                const lesson = DataManager.getLessonById(card.dataset.id);
                if (lesson) AppActions.openVideo(lesson);
            });
        });
    },

    renderProgressView() {
        // 1. Get playlists defined in courses.json
        const coursePlaylists = AppState.coursesMeta.map(c => c.playlist);
        
        // 2. Filter lessons to only include those in the official courses
        const courseLessons = AppState.lessons.filter(l => coursePlaylists.includes(l.playlistId) && l.videoId);
        
        // 3. Recalculate total progress based on course lessons only
        const total = courseLessons.length;
        const completed = courseLessons.filter(l => AppState.completed.includes(l.id)).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        // Update circle
        const circle = document.getElementById('progressCircle');
        const circumference = 2 * Math.PI * 42;
        const offset = circumference - (percent / 100) * circumference;
        if (circle) circle.style.strokeDashoffset = offset;
        
        document.getElementById('progressText').textContent = `${percent}%`;
        document.getElementById('progressCompleted').textContent = completed;
        document.getElementById('progressTotal').textContent = total;
        
        // Render by playlist
        const container = document.getElementById('progressByPlaylist');
        const progressData = coursePlaylists.map(p => ({
            playlist: p,
            ...DataManager.getPlaylistProgress(p)
        })).filter(p => p.total > 0).sort((a, b) => b.percent - a.percent);
        
        container.innerHTML = progressData.map(p => `
            <div class="progress-course-item">
                <div class="progress-course-header">
                    <span class="progress-course-name">${Utils.formatPlaylistName(p.playlist)}</span>
                    <span class="progress-course-percent">${p.percent}%</span>
                </div>
                <div class="progress-course-bar">
                    <div class="progress-course-fill" style="width: ${p.percent}%"></div>
                </div>
                <div class="progress-course-count">${p.completed} of ${p.total} lessons</div>
            </div>
        `).join('');
    },

    populateFilters() {
        const select = document.getElementById('playlistFilter');
        select.innerHTML = '<option value="">All Courses</option>' +
            AppState.playlists.map(p => `<option value="${p}">${Utils.formatPlaylistName(p)}</option>`).join('');
    },

    populateDrawerCategories() {
        const container = document.getElementById('drawerCategoryMenu');
        const categories = {};
        
        AppState.playlists.forEach(p => {
            const name = p.toLowerCase();
            let cat = 'Other';
            if (name.includes('jyotisha')) cat = 'Jyotisha';
            else if (name.includes('mana')) cat = 'Mana Shastra';
            else if (name.includes('prashna')) cat = 'Prashna';
            else if (name.includes('app')) cat = 'Apps';
            
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(p);
        });
        
        container.innerHTML = Object.entries(categories).map(([cat, playlists]) => `
            <li class="drawer-item" data-category="${cat}" data-playlist="${playlists[0]}">
                <i class="fas ${this.getCategoryIcon(cat)}"></i>
                <span>${cat}</span>
                <span class="drawer-badge">${playlists.length}</span>
            </li>
        `).join('');
        
        container.querySelectorAll('.drawer-item').forEach(item => {
            item.addEventListener('click', () => {
                AppState.filters.playlist = item.dataset.playlist;
                document.getElementById('playlistFilter').value = item.dataset.playlist;
                ViewManager.switchView('all');
                UIControllers.closeDrawer();
            });
        });
    },

    renderDailyMessage(message, date) {
        const container = document.getElementById('dailyMessageCard');
        const textEl = document.getElementById('dailyMessageText');
        const dateEl = document.getElementById('dailyMessageDate');
        
        if (container && textEl) {
            textEl.innerHTML = message.replace(/\n/g, '<br>'); // Support multiline messages
            if (dateEl) dateEl.textContent = date;
            container.style.display = 'flex';
        }
    },

    getCategoryIcon(category) {
        const icons = {
            'Jyotisha': 'fa-star',
            'Mana Shastra': 'fa-brain',
            'Prashna': 'fa-question-circle',
            'Apps': 'fa-mobile-alt',
            'Other': 'fa-book'
        };
        return icons[category] || 'fa-book';
    }
};

function renderEnrollCourses(){
    const container = document.getElementById('coursesContainer');
    if(!container) return;

    const displayCourses = AppState.coursesMeta.filter(c => c.course_type === 'Lessons');

    if(!displayCourses.length){
        container.innerHTML = "<p>No courses available</p>";
        return;
    }

    container.innerHTML = '';

    displayCourses.forEach(course=>{
        const enrolled = AppState.enrolledCourse === course.id;

        const div = document.createElement('div');
        div.className = 'course-card';

        div.innerHTML = `
            <h3>${course.name}</h3>
            <p>${course.description}</p>
            <button class="enroll-btn" data-id="${course.id}">
                ${enrolled ? "Enrolled ✓" : "Enroll"}
            </button>
        `;

        container.appendChild(div);
    });

    document.querySelectorAll('.enroll-btn').forEach(btn=>{
        btn.addEventListener('click', ()=>{
            enrollCourse(btn.dataset.id);
        });
    });
}

let pendingCourseSwitch = null;

function enrollCourse(courseId){
    if(AppState.enrolledCourse && AppState.enrolledCourse !== courseId){
        pendingCourseSwitch = courseId;
        const modal = document.getElementById('switchCourseModal');
        if(modal) modal.style.display = 'flex';
        return;
    }
    AppState.enrolledCourse = courseId;
    localStorage.setItem('epata_enrolled_course', JSON.stringify(courseId));
    Utils.showToast("Course Enrolled Successfully!");
    renderEnrollCourses();
    ViewManager.renderCurrentView();
}

function getEnrolledCourseProgress(){
    if(!AppState.enrolledCourse) return 0;

    const course = AppState.coursesMeta.find(c=>c.id===AppState.enrolledCourse);
    if(!course) return 0;

    const lessons = AppState.lessons.filter(l=>l.playlistId===course.playlist);
    const completed = lessons.filter(l=>AppState.completed.includes(l.id));

    if(!lessons.length) return 0;
    return Math.round((completed.length/lessons.length)*100);
}

function getNextLessonForEnrolledCourse(){
    if(!AppState.enrolledCourse) return null;

    const course = AppState.coursesMeta.find(c=>c.id===AppState.enrolledCourse);
    if(!course) return null;

    const lessons = AppState.lessons
        .filter(l => l.playlistId === course.playlist)
        .sort((a,b)=>{
            const na = parseInt(a.title);
            const nb = parseInt(b.title);
            return na - nb;
        });

    for(const lesson of lessons){
        if(!AppState.completed.includes(lesson.id)){
            return lesson;
        }
    }

    return null;
}

function isEnrolledCourseCompleted(){
    if(!AppState.enrolledCourse) return false;

    const course = AppState.coursesMeta.find(c=>c.id===AppState.enrolledCourse);
    if(!course) return false;

    const lessons = AppState.lessons.filter(l => l.playlistId === course.playlist);
    if(!lessons.length) return false;

    return lessons.every(l => AppState.completed.includes(l.id));
}

function renderTodayLesson(){
    if(!AppState.enrolledCourse) return;

    const nextLesson = getNextLessonForEnrolledCourse();
    if(!nextLesson) return;

    const card = document.getElementById('todayLessonCard');
    const title = document.getElementById('todayLessonTitle');

    if(card && title){
        title.textContent = nextLesson.title;
        card.style.display = 'block';

        const btn = document.getElementById('startTodayLesson');
        btn.onclick = () => {
            AppActions.openVideo(nextLesson);
        };
    }
}

// ============================================
// VIEW MANAGER
// ============================================
const ViewManager = {
    views: {},
    navigate(view) {
        this.switchView(view);
    },
    switchView(viewName) {
        // Update nav items
        document.querySelectorAll('.bottom-nav-item, .drawer-item, .nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });
        
        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
        
        // Show selected
        const selected = document.getElementById(`${viewName}View`);
        if (selected) selected.classList.remove('hidden');
        
        // Update title
        const titles = {
            dashboard: 'Dashboard',
            courses: 'All Courses',
            all: 'All Videos',
            favorites: 'Favorites',
            progress: 'Progress',
            quiz: 'Daily Quiz',
            recent: 'Recent',
            donate: 'Support Us',
            resources: 'Resources',
            updates: 'Latest News'
        };
        const titleEl = document.getElementById('pageTitle');
        if (titleEl) titleEl.textContent = titles[viewName] || 'Dashboard';
        
        AppState.currentView = viewName;
        this.renderCurrentView();
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    renderCurrentView() {
        if (this.views[AppState.currentView]) {
            this.views[AppState.currentView]();
            return;
        }

        switch (AppState.currentView) {
            case 'dashboard':
                UIRenderer.renderWelcomeStats();
                UIRenderer.renderContinueCard();
                UIRenderer.renderStats();
                UIRenderer.renderFeaturedPlaylists();
                UIRenderer.renderRecentLessons();
                renderEnrollCourses();
                renderTodayLesson();
                break;
            case 'all':
                this.renderCoursesView();
                break;
            case 'favorites':
                this.renderFavoritesView();
                break;
            case 'progress':
                UIRenderer.renderProgressView();
                break;
            case 'quiz':
                QuizController.init();
                break;
            case 'recent':
                this.renderRecentView();
                break;
            case 'resources':
                this.renderResourcesView();
                break;
            case 'updates':
                DataManager.loadUpdates();
                break;
            case 'donate':
                // Donate view is static, no dynamic rendering needed
                break;
        }
    },

    renderCoursesView() {
        const playlistDropdown = document.getElementById('playlistFilter');
        const languageDropdown = document.getElementById('languageFilter');

        // sync dropdown with course selection
        if(AppState.selectedCourse){
            playlistDropdown.value = AppState.selectedCourse;
        } else {
            AppState.selectedCourse = playlistDropdown.value;
        }

        let lessonsToShow = AppState.lessons;

        // filter by playlist/course
        if(AppState.selectedCourse && AppState.selectedCourse !== "all"){
            lessonsToShow = lessonsToShow.filter(
                l => l.playlistId === AppState.selectedCourse
            );
        }

        // filter by language
        if(languageDropdown.value && languageDropdown.value !== "all"){
            lessonsToShow = lessonsToShow.filter(
                l => l.language === languageDropdown.value
            );
        }

        // filter by search
        if (AppState.searchQuery) {
            const query = AppState.searchQuery.toLowerCase();
            lessonsToShow = lessonsToShow.filter(l => 
                l.title.toLowerCase().includes(query) ||
                l.playlist.toLowerCase().includes(query)
            );
        }

        const container = document.getElementById('lessonsContainer');
        const resultsCount = document.getElementById('resultsCount');
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        
        resultsCount.textContent = `${lessonsToShow.length} lesson${lessonsToShow.length !== 1 ? 's' : ''}`;
        
        if (lessonsToShow.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1;">
                    <div class="empty-icon"><i class="fas fa-search"></i></div>
                    <h3>No lessons found</h3>
                    <p>Try adjusting your filters</p>
                </div>
            `;
            loadMoreContainer.style.display = 'none';
            return;
        }
        
        const displayLessons = lessonsToShow.slice(0, AppState.displayCount);
        UIRenderer.renderLessonCards('lessonsContainer', displayLessons);
        
        // Show/hide load more
        loadMoreContainer.style.display = lessonsToShow.length > AppState.displayCount ? 'block' : 'none';
    },

    renderFavoritesView() {
        const lessons = DataManager.getFavoriteLessons();
        const emptyState = document.getElementById('favEmptyState');
        const container = document.getElementById('favoritesContainer');
        
        if (lessons.length === 0) {
            emptyState.style.display = 'block';
            container.innerHTML = '';
        } else {
            emptyState.style.display = 'none';
            UIRenderer.renderLessonCards('favoritesContainer', lessons);
        }
    },

    renderRecentView() {
        const lessons = DataManager.getRecentLessons();
        const emptyState = document.getElementById('recentEmptyState');
        const container = document.getElementById('recentContainer');
        
        if (lessons.length === 0) {
            emptyState.style.display = 'block';
            container.innerHTML = '';
        } else {
            emptyState.style.display = 'none';
            UIRenderer.renderLessonCards('recentContainer', lessons);
        }
    },

    renderResourcesView() {
        const container = document.getElementById('resourcesContainer');
        if (!container) return;
        
        // Reset container class
        container.className = 'resources-container';

        if (AppState.resources.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon"><i class="fas fa-tools"></i></div>
                    <h3>Loading Resources...</h3>
                </div>
            `;
            // Try loading if empty
            DataManager.loadResources().then(() => {
                if (AppState.resources.length > 0) this.renderResourcesView();
                else container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon"><i class="fas fa-exclamation-circle"></i></div>
                        <h3>No resources found</h3>
                    </div>`;
            });
            return;
        }

        let html = `
            <div class="resources-table-wrapper">
                <table class="resources-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>App Name</th>
                            <th>Action</th>
                            <th>Guide</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        AppState.resources.forEach(res => {
            html += `
                <tr>
                    <td class="res-date">${res.date}</td>
                    <td class="res-name">${res.name}</td>
                    <td class="res-action">
                        ${res.url ? `
                            <button class="res-btn launch" onclick="AppActions.openResource('${res.url}', '${res.name.replace(/'/g, "\\'")}')">
                                <i class="fas fa-rocket"></i> Launch
                            </button>
                        ` : '-'}
                    </td>
                    <td class="res-guide">
                        ${res.guide ? `
                            <a href="${res.guide}" target="_blank" class="res-btn pdf">
                                <i class="fas fa-file-pdf"></i> PDF
                            </a>
                        ` : ''}
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }
};

ViewManager.views.courses = function(){

    const container = document.getElementById('coursesView');
    container.innerHTML = '';

    const now = Date.now();
    const live = [];
    const future = [];
    const offline = [];

    AppState.coursesMeta.forEach(c => {
        const start = parseFlexibleDate(c.start_date);
        const end = parseFlexibleDate(c.end_date);
        
        if (start && now < start) {
            future.push(c);
        } else if (end && now > end) {
            offline.push(c);
        } else {
            live.push(c);
        }
    });

    const renderSection = (title, courses) => {
        if (!courses.length) return;

        const header = document.createElement('h2');
        header.textContent = title;
        header.style.margin = "20px 16px 10px";
        header.style.fontSize = "18px";
        header.style.color = "var(--primary)";
        container.appendChild(header);

        const list = document.createElement('div');
        list.className = "course-list";

        courses.forEach(course => {
            const card = document.createElement('div');
            card.className = "course-card";

            let subText = "Tap to open lessons";
            if (title === "Future Courses" && course.start_date) subText = `Starts: ${course.start_date}`;
            if (title === "Completed Courses" && course.end_date) subText = `Ended: ${course.end_date}`;

            card.innerHTML = `
                <div class="course-icon">🎓</div>
                <div class="course-title">${course.name}</div>
                <div class="course-sub">${subText}</div>
            `;

            card.onclick = () => {
                AppState.selectedCourse = course.playlist;
                AppState.selectedLanguage = "all";
                ViewManager.navigate('all');
            };

            list.appendChild(card);
        });
        container.appendChild(list);
    };

    renderSection("Live Courses", live);
    renderSection("Future Courses", future);
    renderSection("Completed Courses", offline);

    if (!live.length && !future.length && !offline.length) {
        container.innerHTML = '<div class="empty-state"><p>No courses available</p></div>';
    }
};

// ============================================
// QUIZ CONTROLLER
// ============================================
const QuizController = {
    async init() {
        const container = document.getElementById('quizWrapper');
        
        if (!AppState.quiz.loaded) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="pull-spinner" style="font-size: 30px; color: var(--primary); margin-bottom: 16px;"><i class="fas fa-spinner"></i></div>
                    <h3>Loading Quiz...</h3>
                </div>`;
            
            const success = await DataManager.loadQuizData();
            if (!success) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
                        <h3>Quiz Unavailable</h3>
                        <p>Please check your internet connection.</p>
                        <button class="empty-action-btn" onclick="QuizController.init()">Retry</button>
                    </div>`;
                return;
            }
        }
        
        // Reset state if starting fresh
        if (AppState.quiz.current === 0 && AppState.quiz.score === 0) {
            this.renderQuestion();
        } else {
            this.renderQuestion(); // Resume or show current state
        }
    },

    renderQuestion() {
        const container = document.getElementById('quizWrapper');
        const qData = AppState.quiz.questions[AppState.quiz.current];
        const total = AppState.quiz.questions.length;
        
        if (!qData) {
            this.renderResult();
            return;
        }

        container.innerHTML = `
            <div class="quiz-header-card">
                <div class="quiz-date"><i class="far fa-calendar-alt"></i> ${AppState.quiz.date || 'Today'}</div>
                <div class="quiz-progress-text">Question ${AppState.quiz.current + 1} / ${total}</div>
            </div>
            <div class="question-card">
                <div class="question-text">${qData.question}</div>
                <div class="options-grid" id="optionsGrid">
                    ${qData.options.map((opt, idx) => `
                        <button class="option-btn" onclick="QuizController.handleAnswer(${idx})">
                            ${opt}
                        </button>
                    `).join('')}
                </div>
                <div id="explanationContainer"></div>
                <div class="quiz-footer" id="quizFooter" style="display:none;">
                    <button class="quiz-next-btn" onclick="QuizController.nextQuestion()">
                        ${AppState.quiz.current + 1 === total ? 'Finish Quiz' : 'Next Question'} <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;
    },

    handleAnswer(selectedIndex) {
        const qData = AppState.quiz.questions[AppState.quiz.current];
        const optionsGrid = document.getElementById('optionsGrid');
        const buttons = optionsGrid.querySelectorAll('.option-btn');
        const explanationContainer = document.getElementById('explanationContainer');
        const quizFooter = document.getElementById('quizFooter');

        // Determine correct index
        // Answer column might be "A", "B", "C", "D" or the full text
        let correctIndex = -1;
        const ans = qData.answer.trim().toUpperCase();
        if (['A', 'B', 'C', 'D'].includes(ans)) {
            correctIndex = ans.charCodeAt(0) - 65;
        } else {
            // Try to match text
            correctIndex = qData.options.findIndex(opt => opt.trim().toLowerCase() === qData.answer.trim().toLowerCase());
        }

        // Disable all buttons
        buttons.forEach((btn, idx) => {
            btn.disabled = true;
            if (idx === correctIndex) btn.classList.add('correct');
            else if (idx === selectedIndex) btn.classList.add('wrong');
        });

        if (selectedIndex === correctIndex) AppState.quiz.score++;

        // Show explanation
        if (qData.explanation) {
            explanationContainer.innerHTML = `<div class="explanation-box"><strong>Explanation:</strong> ${qData.explanation}</div>`;
        }

        quizFooter.style.display = 'flex';
    },

    nextQuestion() {
        AppState.quiz.current++;
        if (AppState.quiz.current >= AppState.quiz.questions.length) {
            this.renderResult();
        } else {
            this.renderQuestion();
        }
    },

    renderResult() {
        const container = document.getElementById('quizWrapper');
        const total = AppState.quiz.questions.length;
        const score = AppState.quiz.score;
        const percent = Math.round((score / total) * 100);
        
        let message = 'Good Effort!';
        if (percent >= 80) message = 'Excellent!';
        else if (percent >= 50) message = 'Well Done!';

        container.innerHTML = `
            <div class="question-card quiz-result-card">
                <div class="stat-icon purple" style="margin: 0 auto 20px; width: 80px; height: 80px; font-size: 32px;">
                    <i class="fas fa-trophy"></i>
                </div>
                <h2>Quiz Completed</h2>
                <p style="margin-bottom: 20px; color: var(--text-secondary);">${message}</p>
                
                <div style="font-size: 48px; font-weight: 700; color: var(--primary); margin-bottom: 8px;">
                    ${score} / ${total}
                </div>
                <div style="font-size: 18px; color: var(--text-secondary); margin-bottom: 30px;">
                    ${percent}% Score
                </div>

                <button class="quiz-restart-btn" style="margin: 0 auto;" onclick="QuizController.restart()">
                    <i class="fas fa-redo"></i> Restart Quiz
                </button>
            </div>
        `;
    },

    restart() {
        AppState.quiz.current = 0;
        AppState.quiz.score = 0;
        this.renderQuestion();
    }
};

// ============================================
// APP ACTIONS
// ============================================
const AppActions = {
    openVideo(lesson) {
        if (!lesson.videoId) {
            Utils.showToast('No video available', 'error');
            return;
        }
        
        AppState.currentVideo = lesson;
        
        const modal = document.getElementById('videoModal');
        const videoContainer = document.getElementById('videoContainer');
        const title = document.getElementById('videoTitle');
        const playlist = document.getElementById('videoPlaylist');
        const language = document.getElementById('videoLanguage');
        const pdfLink = document.getElementById('pdfLink');
        const pdfDownload = document.getElementById('pdfDownload');
        const markBtn = document.getElementById('markCompleteBtn');
        const favBtn = document.getElementById('addFavBtn');
        
        // Dynamically create iframe to optimize performance
        videoContainer.innerHTML = ''; // Clear any existing content
        
        // 1. Load YouTube API if missing
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        }

        const iframe = document.createElement('iframe');
        iframe.id = 'epata-video-frame';
        // 2. Enable JS API
        iframe.src = `https://www.youtube.com/embed/${lesson.videoId}?autoplay=1&rel=0&enablejsapi=1`;
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
        iframe.setAttribute('allowfullscreen', '');
        videoContainer.appendChild(iframe);
        
        // 3. Initialize Player Wrapper
        const initPlayer = () => {
            if (!document.getElementById('epata-video-frame')) return; // Safety check if modal closed
            this.player = new YT.Player('epata-video-frame', {
                events: {
                    'onReady': (e) => {
                        this.player = e.target;
                        this.hasResumed = false;
                    },
                    'onStateChange': (e) => this.handlePlayerState(e, lesson.id)
                }
            });
        };

        if (window.YT && window.YT.Player) {
            initPlayer();
        } else {
            window.onYouTubeIframeAPIReady = initPlayer;
        }
        
        title.textContent = lesson.title;
        playlist.innerHTML = `<i class="fas fa-list"></i> ${Utils.formatPlaylistName(lesson.playlist)}`;
        language.innerHTML = `<i class="fas fa-globe"></i> ${Utils.getLanguageDisplay(lesson.playlist)}`;
        
        if (lesson.pdfLink) {
            pdfLink.href = lesson.pdfLink;
            pdfLink.style.display = 'flex';
            pdfDownload.href = lesson.pdfLink;
            pdfDownload.style.display = 'flex';
        } else {
            pdfLink.style.display = 'none';
            pdfDownload.style.display = 'none';
        }
        
        const coursePlaylists = AppState.coursesMeta.map(c => c.playlist);
        const isCourseVideo = coursePlaylists.includes(lesson.playlistId);
        const isFavorite = AppState.favorites.includes(lesson.id);
        
        favBtn.innerHTML = `<i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i><span>${isFavorite ? 'Saved' : 'Save'}</span>`;
        favBtn.classList.toggle('active', isFavorite);
        
        if (isCourseVideo) {
            const isCompleted = AppState.completed.includes(lesson.id);
            markBtn.style.display = 'flex';
            markBtn.innerHTML = `<i class="fas ${isCompleted ? 'fa-check-circle' : 'fa-check'}"></i><span>${isCompleted ? 'Completed' : 'Complete'}</span>`;
            markBtn.classList.toggle('primary', isCompleted);
        } else {
            markBtn.style.display = 'none';
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        DataManager.addToRecent(lesson.id);
        
        // Button handlers
        markBtn.onclick = isCourseVideo ? () => {
            const completed = DataManager.toggleCompleted(lesson.id);
            markBtn.innerHTML = `<i class="fas ${completed ? 'fa-check-circle' : 'fa-check'}"></i><span>${completed ? 'Completed' : 'Complete'}</span>`;
            markBtn.classList.toggle('primary', completed);
            Utils.showToast(completed ? 'Marked complete!' : 'Removed from completed');
            UIRenderer.renderStats();
        } : null;
        
        favBtn.onclick = () => {
            const favorited = DataManager.toggleFavorite(lesson.id);
            favBtn.innerHTML = `<i class="${favorited ? 'fas' : 'far'} fa-heart"></i><span>${favorited ? 'Saved' : 'Save'}</span>`;
            favBtn.classList.toggle('active', favorited);
            Utils.showToast(favorited ? 'Added to favorites!' : 'Removed from favorites');
            UIRenderer.renderStats();
        };
        
        // Share button
        document.getElementById('shareBtn').onclick = () => {
            document.getElementById('shareModal').classList.add('active');
        };
    },

    playVideo(lessonId) {
        const lesson = DataManager.getLessonById(lessonId);
        if (lesson) this.openVideo(lesson);
    },

    toggleFavorite(lessonId) {
        const favorited = DataManager.toggleFavorite(lessonId);
        Utils.showToast(favorited ? 'Added to favorites!' : 'Removed from favorites');
        UIRenderer.renderStats();
        
        // Re-render if needed
        if (AppState.currentView === 'favorites') ViewManager.renderFavoritesView();
        else if (AppState.currentView === 'courses') ViewManager.renderCoursesView();
        
        // Update button in modal if open
        if (AppState.currentVideo?.id === lessonId) {
            const favBtn = document.getElementById('addFavBtn');
            favBtn.innerHTML = `<i class="${favorited ? 'fas' : 'far'} fa-heart"></i><span>${favorited ? 'Saved' : 'Save'}</span>`;
            favBtn.classList.toggle('active', favorited);
        }
    },

    closeVideoModal() {
        this.stopSaveTimer(); // Stop saving
        if (this.player && typeof this.player.destroy === 'function') {
            this.player.destroy(); // Cleanup player
            this.player = null;
        }

        const modal = document.getElementById('videoModal');
        const videoContainer = document.getElementById('videoContainer');
        
        // Remove iframe from DOM to stop video and free memory
        if (videoContainer) videoContainer.innerHTML = '';
        
        modal.classList.remove('active');
        document.body.style.overflow = '';
        AppState.currentVideo = null;
    },

    openResource(url, title) {
        const modal = document.getElementById('resourceModal');
        const frame = document.getElementById('resourceFrame');
        const titleEl = document.getElementById('resourceTitle');
        
        if (modal && frame) {
            titleEl.textContent = title;
            frame.src = url;
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    closeResourceModal() {
        const modal = document.getElementById('resourceModal');
        const frame = document.getElementById('resourceFrame');
        
        if (modal) {
            modal.classList.remove('active');
            if (frame) frame.src = ''; // Clear src to stop loading
            document.body.style.overflow = '';
        }
    },

    // ============================================
    // PLAYER HELPERS
    // ============================================
    resumeVideoPosition(lessonId) {
        const pos = DataManager.getVideoPosition(lessonId);
        if (pos > 10) {
            setTimeout(() => {
                if (this.player && typeof this.player.seekTo === 'function') {
                    this.player.seekTo(pos, true);
                    Utils.showToast('Resumed from ' + Math.floor(pos/60) + ':' + ('0'+Math.floor(pos%60)).slice(-2));
                }
            }, 1000);
        }
    },

    handlePlayerState(event, lessonId) {
        if (event.data === YT.PlayerState.PLAYING) {
            if (!this.hasResumed) {
                this.resumeVideoPosition(lessonId);
                this.hasResumed = true;
            }
            this.startSaveTimer(lessonId);
        } else {
            this.stopSaveTimer();
        }
        if (event.data === YT.PlayerState.ENDED) {
            DataManager.removeVideoPosition(lessonId);
        }
    },

    startSaveTimer(lessonId) {
        this.stopSaveTimer();
        this.saveInterval = setInterval(() => {
            if (this.player && typeof this.player.getCurrentTime === 'function') {
                const time = this.player.getCurrentTime();
                const duration = this.player.getDuration();
                // Reset rule: > 90% complete
                if (duration > 0 && (time / duration) >= 0.9) {
                    DataManager.removeVideoPosition(lessonId);
                } else {
                    DataManager.saveVideoPosition(lessonId, time);
                }
            }
        }, 5000); // Save every 5s
    },

    stopSaveTimer() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
    },

    toggleTheme() {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('epata_theme', isDark ? 'dark' : 'light');
        
        document.querySelectorAll('#themeToggle i, #themeToggleDesktop i, #themeToggleMobile i').forEach(icon => {
            icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        });
        
        document.querySelectorAll('#themeToggleDesktop span, #themeToggleMobile span').forEach(span => {
            span.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        });
    }
};

// ============================================
// UI CONTROLLERS
// ============================================
const UIControllers = {
    init() {
        this.initSearch();
        this.initFilters();
        this.initNavigation();
        this.initDrawer();
        this.initShareModal();
        this.initPrivacyModal();
        this.initPullToRefresh();
        this.initLoadMore();
        this.initNetworkStatus();
        this.initDonatePage();
        this.initDataManagement();
        this.initInstallApp();
        this.initSupportTabs();
    },

    switchSupportLang(lang, btn) {
        // Hide all containers
        ['en', 'kn', 'te'].forEach(l => {
            const el = document.getElementById(`support-${l}`);
            if (el) el.style.display = 'none';
        });

        // Show selected container
        const selected = document.getElementById(`support-${lang}`);
        if (selected) selected.style.display = 'block';

        // Highlight active button
        if (btn) {
            const buttons = btn.parentElement.querySelectorAll('button');
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        }
    },

    initSupportTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        const contents = document.querySelectorAll('.support-language');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs
                tabs.forEach(t => t.classList.remove('active'));
                // Add active to clicked
                tab.classList.add('active');

                // Hide all contents
                contents.forEach(c => c.style.display = 'none');

                // Show target
                const lang = tab.dataset.lang;
                const target = document.getElementById(`support-${lang}`);
                if (target) {
                    target.style.display = 'block';
                }
            });
        });
    },


    initDonatePage() {
        // Copy UPI button
        const copyUpiBtn = document.getElementById('copyUpiBtn');
        if (copyUpiBtn) {
            copyUpiBtn.addEventListener('click', async () => {
                const upiNumber = '9482094290';
                try {
                    await navigator.clipboard.writeText(upiNumber);
                    Utils.showToast('UPI number copied!');
                } catch (err) {
                    // Fallback
                    const input = document.createElement('input');
                    input.value = upiNumber;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand('copy');
                    document.body.removeChild(input);
                    Utils.showToast('UPI number copied!');
                }
            });
        }
    },

    initInstallApp() {
        const installBtnDesktop = document.getElementById('installAppBtnDesktop');
        const installBtnMobile = document.getElementById('installAppBtnMobile');
        const installModal = document.getElementById('installModal');
        const closeInstallModal = document.getElementById('closeInstallModal');
        const androidBtn = document.getElementById('installAndroidBtn');
        const iosBtn = document.getElementById('installIOSBtn');
        const iosInstructions = document.getElementById('iosInstructions');
        const alreadyInstalledMsg = document.getElementById('alreadyInstalledMsg');

        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            console.log("Running as installed app");
            if (installBtnDesktop) installBtnDesktop.style.display = 'none';
            if (installBtnMobile) installBtnMobile.style.display = 'none';
        }

        // Detect iOS (iPhone, iPad, iPod) including iPads with OS 13+ (MacIntel)
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        const openModal = () => {
            installModal?.classList.add('active');
            UIControllers.closeDrawer();
            
            // Check if running in standalone mode (Already Installed)
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                                 window.navigator.standalone === true;

            if (isStandalone) {
                if (androidBtn) androidBtn.style.display = 'none';
                if (iosBtn) iosBtn.style.display = 'none';
                if (iosInstructions) iosInstructions.style.display = 'none';
                if (alreadyInstalledMsg) alreadyInstalledMsg.style.display = 'block';
                return;
            } else {
                if (alreadyInstalledMsg) alreadyInstalledMsg.style.display = 'none';
            }
            
            // Toggle buttons based on OS
            if (isIOS) {
                if (androidBtn) androidBtn.style.display = 'none';
                if (iosBtn) iosBtn.style.display = 'flex';
            } else {
                if (androidBtn) androidBtn.style.display = 'flex';
                if (iosBtn) iosBtn.style.display = 'none';
            }
            
            // Reset instructions visibility
            if (iosInstructions) iosInstructions.style.display = 'none';
        };

        installBtnDesktop?.addEventListener('click', openModal);
        installBtnMobile?.addEventListener('click', openModal);

        const closeModal = () => {
            installModal?.classList.remove('active');
            // Save dismissal time to prevent immediate popup on next reload
            localStorage.setItem('epata_install_dismissed', Date.now().toString());
        };

        closeInstallModal?.addEventListener('click', closeModal);

        installModal?.addEventListener('click', (e) => {
            if (e.target === installModal) closeModal();
        });

    
        androidBtn?.addEventListener('click', async () => {

            if (!deferredPrompt) {
                Utils.showToast('Preparing install… please wait a few seconds and try again.', 'info');
                return;
            }

            // Show real install dialog
            deferredPrompt.prompt();

            const choiceResult = await deferredPrompt.userChoice;

            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted install');
            } else {
                console.log('User dismissed install');
            }

            deferredPrompt = null;
            installModal?.classList.remove('active');
       });

       // iOS Button Logic
       iosBtn?.addEventListener('click', () => {
           if (iosInstructions) {
               iosInstructions.style.display = 'block';
               iosInstructions.scrollIntoView({ behavior: 'smooth' });
           }
       });

    },

    initDataManagement() {
        const restoreInput = document.getElementById('restoreInput');

        document.querySelectorAll('.backup-btn').forEach(btn => {
            btn.addEventListener('click', () => DataManager.backupData());
        });

        document.querySelectorAll('.restore-btn').forEach(btn => {
            btn.addEventListener('click', () => restoreInput && restoreInput.click());
        });

        if (restoreInput) {
            restoreInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    DataManager.restoreData(e.target.files[0]);
                }
                e.target.value = ''; // Reset
            });
        }
    },

    initSearch() {
        // Mobile search toggle
        const searchToggle = document.getElementById('searchToggle');
        const searchContainer = document.getElementById('searchBarContainer');
        const searchInput = document.getElementById('searchInput');
        const searchClear = document.getElementById('searchClear');
        
        searchToggle.addEventListener('click', () => {
            searchContainer.classList.toggle('active');
            if (searchContainer.classList.contains('active')) {
                searchInput.focus();
            }
        });
        
        searchInput.addEventListener('input', Utils.debounce((e) => {
            AppState.searchQuery = e.target.value;
            searchClear.classList.toggle('visible', e.target.value.length > 0);
            
            if (AppState.currentView !== 'all') {
                ViewManager.switchView('all');
            } else {
                ViewManager.renderCoursesView();
            }
        }, 300));
        
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            AppState.searchQuery = '';
            searchClear.classList.remove('visible');
            ViewManager.renderCoursesView();
        });
        
        // Desktop search
        const desktopSearch = document.getElementById('desktopSearchInput');
        if (desktopSearch) {
            desktopSearch.addEventListener('input', Utils.debounce((e) => {
                AppState.searchQuery = e.target.value;
                if (AppState.currentView !== 'all') {
                    ViewManager.switchView('all');
                } else {
                    ViewManager.renderCoursesView();
                }
            }, 300));
        }
        
        // Filter chips (mutually exclusive)
        const kannadaChip = document.getElementById('filterKannada');
        const teluguChip = document.getElementById('filterTelugu');
        const setLanguageFilter = (lang) => {
            AppState.filters.language = lang;
            kannadaChip.classList.toggle('active', lang === 'kannada');
            teluguChip.classList.toggle('active', lang === 'telugu');
            document.getElementById('languageFilter').value = lang;
            ViewManager.switchView('all');
        };
        
        kannadaChip.addEventListener('click', () => {
            setLanguageFilter(AppState.filters.language === 'kannada' ? '' : 'kannada');
        });
        
        teluguChip.addEventListener('click', () => {
            setLanguageFilter(AppState.filters.language === 'telugu' ? '' : 'telugu');
        });
        
        document.getElementById('filterFavorites').addEventListener('click', function() {
            ViewManager.switchView('favorites');
        });
    },

    initFilters() {
        const playlistDropdown = document.getElementById('playlistFilter');
        const languageDropdown = document.getElementById('languageFilter');

        playlistDropdown.addEventListener('change', () => {
            AppState.selectedCourse = playlistDropdown.value;
            ViewManager.renderCoursesView();
        });
        
        languageDropdown.addEventListener('change', () => {
            AppState.selectedLanguage = languageDropdown.value;
            ViewManager.renderCoursesView();
        });
    },

    initNavigation() {
        // Bottom nav
        document.querySelectorAll('.bottom-nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.dataset.view === 'all') {
                    ViewManager.switchView('all');
                } else {
                    ViewManager.switchView(item.dataset.view);
                }
            });
        });
        
        // Drawer nav items
        document.querySelectorAll('.drawer-item[data-view]').forEach(item => {
            item.addEventListener('click', () => {
                ViewManager.switchView(item.dataset.view);
                this.closeDrawer();
            });
        });
        
        // Sidebar nav (desktop)
        document.querySelectorAll('.nav-item[data-view]').forEach(item => {
            item.addEventListener('click', () => {
                ViewManager.switchView(item.dataset.view);
            });
        });
        
        // See all buttons
        document.querySelectorAll('.see-all-btn, .empty-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.view) ViewManager.switchView(btn.dataset.view);
            });
        });
    },

    initDrawer() {
        const menuBtn = document.getElementById('menuBtn');
        const drawer = document.getElementById('mobileDrawer');
        const overlay = document.getElementById('drawerOverlay');
        const closeBtn = document.getElementById('drawerClose');
        
        menuBtn.addEventListener('click', () => {
            drawer.classList.add('open');
            overlay.classList.add('active');
        });
        
        const close = () => {
            drawer.classList.remove('open');
            overlay.classList.remove('active');
        };
        
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', close);
    },

    closeDrawer() {
        document.getElementById('mobileDrawer').classList.remove('open');
        document.getElementById('drawerOverlay').classList.remove('active');
    },

    initShareModal() {
        const shareModal = document.getElementById('shareModal');
        
        document.getElementById('closeShareModal').addEventListener('click', () => {
            shareModal.classList.remove('active');
        });
        
        document.querySelectorAll('.share-option').forEach(option => {
            option.addEventListener('click', () => {
                const type = option.dataset.share;
                const lesson = AppState.currentVideo;
                if (!lesson) return;
                
                const url = `https://youtube.com/watch?v=${lesson.videoId}`;
                const text = `Check out: ${lesson.title}`;
                
                if (type === 'whatsapp') {
                    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
                } else if (type === 'telegram') {
                    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
                } else if (type === 'copy') {
                    Utils.copyToClipboard(url);
                }
                
                shareModal.classList.remove('active');
            });
        });
    },

    initPrivacyModal() {
        const privacyModal = document.getElementById('privacyModal');
        const openBtn = document.getElementById('privacyPolicyLink');
        const closeBtn = document.getElementById('closePrivacyModal');

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                privacyModal.classList.add('active');
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                privacyModal.classList.remove('active');
            });
        }

        privacyModal.addEventListener('click', (e) => {
            if (e.target.id === 'privacyModal') privacyModal.classList.remove('active');
        });
    },

    initPullToRefresh() {
        let startY = 0;
        let isPulling = false;
        const pullIndicator = document.getElementById('pullToRefresh');
        const canStartPull = () => window.scrollY === 0;
        
        document.addEventListener('touchstart', (e) => {
            if (canStartPull()) {
                startY = e.touches[0].clientY;
                isPulling = true;
            }
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (!isPulling) return;
            
            const currentY = e.touches[0].clientY;
            const diff = currentY - startY;
            
            if (diff > 60 && diff < 150) {
                pullIndicator.classList.add('visible');
                pullIndicator.querySelector('span').textContent = 'Release to refresh';
            }
        }, { passive: true });
        
        document.addEventListener('touchend', async () => {
            if (pullIndicator.classList.contains('visible')) {
                pullIndicator.querySelector('span').textContent = 'Refreshing...';
                
                const result = await DataManager.loadData({ forceRefresh: true });
                pullIndicator.classList.remove('visible');
                if (result.success) {
                    UIRenderer.populateFilters();
                    UIRenderer.populateDrawerCategories();
                    ViewManager.renderCurrentView();
                    Utils.showToast(result.updated ? 'Updated!' : 'No new updates');
                } else {
                    Utils.showToast('Refresh failed', 'error');
                }
            }
            isPulling = false;
        });
    },

    initLoadMore() {
        document.getElementById('loadMoreBtn').addEventListener('click', () => {
            AppState.displayCount += 12;
            ViewManager.renderCoursesView();
        });
    },

    initNetworkStatus() {
        const indicator = document.getElementById('offlineIndicator');
        
        window.addEventListener('online', () => {
            indicator.classList.remove('active');
            AppState.isOnline = true;
            Utils.showToast('Back online!');
        });
        
        window.addEventListener('offline', () => {
            indicator.classList.add('active');
            AppState.isOnline = false;
        });
    }
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadAppConfig();

    // Initialize controllers
    UIControllers.init();
    
    // Load theme
    const savedTheme = localStorage.getItem('epata_theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.querySelectorAll('#themeToggle i, #themeToggleDesktop i, #themeToggleMobile i').forEach(icon => {
            icon.className = 'fas fa-sun';
        });
    }
    
    // Theme toggles
    document.getElementById('themeToggle').addEventListener('click', AppActions.toggleTheme);
    document.getElementById('themeToggleDesktop').addEventListener('click', AppActions.toggleTheme);
    document.getElementById('themeToggleMobile').addEventListener('click', AppActions.toggleTheme);
    
    // Close video modal
    document.getElementById('closeVideoModal').addEventListener('click', () => AppActions.closeVideoModal());
    document.getElementById('modalBack').addEventListener('click', () => AppActions.closeVideoModal());

    // Close Course Complete Modal
    document.getElementById('closeCourseComplete')?.addEventListener('click', () => {
        document.getElementById('courseCompleteModal').style.display = 'none';
    });
    
    // Close modal on backdrop
    document.getElementById('videoModal').addEventListener('click', (e) => {
        if (e.target.id === 'videoModal') AppActions.closeVideoModal();
    });

    // Close resource modal
    document.getElementById('closeResourceModal')?.addEventListener('click', AppActions.closeResourceModal);
    document.getElementById('resourceModalBack')?.addEventListener('click', AppActions.closeResourceModal);
    
    // Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            AppActions.closeVideoModal();
            AppActions.closeResourceModal();
            document.getElementById('shareModal').classList.remove('active');
            document.getElementById('privacyModal').classList.remove('active');
            document.getElementById('installModal').classList.remove('active');
        }
    });
    
    document.addEventListener('click', function(e){
        if(e.target && e.target.id === 'closeCourseComplete'){
            const modal = document.getElementById('courseCompleteModal');
            if(modal) modal.style.display = 'none';
        }
    });

    document.addEventListener('click', function(e){

        if(e.target && e.target.id === 'cancelSwitchCourse'){
            const modal = document.getElementById('switchCourseModal');
            if(modal) modal.style.display = 'none';
            pendingCourseSwitch = null;
        }

        if(e.target && e.target.id === 'confirmSwitchCourse'){
            const modal = document.getElementById('switchCourseModal');
            if(modal) modal.style.display = 'none';

            if(pendingCourseSwitch){
                const courseId = pendingCourseSwitch;
                pendingCourseSwitch = null;

                AppState.enrolledCourse = courseId;
                localStorage.setItem('epata_enrolled_course', JSON.stringify(courseId));
                Utils.showToast("Course Switched Successfully!");
                renderEnrollCourses();
                ViewManager.renderCurrentView();
            }
        }

    });
    
    // Load data
    await loadCoursesMeta();
    const result = await DataManager.loadData();
    DataManager.loadDailyMessage(); // Load the daily message
    DataManager.loadResources(); // Load resources
    
    // Hide loading screen with fade out
    const loader = document.getElementById('loadingScreen');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 500);
    }
    
    if (result.success) {
        UIRenderer.populateFilters();
        UIRenderer.populateDrawerCategories();
        UIRenderer.renderQuickActions();
        ViewManager.switchView('dashboard');
    } else {
        Utils.showToast('Error loading data. Please refresh.', 'error');
    }
});

if ('serviceWorker' in navigator) {
    let refreshing = false;

    // Listen for the "controlling" service worker to change
    // This triggers when the new SW takes over (after skipWaiting)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
            refreshing = true;
            window.location.reload();
        }
    });

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => {
                // Check for updates on load
                reg.update();
                if (reg.waiting) {
                    reg.waiting.postMessage({ type: "SKIP_WAITING" });
                }
                console.log("Service Worker registered");
            })
            .catch(err => console.error('SW Registration failed:', err));
    });
}
