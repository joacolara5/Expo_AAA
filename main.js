/* main.js
   Sistema Táctico de Análisis de Rivales - Fútbol Analytics Pro
   Lee CSV automáticamente desde data/Fifa World Cup 2022.csv,
   calcula perfiles tácticos, compara equipos y genera recomendaciones.
*/

// Variables globales
let rawData = null;          // Datos originales del CSV
let numericCols = [];        // Columnas numéricas detectadas
let derived = [];            // Datos derivados (features)
let clusterAssignments = []; // Asignaciones de cluster por partido
let currentClusters = 3;     // Número de clusters actual
let teamProfiles = {};       // Perfiles de equipos calculados
let allTeams = [];           // Lista de todos los equipos
let radarChart = null;       // Gráfico radar para comparación
let teamMatchups = {};       // Datos de enfrentamientos

// Elementos del DOM del nuevo dashboard
const processBtn = document.getElementById('process-btn');
const kInput = document.getElementById('k-input');
const kValue = document.getElementById('k-value');
const autoScaleCheckbox = document.getElementById('auto-scale');
const ownTeamSelect = document.getElementById('own-team');
const rivalTeamSelect = document.getElementById('rival-team');

// Elementos de la pestaña de análisis de rivales
const rivalNameEl = document.getElementById('rival-name');
const rivalClusterBadge = document.getElementById('rival-cluster-badge');
const intensityBar = document.getElementById('intensity-bar');
const disciplineBar = document.getElementById('discipline-bar');
const precisionBar = document.getElementById('precision-bar');
const intensityValue = document.getElementById('intensity-value');
const disciplineValue = document.getElementById('discipline-value');
const precisionValue = document.getElementById('precision-value');
const clusterDescription = document.getElementById('cluster-description');
const goalsMetric = document.getElementById('goals-metric');
const shotsMetric = document.getElementById('shots-metric');
const possessionMetric = document.getElementById('possession-metric');
const foulsMetric = document.getElementById('fouls-metric');

// Elementos de la pestaña de comparativa táctica
const tacticalInsights = document.getElementById('tactical-insights');
const strengthsList = document.getElementById('strengths-list');
const weaknessesList = document.getElementById('weaknesses-list');

// Elementos de la pestaña de recomendaciones
const ownClusterBadge = document.getElementById('own-cluster-badge');
const rivalMatchupBadge = document.getElementById('rival-matchup-badge');
const matchupDescription = document.getElementById('matchup-description');
const defensiveStrategy = document.getElementById('defensive-strategy');
const offensiveStrategy = document.getElementById('offensive-strategy');
const teamPreparation = document.getElementById('team-preparation');
const substitutions = document.getElementById('substitutions');
const criticalPoints = document.getElementById('critical-points');

// Elementos de la base de datos
const filterCluster = document.getElementById('filter-cluster');
const filterTeam = document.getElementById('filter-team');
const applyFiltersBtn = document.getElementById('apply-filters');
const totalMatchesEl = document.getElementById('total-matches');
const totalTeamsEl = document.getElementById('total-teams');
const totalVariablesEl = document.getElementById('total-variables');

// Paleta de colores para clusters
const clusterColors = {
    1: { 
        color: '#3498db', 
        name: 'Cerrados y Tácticos',
        description: 'Partidos con bajo nivel de goles, tiros, faltas y tarjetas. Ritmo controlado y enfoque defensivo.'
    },
    2: { 
        color: '#e74c3c', 
        name: 'Intensos y Equilibrados',
        description: 'Alta intensidad, muchos tiros, faltas y tarjetas. Posesión disputada y ritmo elevado.'
    },
    3: { 
        color: '#2ecc71', 
        name: 'Dominados o con Goleadas',
        description: 'Número elevado de goles, diferencias amplias. Control claro por un equipo.'
    }
};

// Inicialización del dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Fútbol Analytics Pro - Sistema Táctico iniciando...');
    
    // Configurar eventos de pestañas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.getElementById(tab).classList.add('active');
        });
    });
    
    // Configurar eventos del slider k
    kInput.addEventListener('input', function() {
        kValue.textContent = this.value;
        currentClusters = parseInt(this.value);
    });
    
    // Configurar botón de análisis
    processBtn.addEventListener('click', executeTacticalAnalysis);
    
    // Configurar filtros de base de datos
    applyFiltersBtn.addEventListener('click', applyDatabaseFilters);
    
    // Configurar evento para cambio de equipo propio
    ownTeamSelect.addEventListener('change', function() {
        // Si ya hay un rival seleccionado, actualizar las pestañas 2 y 3
        const selectedRival = rivalTeamSelect.value;
        if (selectedRival) {
            updateAllTabs(selectedRival);
        }
    });
    
    // Cargar datos automáticamente
    loadDefaultCSV();
});

// Cargar datos del CSV
function loadDefaultCSV() {
    const csvPath = 'data/Fifa World Cup 2022.csv';
    
    Papa.parse(csvPath, {
        header: true,
        skipEmptyLines: true,
        download: true,
        complete: function(results) {
            if (results.data && results.data.length > 0) {
                rawData = results.data;
                console.log('Datos cargados:', rawData.length, 'partidos');
                console.log('Columnas disponibles:', Object.keys(rawData[0]));
                initializeSystem();
            } else {
                console.error('Error cargando el CSV');
                showErrorMessage('No se pudieron cargar los datos. Verifica la ruta del archivo.');
            }
        },
        error: function(error) {
            console.error('Error:', error);
            showErrorMessage('Error de conexión. Verifica que el servidor permita CORS.');
        }
    });
}

// Inicializar sistema después de cargar datos
function initializeSystem() {
    detectNumericColumns();
    processData();
    extractTeams();
    populateTeamSelectors();
    updateDatabaseStats();
    
    // Seleccionar equipos por defecto para demostración
    simulateDefaultSelection();
}

// Procesar datos y calcular clusters
function processData() {
    derived = [];
    const cols = detectColumnNames();
    console.log('Columnas detectadas:', cols);
    
    rawData.forEach((row, idx) => {
        const d = { __idx: idx };
        
        // Información básica del partido
        if (cols.team1 && cols.team2) {
            d.match_label = (row[cols.team1] || '') + ' vs ' + (row[cols.team2] || '');
            d.team1 = row[cols.team1];
            d.team2 = row[cols.team2];
        }
        
        // Calcular métricas derivadas
        calculateDerivedMetrics(d, row, cols);
        derived.push(d);
    });
    
    console.log('Datos derivados calculados:', derived.length);
    
    // Extraer features para clustering
    const features = extractFeaturesForClustering();
    const X = prepareDataMatrix(features);
    const Xs = standardizeData(X);
    
    // Calcular clusters
    clusterAssignments = calculateClusters(Xs, currentClusters);
    
    // Asignar clusters a los partidos
    derived.forEach((d, i) => {
        d.cluster = clusterAssignments[i];
    });
    
    // Calcular perfiles de equipos
    calculateTeamProfiles();
    
    console.log('Procesamiento completado:', Object.keys(teamProfiles).length, 'equipos analizados');
}

// Detectar nombres de columnas - MEJORADO
function detectColumnNames() {
    if (!rawData || rawData.length === 0) return {};
    const sample = rawData[0];
    const keys = Object.keys(sample);
    
    console.log('Todas las columnas del CSV:', keys);
    
    const cols = {};
    const mappings = {
        team1: ['team1', 'team_1', 'home_team', 'home team', 'home', 'team'],
        team2: ['team2', 'team_2', 'away_team', 'away team', 'away'],
        goals1: ['number of goals team1', 'number_of_goals_team1', 'goals_team1', 'goals1', 'goals team1', 'score1'],
        goals2: ['number of goals team2', 'number_of_goals_team2', 'goals_team2', 'goals2', 'goals team2', 'score2'],
        possession1: ['possession team1', 'possession_team1', 'possessionteam1', 'team1 possession', 'possesion team1'],
        possession2: ['possession team2', 'possession_team2', 'possessionteam2', 'team2 possession', 'possesion team2'],
        shots1: ['total attempts team1', 'total_attempts_team1', 'shots_team1', 'team1 shots', 'shots team1', 'attempts team1'],
        shots2: ['total attempts team2', 'total_attempts_team2', 'shots_team2', 'team2 shots', 'shots team2', 'attempts team2'],
        shots_on_target1: ['on target attempts team1', 'on_target_attempts_team1', 'shots on target team1', 'on target team1'],
        shots_on_target2: ['on target attempts team2', 'on_target_attempts_team2', 'shots on target team2', 'on target team2'],
        passes1: ['passes team1', 'passes_team1', 'team1 passes', 'total passes team1'],
        passes2: ['passes team2', 'passes_team2', 'team2 passes', 'total passes team2'],
        passes_completed1: ['passes_completed_team1', 'completed_passes_team1', 'completed passes team1', 'accurate passes team1'],
        passes_completed2: ['passes_completed_team2', 'completed_passes_team2', 'completed passes team2', 'accurate passes team2'],
        fouls1: ['fouls team1', 'fouls_team1', 'fouls_committed_team1', 'team1 fouls', 'fouls committed team1'],
        fouls2: ['fouls team2', 'fouls_team2', 'fouls_committed_team2', 'team2 fouls', 'fouls committed team2'],
        yellow1: ['yellow cards team1', 'yellow_cards_team1', 'team1 yellow cards', 'yellow team1'],
        yellow2: ['yellow cards team2', 'yellow_cards_team2', 'team2 yellow cards', 'yellow team2'],
        corners1: ['corners team1', 'corners_team1', 'team1 corners', 'corner kicks team1'],
        corners2: ['corners team2', 'corners_team2', 'team2 corners', 'corner kicks team2']
    };
    
    for (const [key, patterns] of Object.entries(mappings)) {
        cols[key] = findColumn(keys, patterns);
        if (cols[key]) {
            console.log(`Columna ${key} encontrada: ${cols[key]}`);
        } else {
            console.warn(`Columna ${key} NO encontrada`);
        }
    }
    
    return cols;
}

// Encontrar columna por patrones
function findColumn(keys, patterns) {
    for (const pattern of patterns) {
        const found = keys.find(k => k.toLowerCase().includes(pattern.toLowerCase()));
        if (found) return found;
    }
    return null;
}

// Calcular métricas derivadas - MEJORADA
function calculateDerivedMetrics(d, row, cols) {
    // Convertir valores numéricos
    const toNum = (v) => {
        if (v === null || v === undefined || v === '' || v === '-') return 0;
        if (typeof v === 'number') return v;
        const s = String(v).trim().replace('%', '').replace(',', '.');
        const n = Number(s);
        return isNaN(n) ? 0 : n;
    };
    
    // Métricas básicas del partido
    const goals1 = toNum(row[cols.goals1]);
    const goals2 = toNum(row[cols.goals2]);
    const shots1 = toNum(row[cols.shots1]);
    const shots2 = toNum(row[cols.shots2]);
    const shotsOnTarget1 = cols.shots_on_target1 ? toNum(row[cols.shots_on_target1]) : 0;
    const shotsOnTarget2 = cols.shots_on_target2 ? toNum(row[cols.shots_on_target2]) : 0;
    const possession1 = toNum(row[cols.possession1]);
    const possession2 = toNum(row[cols.possession2]);
    const passes1 = cols.passes1 ? toNum(row[cols.passes1]) : 0;
    const passes2 = cols.passes2 ? toNum(row[cols.passes2]) : 0;
    const passesCompleted1 = cols.passes_completed1 ? toNum(row[cols.passes_completed1]) : (passes1 * 0.85); // Estimación si no hay datos
    const passesCompleted2 = cols.passes_completed2 ? toNum(row[cols.passes_completed2]) : (passes2 * 0.85); // Estimación si no hay datos
    const fouls1 = toNum(row[cols.fouls1]);
    const fouls2 = toNum(row[cols.fouls2]);
    const yellow1 = toNum(row[cols.yellow1]);
    const yellow2 = toNum(row[cols.yellow2]);
    const corners1 = toNum(row[cols.corners1]);
    const corners2 = toNum(row[cols.corners2]);
    
    // Métricas derivadas del partido
    d.total_goals = goals1 + goals2;
    d.total_shots = shots1 + shots2;
    d.total_shots_on_target = shotsOnTarget1 + shotsOnTarget2;
    d.total_fouls = fouls1 + fouls2;
    d.total_yellow = yellow1 + yellow2;
    d.total_corners = corners1 + corners2;
    d.possession_mean = (possession1 + possession2) > 0 ? (possession1 + possession2) / 2 : 50;
    d.passes_completed_pct = (passes1 + passes2) > 0 ? 
        ((passesCompleted1 + passesCompleted2) / (passes1 + passes2)) * 100 : 85;
    d.intensity_index = (shots1 + shots2 + fouls1 + fouls2 + yellow1 + yellow2) / 6;
    d.goal_difference = Math.abs(goals1 - goals2);
    
    // Eficiencias
    d.shot_efficiency = (shots1 + shots2) > 0 ? ((goals1 + goals2) / (shots1 + shots2)) * 100 : 0;
    d.shots_on_target_pct = (shots1 + shots2) > 0 ? ((shotsOnTarget1 + shotsOnTarget2) / (shots1 + shots2)) * 100 : 35;
    
    // Guardar datos por equipo para el partido
    d.team1_stats = {
        goals: goals1,
        shots: shots1,
        shots_on_target: shotsOnTarget1 > 0 ? shotsOnTarget1 : (shots1 * 0.35), // Estimación si no hay datos
        possession: possession1 > 0 ? possession1 : 50,
        passes: passes1,
        passes_completed: passesCompleted1,
        fouls: fouls1,
        yellow: yellow1,
        corners: corners1
    };
    
    d.team2_stats = {
        goals: goals2,
        shots: shots2,
        shots_on_target: shotsOnTarget2 > 0 ? shotsOnTarget2 : (shots2 * 0.35), // Estimación si no hay datos
        possession: possession2 > 0 ? possession2 : 50,
        passes: passes2,
        passes_completed: passesCompleted2,
        fouls: fouls2,
        yellow: yellow2,
        corners: corners2
    };
}

// Extraer features para clustering
function extractFeaturesForClustering() {
    const candidateFeatures = [
        'total_goals', 'total_shots', 'total_shots_on_target', 'total_fouls',
        'total_yellow', 'total_corners', 'possession_mean', 'passes_completed_pct',
        'intensity_index', 'goal_difference', 'shot_efficiency', 'shots_on_target_pct'
    ];
    
    // Filtrar features que tengan datos válidos
    return candidateFeatures.filter(f => 
        derived.some(d => typeof d[f] !== 'undefined' && !isNaN(d[f]) && d[f] !== 0)
    );
}

// Preparar matriz de datos
function prepareDataMatrix(features) {
    return derived.map(d => features.map(f => Number(d[f] || 0)));
}

// Estandarizar datos
function standardizeData(X) {
    if (!autoScaleCheckbox.checked || X.length === 0) return X;
    
    const Xs = X.map(row => row.slice());
    const m = Xs[0].length;
    const mus = new Array(m).fill(0);
    const sds = new Array(m).fill(0);
    
    for (let j = 0; j < m; j++) {
        let sum = 0, sumsq = 0;
        for (let i = 0; i < Xs.length; i++) {
            sum += Xs[i][j];
            sumsq += Xs[i][j] * Xs[i][j];
        }
        const mu = sum / Xs.length;
        const sd = Math.sqrt(Math.max(0, sumsq / Xs.length - mu * mu));
        mus[j] = mu;
        sds[j] = sd || 1;
    }
    
    for (let i = 0; i < Xs.length; i++) {
        for (let j = 0; j < m; j++) {
            Xs[i][j] = (Xs[i][j] - mus[j]) / sds[j];
        }
    }
    
    return Xs;
}

// Calcular clusters
function calculateClusters(X, k) {
    if (!X || X.length === 0) return [];
    
    // Usar k-means simple
    const n = X.length;
    const m = X[0].length;
    const centroids = [];
    const used = new Set();
    
    // Inicializar centroides aleatorios
    while (centroids.length < k) {
        const i = Math.floor(Math.random() * n);
        if (!used.has(i)) {
            used.add(i);
            centroids.push(X[i].slice());
        }
    }
    
    let labels = new Array(n).fill(0);
    let changed = true;
    let iterations = 0;
    
    while (changed && iterations < 50) {
        changed = false;
        
        // Asignar puntos al centroide más cercano
        for (let i = 0; i < n; i++) {
            let best = 0;
            let bestDist = Infinity;
            
            for (let c = 0; c < k; c++) {
                const dist = euclideanDistance(X[i], centroids[c]);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = c;
                }
            }
            
            if (labels[i] !== best) {
                labels[i] = best;
                changed = true;
            }
        }
        
        // Recalcular centroides
        const sums = Array.from({length: k}, () => new Array(m).fill(0));
        const counts = new Array(k).fill(0);
        
        for (let i = 0; i < n; i++) {
            const c = labels[i];
            counts[c]++;
            for (let j = 0; j < m; j++) {
                sums[c][j] += X[i][j];
            }
        }
        
        for (let c = 0; c < k; c++) {
            if (counts[c] > 0) {
                for (let j = 0; j < m; j++) {
                    centroids[c][j] = sums[c][j] / counts[c];
                }
            }
        }
        
        iterations++;
    }
    
    // Convertir a 1-indexed
    return labels.map(l => l + 1);
}

// Distancia euclidiana
function euclideanDistance(a, b) {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

// Extraer equipos únicos
function extractTeams() {
    allTeams = [];
    const teamSet = new Set();
    
    derived.forEach(d => {
        if (d.team1 && d.team1.trim() !== '') teamSet.add(d.team1.trim());
        if (d.team2 && d.team2.trim() !== '') teamSet.add(d.team2.trim());
    });
    
    allTeams = Array.from(teamSet).sort();
    console.log('Equipos encontrados:', allTeams);
}

// Calcular perfiles de equipos - MEJORADA
function calculateTeamProfiles() {
    teamProfiles = {};
    
    allTeams.forEach(team => {
        const teamMatches = derived.filter(d => d.team1 === team || d.team2 === team);
        if (teamMatches.length === 0) return;
        
        const profile = {
            name: team,
            totalMatches: teamMatches.length,
            clusters: {},
            avgStats: {},
            lastMatches: teamMatches.slice(-5).map(m => ({
                opponent: m.team1 === team ? m.team2 : m.team1,
                result: getMatchResult(m, team),
                cluster: m.cluster
            }))
        };
        
        // Calcular distribución de clusters
        teamMatches.forEach(match => {
            const cluster = match.cluster;
            profile.clusters[cluster] = (profile.clusters[cluster] || 0) + 1;
        });
        
        // Determinar cluster principal
        let mainCluster = 1;
        let maxCount = 0;
        for (const [cluster, count] of Object.entries(profile.clusters)) {
            if (count > maxCount) {
                maxCount = count;
                mainCluster = parseInt(cluster);
            }
        }
        profile.mainCluster = mainCluster;
        
        // Calcular estadísticas promedio
        const stats = {
            goals: 0, shots: 0, shots_on_target: 0, possession: 0,
            passes: 0, passes_completed: 0, fouls: 0, yellow: 0,
            corners: 0, intensity: 0
        };
        
        teamMatches.forEach(match => {
            const isTeam1 = match.team1 === team;
            const teamStats = isTeam1 ? match.team1_stats : match.team2_stats;
            
            stats.goals += teamStats.goals || 0;
            stats.shots += teamStats.shots || 0;
            stats.shots_on_target += teamStats.shots_on_target || 0;
            stats.possession += teamStats.possession || 50;
            stats.passes += teamStats.passes || 300;
            stats.passes_completed += teamStats.passes_completed || (teamStats.passes || 300) * 0.85;
            stats.fouls += teamStats.fouls || 10;
            stats.yellow += teamStats.yellow || 1;
            stats.corners += teamStats.corners || 5;
            stats.intensity += match.intensity_index || 5;
        });
        
        // Calcular promedios
        const numMatches = teamMatches.length;
        profile.avgStats = {
            goals_per_match: (stats.goals / numMatches).toFixed(2),
            shots_per_match: (stats.shots / numMatches).toFixed(1),
            shots_on_target_per_match: (stats.shots_on_target / numMatches).toFixed(1),
            possession_avg: (stats.possession / numMatches).toFixed(1),
            passes_per_match: (stats.passes / numMatches).toFixed(0),
            pass_completion: stats.passes > 0 ? ((stats.passes_completed / stats.passes) * 100).toFixed(1) : '85.0',
            fouls_per_match: (stats.fouls / numMatches).toFixed(1),
            yellow_per_match: (stats.yellow / numMatches).toFixed(2),
            corners_per_match: (stats.corners / numMatches).toFixed(1),
            intensity_avg: (stats.intensity / numMatches).toFixed(2)
        };
        
        teamProfiles[team] = profile;
        
        console.log(`Perfil de ${team}:`, profile.avgStats);
    });
}

// Obtener resultado del partido
function getMatchResult(match, team) {
    const isTeam1 = match.team1 === team;
    const teamGoals = isTeam1 ? match.team1_stats.goals : match.team2_stats.goals;
    const opponentGoals = isTeam1 ? match.team2_stats.goals : match.team1_stats.goals;
    
    if (teamGoals > opponentGoals) return 'V';
    if (teamGoals < opponentGoals) return 'D';
    return 'E';
}

// Rellenar selectores de equipos
function populateTeamSelectors() {
    // Limpiar selectores
    ownTeamSelect.innerHTML = '<option value="">Seleccionar equipo propio...</option>';
    rivalTeamSelect.innerHTML = '<option value="">Seleccionar rival...</option>';
    
    // Añadir equipos al selector de rivales
    allTeams.forEach(team => {
        // Para equipo propio
        const option1 = document.createElement('option');
        option1.value = team;
        option1.textContent = team;
        ownTeamSelect.appendChild(option1);
        
        // Para rivales
        const option2 = document.createElement('option');
        option2.value = team;
        option2.textContent = team;
        rivalTeamSelect.appendChild(option2);
    });
}

// Análisis de equipo rival - ACTUALIZADO
function analyzeRival(teamName) {
    const profile = teamProfiles[teamName];
    if (!profile) {
        console.log('Perfil no encontrado para:', teamName);
        return;
    }
    
    console.log('Analizando rival:', teamName);
    console.log('Perfil del rival:', profile.avgStats);
    
    // Actualizar información básica
    rivalNameEl.textContent = teamName;
    
    // Actualizar badge del cluster
    const cluster = profile.mainCluster;
    const clusterInfo = clusterColors[cluster] || clusterColors[1];
    rivalClusterBadge.innerHTML = `
        <span class="badge-text">Cluster ${cluster}: ${clusterInfo.name}</span>
        <div class="badge-color" style="background-color: ${clusterInfo.color}"></div>
    `;
    
    // Actualizar métricas clave
    updateKeyMetrics(profile);
    
    // Actualizar descripción del cluster
    clusterDescription.innerHTML = `
        <p><strong>${clusterInfo.name}</strong></p>
        <p>${clusterInfo.description}</p>
        <p>Este equipo participó en <strong>${profile.totalMatches}</strong> partidos analizados.</p>
        <p>Distribución de clusters: ${Object.entries(profile.clusters)
            .map(([c, count]) => `Cluster ${c}: ${count} partidos`).join(', ')}</p>
    `;
    
    // Actualizar TODAS las pestañas
    updateAllTabs(teamName);
}

// Función para actualizar todas las pestañas
function updateAllTabs(rivalTeam) {
    console.log('Actualizando todas las pestañas para rival:', rivalTeam);
    
    // Pestaña 2: Comparativa Táctica
    generateTacticalAnalysis(rivalTeam);
    
    // Pestaña 3: Recomendaciones
    generateRecommendations(rivalTeam);
}

// Actualizar métricas clave
function updateKeyMetrics(profile) {
    const stats = profile.avgStats;
    
    console.log('Actualizando métricas con stats:', stats);
    
    // Actualizar valores
    goalsMetric.textContent = stats.goals_per_match;
    shotsMetric.textContent = stats.shots_on_target_per_match;
    possessionMetric.textContent = `${stats.possession_avg}%`;
    foulsMetric.textContent = stats.fouls_per_match;
    
    // Actualizar barras de progreso con valores reales
    updateProgressBar(intensityBar, intensityValue, parseFloat(stats.intensity_avg) || 5, 10);
    updateProgressBar(disciplineBar, disciplineValue, parseFloat(stats.fouls_per_match) || 10, 20);
    updateProgressBar(precisionBar, precisionValue, parseFloat(stats.pass_completion) || 85, 100);
}

// Actualizar barra de progreso
function updateProgressBar(barEl, valueEl, value, max) {
    const safeValue = isNaN(value) || value === 0 ? max * 0.5 : value;
    const percentage = Math.min((safeValue / max) * 100, 100);
    barEl.style.width = `${percentage}%`;
    valueEl.textContent = typeof safeValue === 'number' ? safeValue.toFixed(2) : safeValue;
    
    // Colores según valor
    if (percentage < 33) {
        barEl.style.backgroundColor = '#2ecc71'; // Verde (bajo)
    } else if (percentage < 66) {
        barEl.style.backgroundColor = '#f39c12'; // Amarillo (medio)
    } else {
        barEl.style.backgroundColor = '#e74c3c'; // Rojo (alto)
    }
}

// Generar análisis táctico - ACTUALIZADO
function generateTacticalAnalysis(rivalTeam) {
    const ownTeam = ownTeamSelect.value;
    if (!ownTeam) {
        console.log('No hay equipo propio seleccionado');
        tacticalInsights.innerHTML = `
            <div class="insight-item">
                <div class="insight-icon">
                    <i class="fas fa-exclamation-circle"></i>
                </div>
                <div class="insight-content">
                    <p>Seleccione un equipo propio en la configuración para ver la comparativa táctica.</p>
                </div>
            </div>
        `;
        strengthsList.innerHTML = '<li>Seleccione un equipo propio para ver fortalezas</li>';
        weaknessesList.innerHTML = '<li>Seleccione un equipo propio para ver debilidades</li>';
        return;
    }
    
    const ownProfile = teamProfiles[ownTeam];
    const rivalProfile = teamProfiles[rivalTeam];
    
    if (!ownProfile || !rivalProfile) {
        console.log('Perfiles no encontrados:', ownTeam, rivalTeam);
        return;
    }
    
    console.log('Generando análisis táctico:', ownTeam, 'vs', rivalTeam);
    console.log('Perfil propio:', ownProfile.avgStats);
    console.log('Perfil rival:', rivalProfile.avgStats);
    
    // Crear gráfico radar
    createRadarChart(ownProfile, rivalProfile);
    
    // Generar insights
    generateInsights(ownProfile, rivalProfile);
}

// Crear gráfico radar - CORREGIDO
function createRadarChart(ownProfile, rivalProfile) {
    const canvas = document.getElementById('radarChart');
    if (!canvas) {
        console.log('Canvas no encontrado');
        return;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Destruir gráfico anterior si existe
    if (radarChart) {
        radarChart.destroy();
    }
    
    // Preparar datos
    const labels = [
        'Goles/Partido', 'Tiros al Arco', 'Posesión %', 
        'Precisión Pases %', 'Faltas/Partido', 'Intensidad',
        'Tiros de Esquina', 'Amarillas/Partido'
    ];
    
    const ownData = [
        parseFloat(ownProfile.avgStats.goals_per_match) || 0,
        parseFloat(ownProfile.avgStats.shots_on_target_per_match) || 0,
        parseFloat(ownProfile.avgStats.possession_avg) || 50,
        parseFloat(ownProfile.avgStats.pass_completion) || 85,
        parseFloat(ownProfile.avgStats.fouls_per_match) || 10,
        parseFloat(ownProfile.avgStats.intensity_avg) || 5,
        parseFloat(ownProfile.avgStats.corners_per_match) || 5,
        parseFloat(ownProfile.avgStats.yellow_per_match) || 1
    ];
    
    const rivalData = [
        parseFloat(rivalProfile.avgStats.goals_per_match) || 0,
        parseFloat(rivalProfile.avgStats.shots_on_target_per_match) || 0,
        parseFloat(rivalProfile.avgStats.possession_avg) || 50,
        parseFloat(rivalProfile.avgStats.pass_completion) || 85,
        parseFloat(rivalProfile.avgStats.fouls_per_match) || 10,
        parseFloat(rivalProfile.avgStats.intensity_avg) || 5,
        parseFloat(rivalProfile.avgStats.corners_per_match) || 5,
        parseFloat(rivalProfile.avgStats.yellow_per_match) || 1
    ];
    
    console.log('Datos para radar - Propio:', ownData);
    console.log('Datos para radar - Rival:', rivalData);
    
    // Crear nuevo gráfico
    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Equipo Propio',
                    data: ownData,
                    backgroundColor: 'rgba(52, 152, 219, 0.2)',
                    borderColor: 'rgba(52, 152, 219, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(52, 152, 219, 1)',
                    pointRadius: 4
                },
                {
                    label: 'Equipo Rival',
                    data: rivalData,
                    backgroundColor: 'rgba(231, 76, 60, 0.2)',
                    borderColor: 'rgba(231, 76, 60, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(231, 76, 60, 1)',
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                r: {
                    beginAtZero: true,
                    ticks: {
                        display: false,
                        stepSize: 5
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    angleLines: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#fff',
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw.toFixed(2)}`;
                        }
                    }
                }
            }
        }
    });
    
    console.log('Gráfico radar creado exitosamente');
}

// Generar insights tácticos
function generateInsights(ownProfile, rivalProfile) {
    const ownCluster = ownProfile.mainCluster;
    const rivalCluster = rivalProfile.mainCluster;
    
    // Limpiar listas
    strengthsList.innerHTML = '';
    weaknessesList.innerHTML = '';
    tacticalInsights.innerHTML = '';
    
    // Análisis comparativo
    const insights = compareTeams(ownProfile, rivalProfile);
    
    // Añadir fortalezas
    if (insights.strengths.length > 0) {
        insights.strengths.forEach(strength => {
            const li = document.createElement('li');
            li.textContent = strength;
            strengthsList.appendChild(li);
        });
    } else {
        strengthsList.innerHTML = '<li>Sin fortalezas identificadas específicamente</li>';
    }
    
    // Añadir debilidades
    if (insights.weaknesses.length > 0) {
        insights.weaknesses.forEach(weakness => {
            const li = document.createElement('li');
            li.textContent = weakness;
            weaknessesList.appendChild(li);
        });
    } else {
        weaknessesList.innerHTML = '<li>Sin debilidades identificadas específicamente</li>';
    }
    
    // Añadir insights generales
    if (insights.generalInsights.length > 0) {
        insights.generalInsights.forEach(insight => {
            const insightEl = document.createElement('div');
            insightEl.className = 'insight-item';
            insightEl.innerHTML = `
                <div class="insight-icon">
                    <i class="fas fa-exclamation-circle"></i>
                </div>
                <div class="insight-content">
                    <p>${insight}</p>
                </div>
            `;
            tacticalInsights.appendChild(insightEl);
        });
    } else {
        tacticalInsights.innerHTML = `
            <div class="insight-item">
                <div class="insight-icon">
                    <i class="fas fa-info-circle"></i>
                </div>
                <div class="insight-content">
                    <p>Ambos equipos presentan perfiles similares. El partido dependerá de los detalles tácticos y momentos individuales.</p>
                </div>
            </div>
        `;
    }
}

// Comparar equipos - MEJORADA
function compareTeams(own, rival) {
    const insights = {
        strengths: [],
        weaknesses: [],
        generalInsights: []
    };
    
    // Convertir estadísticas a números
    const ownPossession = parseFloat(own.avgStats.possession_avg) || 50;
    const rivalPossession = parseFloat(rival.avgStats.possession_avg) || 50;
    const ownPassAccuracy = parseFloat(own.avgStats.pass_completion) || 85;
    const rivalPassAccuracy = parseFloat(rival.avgStats.pass_completion) || 85;
    const ownIntensity = parseFloat(own.avgStats.intensity_avg) || 5;
    const rivalIntensity = parseFloat(rival.avgStats.intensity_avg) || 5;
    const ownFouls = parseFloat(own.avgStats.fouls_per_match) || 10;
    const rivalFouls = parseFloat(rival.avgStats.fouls_per_match) || 10;
    const ownGoals = parseFloat(own.avgStats.goals_per_match) || 1.2;
    const rivalGoals = parseFloat(rival.avgStats.goals_per_match) || 1.2;
    
    // Comparar posesión
    if (ownPossession > rivalPossession + 5) {
        insights.strengths.push('Superioridad en posesión del balón');
        insights.generalInsights.push(`Tu equipo domina más la posesión (${ownPossession.toFixed(1)}% vs ${rivalPossession.toFixed(1)}%). Considera un juego de control.`);
    } else if (rivalPossession > ownPossession + 5) {
        insights.weaknesses.push('Inferioridad en posesión del balón');
        insights.generalInsights.push(`El rival suele tener más posesión (${rivalPossession.toFixed(1)}% vs ${ownPossession.toFixed(1)}%). Prepárate para defender organizadamente.`);
    }
    
    // Comparar precisión de pases
    if (ownPassAccuracy > rivalPassAccuracy + 3) {
        insights.strengths.push('Mayor precisión en los pases');
        insights.generalInsights.push(`Tu equipo tiene mejor precisión de pases (${ownPassAccuracy.toFixed(1)}% vs ${rivalPassAccuracy.toFixed(1)}%).`);
    } else if (rivalPassAccuracy > ownPassAccuracy + 3) {
        insights.weaknesses.push('Menor precisión en los pases');
        insights.generalInsights.push(`El rival tiene mejor precisión de pases (${rivalPassAccuracy.toFixed(1)}% vs ${ownPassAccuracy.toFixed(1)}%). Considera presión alta para forzar errores.`);
    }
    
    // Comparar intensidad
    if (rivalIntensity > ownIntensity + 1) {
        insights.generalInsights.push(`El rival juega con mayor intensidad (${rivalIntensity.toFixed(2)} vs ${ownIntensity.toFixed(2)}). Prepárate para un partido físico.`);
        insights.weaknesses.push('Menor intensidad de juego');
    } else if (ownIntensity > rivalIntensity + 1) {
        insights.strengths.push('Mayor intensidad de juego');
        insights.generalInsights.push(`Tu equipo juega con más intensidad (${ownIntensity.toFixed(2)} vs ${rivalIntensity.toFixed(2)}). Aprovecha para imponer ritmo.`);
    }
    
    // Comparar disciplina
    if (rivalFouls > ownFouls + 2) {
        insights.strengths.push('El rival comete más faltas. Aprovecha los balones parados.');
        insights.generalInsights.push(`El rival es propenso a cometer faltas (${rivalFouls.toFixed(1)} vs ${ownFouls.toFixed(1)} por partido). Practica jugadas a balón parado.`);
    }
    
    // Comparar efectividad ofensiva
    if (ownGoals > rivalGoals + 0.3) {
        insights.strengths.push('Mayor efectividad ofensiva');
        insights.generalInsights.push(`Tu equipo marca más goles por partido (${ownGoals.toFixed(2)} vs ${rivalGoals.toFixed(2)}).`);
    } else if (rivalGoals > ownGoals + 0.3) {
        insights.weaknesses.push('Menor efectividad ofensiva');
        insights.generalInsights.push(`El rival marca más goles por partido (${rivalGoals.toFixed(2)} vs ${ownGoals.toFixed(2)}). Refuerza la defensa.`);
    }
    
    // Análisis de clusters
    const ownCluster = own.mainCluster;
    const rivalCluster = rival.mainCluster;
    
    insights.generalInsights.push(`Enfrentamiento: ${clusterColors[ownCluster].name} (Cluster ${ownCluster}) vs ${clusterColors[rivalCluster].name} (Cluster ${rivalCluster})`);
    
    return insights;
}

// Generar recomendaciones - MEJORADA
function generateRecommendations(rivalTeam) {
    const ownTeam = ownTeamSelect.value;
    if (!ownTeam) {
        console.log('No hay equipo propio para recomendaciones');
        matchupDescription.innerHTML = '<p>Seleccione un equipo propio en la configuración para obtener recomendaciones personalizadas.</p>';
        defensiveStrategy.innerHTML = '<p>Seleccione un equipo propio para ver recomendaciones defensivas específicas.</p>';
        offensiveStrategy.innerHTML = '<p>Seleccione un equipo propio para ver recomendaciones ofensivas específicas.</p>';
        teamPreparation.innerHTML = '<p>Seleccione un equipo propio para ver recomendaciones de preparación.</p>';
        substitutions.innerHTML = '<p>Seleccione un equipo propio para ver recomendaciones de rotaciones.</p>';
        criticalPoints.textContent = 'Complete la selección de equipo propio y rival.';
        return;
    }
    
    const ownProfile = teamProfiles[ownTeam];
    const rivalProfile = teamProfiles[rivalTeam];
    
    if (!ownProfile || !rivalProfile) {
        console.log('Perfiles no encontrados para recomendaciones');
        return;
    }
    
    console.log('Generando recomendaciones para:', ownTeam, 'vs', rivalTeam);
    
    const ownCluster = ownProfile.mainCluster;
    const rivalCluster = rivalProfile.mainCluster;
    
    // Actualizar badges
    ownClusterBadge.textContent = `Cluster ${ownCluster}`;
    ownClusterBadge.style.backgroundColor = clusterColors[ownCluster]?.color || '#3498db';
    
    rivalMatchupBadge.textContent = `Cluster ${rivalCluster}`;
    rivalMatchupBadge.style.backgroundColor = clusterColors[rivalCluster]?.color || '#e74c3c';
    
    // Generar descripción del enfrentamiento
    generateMatchupDescription(ownCluster, rivalCluster);
    
    // Generar recomendaciones específicas
    generateSpecificRecommendations(ownProfile, rivalProfile);
}

// Generar descripción del enfrentamiento
function generateMatchupDescription(ownCluster, rivalCluster) {
    const matchups = {
        '1-1': 'Enfrentamiento entre dos equipos tácticos. Se espera un partido cerrado con pocas oportunidades.',
        '1-2': 'Equipo táctico vs equipo intenso. Riesgo de ser superado físicamente.',
        '1-3': 'Equipo táctico vs equipo dominador. Necesidad de máxima concentración defensiva.',
        '2-1': 'Equipo intenso vs equipo táctico. Oportunidad de imponer el ritmo del partido.',
        '2-2': 'Enfrentamiento intenso entre dos equipos equilibrados. Partido físico con muchas interrupciones.',
        '2-3': 'Equipo intenso vs equipo dominador. Duelo de estilos contrastantes.',
        '3-1': 'Equipo dominador vs equipo táctico. Oportunidad de demostrar superioridad técnica.',
        '3-2': 'Equipo dominador vs equipo intenso. Riesgo de perder el control del ritmo.',
        '3-3': 'Enfrentamiento entre dos equipos ofensivos. Se espera un partido con muchos goles.'
    };
    
    const key = `${ownCluster}-${rivalCluster}`;
    matchupDescription.innerHTML = `
        <p><strong>${matchups[key] || 'Enfrentamiento de estilos contrastantes.'}</strong></p>
        <p>Basado en el análisis histórico, este tipo de enfrentamientos tienden a ser definidos por:</p>
        <ul>
            <li>${getKeyFactor(ownCluster, rivalCluster, 1)}</li>
            <li>${getKeyFactor(ownCluster, rivalCluster, 2)}</li>
            <li>${getKeyFactor(ownCluster, rivalCluster, 3)}</li>
        </ul>
    `;
}

// Obtener factor clave del enfrentamiento
function getKeyFactor(ownCluster, rivalCluster, index) {
    const factors = {
        '1-2': [
            'La capacidad de mantener la concentración defensiva',
            'La eficiencia en los contragolpes',
            'La gestión de los balones parados'
        ],
        '2-1': [
            'La intensidad física desde el inicio',
            'La presión alta para forzar errores',
            'La rapidez en las transiciones'
        ],
        '2-3': [
            'La capacidad de mantener la posesión bajo presión',
            'La efectividad en el último tercio',
            'La gestión del ritmo del partido'
        ],
        '3-2': [
            'El control del espacio entre líneas',
            'La precisión en el pase final',
            'La paciencia en la construcción de jugadas'
        ],
        '1-3': [
            'La organización defensiva compacta',
            'La eficacia en los contragolpes',
            'La gestión del ritmo del partido'
        ],
        '3-1': [
            'La paciencia en la construcción de jugadas',
            'La creación de espacios en defensa rival',
            'La efectividad en el último tercio'
        ]
    };
    
    const key = `${ownCluster}-${rivalCluster}`;
    const defaultFactors = [
        'La capacidad de adaptación táctica',
        'La concentración en los momentos clave',
        'La efectividad en las jugadas preparadas'
    ];
    
    return (factors[key] || defaultFactors)[index - 1];
}

// Generar recomendaciones específicas - MEJORADA
function generateSpecificRecommendations(ownProfile, rivalProfile) {
    const ownStats = ownProfile.avgStats;
    const rivalStats = rivalProfile.avgStats;
    const rivalCluster = rivalProfile.mainCluster;
    
    // Recomendaciones defensivas
    defensiveStrategy.innerHTML = generateDefensiveRecommendations(rivalCluster, rivalStats);
    
    // Recomendaciones ofensivas
    offensiveStrategy.innerHTML = generateOffensiveRecommendations(rivalCluster, rivalStats, ownStats);
    
    // Preparación del equipo
    teamPreparation.innerHTML = generateTeamPreparation(rivalCluster, rivalStats);
    
    // Sustituciones
    substitutions.innerHTML = generateSubstitutionRecommendations(rivalCluster, rivalStats);
    
    // Puntos críticos
    criticalPoints.textContent = generateCriticalPoints(rivalCluster, rivalStats, ownStats);
}

// Generar recomendaciones defensivas
function generateDefensiveRecommendations(rivalCluster, rivalStats) {
    const recommendations = {
        1: `<p>Equipo táctico: Mantén la organización defensiva y evita espacios entre líneas. El rival busca errores de posicionamiento (concede solo ${rivalStats.goals_per_match} goles por partido).</p>`,
        2: `<p>Equipo intenso: Prepara líneas defensivas compactas. El rival promedia ${rivalStats.fouls_per_match} faltas por partido - practica balones parados y prepara jugadas de falta.</p>`,
        3: `<p>Equipo dominador: Presión alta en medios. El rival promedia ${rivalStats.possession_avg}% de posesión - necesita cortar su circulación con pressing coordinado.</p>`
    };
    
    return recommendations[rivalCluster] || `<p>Mantén la organización defensiva y adapta según el desarrollo del partido. El rival promedio ${rivalStats.fouls_per_match} faltas por partido - cuidado con los balones parados.</p>`;
}

// Generar recomendaciones ofensivas
function generateOffensiveRecommendations(rivalCluster, rivalStats, ownStats) {
    const recommendations = {
        1: `<p>Explota los espacios en transición. El rival es ordenado pero poco intenso (${rivalStats.intensity_avg}/10). Busca jugadas rápidas después de recuperaciones.</p>`,
        2: `<p>Juego rápido y directo. El rival comete ${rivalStats.fouls_per_match} faltas por partido - aprovecha tiros libres y prepara jugadas específicas.</p>`,
        3: `<p>Control de posesión y paciencia. El rival domina con ${rivalStats.possession_avg}% de posesión - busca errores en su construcción y aprovecha los espacios al recuperar.</p>`
    };
    
    return recommendations[rivalCluster] || `<p>Adapta el ataque según las debilidades detectadas. Tu equipo tiene ${ownStats.shots_on_target_per_match} tiros al arco por partido - mantén esa efectividad.</p>`;
}

// Generar preparación del equipo
function generateTeamPreparation(rivalCluster, rivalStats) {
    const prep = {
        1: `<p>Enfatizar la paciencia táctica y la concentración defensiva. Sesiones de posesión bajo presión y transiciones rápidas.</p>`,
        2: `<p>Preparación física intensa. El rival promedia ${rivalStats.intensity_avg}/10 de intensidad - simula escenarios de alta presión y recuperación rápida.</p>`,
        3: `<p>Trabajo de presión colectiva. El rival tiene ${rivalStats.pass_completion}% de precisión en pases - practica pressing coordinado y cortes de líneas de pase.</p>`
    };
    
    return prep[rivalCluster] || `<p>Preparación general enfocada en adaptabilidad táctica. Trabaja en transiciones ofensivas-defensivas y variantes tácticas.</p>`;
}

// Generar recomendaciones de sustituciones
function generateSubstitutionRecommendations(rivalCluster, rivalStats) {
    const subs = {
        1: `<p>Sustituciones tácticas para cambiar el ritmo. Considera cambios ofensivos si el partido está cerrado - jugadores con desequilibrio individual.</p>`,
        2: `<p>Rotaciones frecuentes para mantener la intensidad. El rival es físico (${rivalStats.intensity_avg}/10) - prepara sustituciones energéticas en mediocampo y delantera.</p>`,
        3: `<p>Sustituciones para mantener la posesión y el control del juego en los últimos minutos. Jugadores frescos para presionar alto y conservar el balón.</p>`
    };
    
    return subs[rivalCluster] || `<p>Planifica sustituciones según el desarrollo del partido. Considera cambios que puedan cambiar el ritmo del juego.</p>`;
}

// Generar puntos críticos
function generateCriticalPoints(rivalCluster, rivalStats, ownStats) {
    const points = {
        1: `El rival es ordenado defensivamente (concede solo ${rivalStats.goals_per_match} goles en promedio). Necesidad de creatividad en ataque y paciencia en la construcción.`,
        2: `Alta intensidad física (${rivalStats.intensity_avg}/10). Riesgo de lesiones y tarjetas. Control emocional y preparación física clave.`,
        3: `Dominio de posesión (${rivalStats.possession_avg}%). Necesidad de pressing eficiente y contragolpes rápidos. Transiciones ofensivas-defensivas serán determinantes.`
    };
    
    return points[rivalCluster] || `Analiza el desarrollo del partido para identificar puntos débiles. El rival tiene ${rivalStats.pass_completion}% de precisión en pases - presión alta podría forzar errores.`;
}

// Ejecutar análisis táctico
function executeTacticalAnalysis() {
    if (!rawData) {
        alert('Los datos aún no han sido cargados. Por favor espera.');
        return;
    }
    
    // Mostrar indicador de carga
    processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';
    processBtn.disabled = true;
    
    // Reprocesar datos
    setTimeout(() => {
        processData();
        
        // Si hay un rival seleccionado, actualizar análisis
        const selectedRival = rivalTeamSelect.value;
        if (selectedRival) {
            analyzeRival(selectedRival);
        }
        
        // Actualizar base de datos
        updateDatabaseStats();
        applyDatabaseFilters();
        
        // Restaurar botón
        processBtn.innerHTML = '<i class="fas fa-play-circle"></i> Ejecutar Análisis Táctico';
        processBtn.disabled = false;
        
        showSuccessMessage('Análisis táctico completado exitosamente');
    }, 1000);
}

// Simular selección por defecto para demostración
function simulateDefaultSelection() {
    // Esperar un momento para que los selectores se llenen
    setTimeout(() => {
        // Seleccionar Argentina como equipo propio (si existe)
        const argentinaOption = Array.from(ownTeamSelect.options).find(opt => 
            opt.text.toLowerCase().includes('argentina'));
        if (argentinaOption) {
            ownTeamSelect.value = argentinaOption.value;
        } else if (ownTeamSelect.options.length > 1) {
            ownTeamSelect.value = ownTeamSelect.options[1].value; // Primer equipo real
        }
        
        // Seleccionar Brasil como rival (si existe)
        const brazilOption = Array.from(rivalTeamSelect.options).find(opt => 
            opt.text.toLowerCase().includes('brazil') || opt.text.toLowerCase().includes('brasil'));
        if (brazilOption) {
            rivalTeamSelect.value = brazilOption.value;
            setTimeout(() => analyzeRival(brazilOption.value), 100);
        } else if (rivalTeamSelect.options.length > 1) {
            rivalTeamSelect.value = rivalTeamSelect.options[1].value; // Primer equipo real
            setTimeout(() => analyzeRival(rivalTeamSelect.value), 100);
        }
    }, 800);
}

// Actualizar estadísticas de base de datos
function updateDatabaseStats() {
    totalMatchesEl.textContent = rawData ? rawData.length : '0';
    totalTeamsEl.textContent = allTeams.length;
    totalVariablesEl.textContent = derived.length > 0 ? Object.keys(derived[0]).length : '0';
}

// Aplicar filtros de base de datos
function applyDatabaseFilters() {
    const clusterFilter = filterCluster.value;
    const teamFilter = filterTeam.value.toLowerCase();
    
    const container = document.getElementById('database-table-container');
    container.innerHTML = '';
    
    // Filtrar datos
    let filteredData = derived;
    
    if (clusterFilter !== 'all') {
        filteredData = filteredData.filter(d => d.cluster == clusterFilter);
    }
    
    if (teamFilter) {
        filteredData = filteredData.filter(d => 
            (d.team1 && d.team1.toLowerCase().includes(teamFilter)) ||
            (d.team2 && d.team2.toLowerCase().includes(teamFilter))
        );
    }
    
    if (filteredData.length === 0) {
        container.innerHTML = '<p class="no-data">No se encontraron partidos con los filtros seleccionados.</p>';
        return;
    }
    
    // Crear tabla
    const table = document.createElement('table');
    table.className = 'database-table';
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    
    // Encabezados
    const headers = ['Partido', 'Cluster', 'Goles', 'Tiros', 'Posesión %', 'Faltas', 'Intensidad'];
    const headerRow = document.createElement('tr');
    
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    
    // Filas de datos
    filteredData.slice(0, 50).forEach(d => { // Limitar a 50 filas para rendimiento
        const tr = document.createElement('tr');
        
        const cells = [
            d.match_label || `Partido ${d.__idx + 1}`,
            d.cluster,
            d.total_goals || '0',
            d.total_shots || '0',
            d.possession_mean ? `${d.possession_mean.toFixed(1)}%` : '--',
            d.total_fouls || '0',
            d.intensity_index ? d.intensity_index.toFixed(2) : '--'
        ];
        
        cells.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            tr.appendChild(td);
        });
        
        // Color según cluster
        if (d.cluster && clusterColors[d.cluster]) {
            tr.style.borderLeft = `4px solid ${clusterColors[d.cluster].color}`;
        }
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(thead);
    table.appendChild(tbody);
    container.appendChild(table);
    
    // Mostrar estadísticas de filtrado
    showInfoMessage(`Mostrando ${filteredData.length} de ${derived.length} partidos`);
}

// Detectar columnas numéricas (función auxiliar)
function detectNumericColumns() {
    if (!rawData || rawData.length === 0) return;
    const sample = rawData[0];
    const keys = Object.keys(sample);
    
    numericCols = keys.filter(k => {
        let count = 0;
        for (let i = 0; i < Math.min(rawData.length, 30); i++) {
            const v = rawData[i][k];
            if (v === null || v === undefined || v === '') continue;
            const n = Number(String(v).replace('%', '').replace(',', '.'));
            if (!isNaN(n)) count++;
        }
        return count >= Math.min(10, rawData.length * 0.4);
    });
}

// Mostrar mensajes
function showSuccessMessage(message) {
    console.log('✓ ' + message);
    // Opcional: mostrar notificación en la interfaz
    const notification = document.createElement('div');
    notification.className = 'notification success';
    notification.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function showErrorMessage(message) {
    console.error('✗ ' + message);
    alert(message);
}

function showInfoMessage(message) {
    console.log('ℹ ' + message);
}

// Inicializar sistema al cargar la página
console.log('Fútbol Analytics Pro - Sistema Táctico listo');