// Poker Session Tracker JavaScript

let sessionPlayers = [];
let playerStats = {}; // Store all-time player statistics
let sessionStats = {
    totalBuyins: 0,
    totalCashouts: 0,
    startTime: null,
    endTime: null
};
let currentBuyinAmount = 0;
let authToken = null;

// Update API URL to match server routes
const API_URL = '/api';

// Function to save session state to localStorage
function saveSessionState() {
    const sessionState = {
        sessionPlayers,
        sessionStats,
        currentBuyinAmount
    };
    localStorage.setItem('pokerSession', JSON.stringify(sessionState));
}

// Function to load session state from localStorage
function loadSessionState() {
    const savedSession = localStorage.getItem('pokerSession');
    if (savedSession) {
        const sessionState = JSON.parse(savedSession);
        sessionPlayers = sessionState.sessionPlayers;
        sessionStats = sessionState.sessionStats;
        currentBuyinAmount = sessionState.currentBuyinAmount;
        
        // Convert string dates back to Date objects
        if (sessionStats.startTime) {
            sessionStats.startTime = new Date(sessionStats.startTime);
        }
        if (sessionStats.endTime) {
            sessionStats.endTime = new Date(sessionStats.endTime);
        }
        
        // Update UI
        renderPlayerList();
        updateSessionStats();
        
        // Update session controls state
        const startBtn = document.getElementById('start-session-btn');
        const endBtn = document.getElementById('end-session-btn');
        const addPlayerForm = document.getElementById('add-player-form');
        
        if (sessionStats.startTime && !sessionStats.endTime) {
            startBtn.disabled = true;
            endBtn.disabled = false;
            addPlayerForm.style.display = 'block';
        } else {
            startBtn.disabled = false;
            endBtn.disabled = true;
            addPlayerForm.style.display = 'none';
        }
    }
}

// Wait for the DOM to load
window.addEventListener('DOMContentLoaded', () => {
    loadPlayerStats();
    loadSessionState(); // Load saved session state
    setupSessionControls();
    setupAddPlayerForm();
    setupBuyinControls();
    setupResetButton();
    setupLoginForm();
    renderAllTimeStats();
    updateAllTimeStats();
});

// --- API Functions ---
async function loadPlayerStats() {
    try {
        const response = await fetch(`${API_URL}/players`);
        if (!response.ok) {
            throw new Error(`Failed to load players: ${response.status}`);
        }
        const players = await response.json();
        playerStats = {};
        if (Array.isArray(players)) {
            players.forEach(player => {
                playerStats[player.name] = player.stats;
            });
        } else {
            console.error('Received invalid player data:', players);
            playerStats = {};
        }
        renderPlayerList();
        renderAllTimeStats();
        updateAllTimeStats();
    } catch (error) {
        console.error('Error loading player stats:', error);
        playerStats = {};
        // Show error to user
        alert('Failed to load player stats. Please check if the server is running and try again.');
    }
}

async function addPlayer(name, buyinAmount = 0) {
    try {
        const response = await fetch(`${API_URL}/players`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                stats: {
                    totalSessions: 1,
                    totalBuyins: buyinAmount,
                    totalCashouts: 0,
                    netProfit: -buyinAmount,
                    biggestWin: 0,
                    biggestLoss: 0
                }
            })
        });
        if (!response.ok) throw new Error('Failed to add player');
        const newPlayer = await response.json();
        playerStats[name] = newPlayer.stats;
    } catch (error) {
        console.error('Error adding player:', error);
        throw error;
    }
}

async function updatePlayerStats(playerName, stats) {
    try {
        const response = await fetch(`${API_URL}/players/${playerName}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ stats })
        });
        if (!response.ok) throw new Error(`Failed to update stats for ${playerName}`);
        const updatedPlayer = await response.json();
        playerStats[playerName] = updatedPlayer.stats;
    } catch (error) {
        console.error('Error updating player stats:', error);
        throw error;
    }
}

// --- UI Functions ---
function setupSessionControls() {
    const startBtn = document.getElementById('start-session-btn');
    const endBtn = document.getElementById('end-session-btn');

    startBtn.addEventListener('click', () => {
        sessionStats.startTime = new Date();
        startBtn.disabled = true;
        endBtn.disabled = false;
        document.getElementById('add-player-form').style.display = 'block';
        saveSessionState(); // Save state after starting session
    });

    endBtn.addEventListener('click', () => {
        sessionStats.endTime = new Date();
        startBtn.disabled = false;
        endBtn.disabled = true;
        document.getElementById('add-player-form').style.display = 'none';
        // Reset session
        sessionPlayers = [];
        sessionStats = {
            totalBuyins: 0,
            totalCashouts: 0,
            startTime: null,
            endTime: null
        };
        updateSessionStats();
        localStorage.removeItem('pokerSession'); // Clear saved session
    });
}

function setupAddPlayerForm() {
    const form = document.getElementById('player-form');
    const nameInput = document.getElementById('player-name');
    const buyinAmount = document.getElementById('buyin-amount');
    const suggestionsDiv = document.getElementById('player-suggestions');

    // Setup autocomplete
    nameInput.addEventListener('input', () => {
        const value = nameInput.value.trim().toLowerCase();
        if (value.length === 0) {
            suggestionsDiv.innerHTML = '';
            return;
        }

        const matches = Object.keys(playerStats).filter(name => 
            name.toLowerCase().includes(value)
        );

        if (matches.length > 0) {
            suggestionsDiv.innerHTML = matches
                .map(name => `<div class="autocomplete-suggestion">${name}</div>`)
                .join('');
        } else {
            suggestionsDiv.innerHTML = '';
        }
    });

    // Handle suggestion clicks
    suggestionsDiv.addEventListener('click', (e) => {
        if (e.target.classList.contains('autocomplete-suggestion')) {
            nameInput.value = e.target.textContent;
            suggestionsDiv.innerHTML = '';
        }
    });

    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#player-form')) {
            suggestionsDiv.innerHTML = '';
        }
    });

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = nameInput.value.trim();
        
        if (name && currentBuyinAmount > 0) {
            // Check if player is already in the session
            if (sessionPlayers.some(player => player.name === name)) {
                alert('This player is already in the session!');
                return;
            }

            try {
                if (playerStats[name]) {
                    // Update existing player
                    const stats = playerStats[name];
                    stats.totalSessions++;
                    stats.totalBuyins += currentBuyinAmount;
                    stats.netProfit = stats.totalCashouts - stats.totalBuyins;
                    await updatePlayerStats(name, stats);
                } else {
                    // Add new player
                    await addPlayer(name, currentBuyinAmount);
                }
                
                // Add to session players
                sessionPlayers.push({ name, buyin: currentBuyinAmount });
                sessionStats.totalBuyins += currentBuyinAmount;
                
                // Update UI immediately
                renderPlayerList();
                updateSessionStats();
                renderAllTimeStats();
                
                // Clear form
                nameInput.value = '';
                currentBuyinAmount = 0;
                buyinAmount.textContent = '$0';
                suggestionsDiv.innerHTML = '';

                saveSessionState(); // Save state after adding player
            } catch (error) {
                console.error('Error adding/updating player:', error);
                alert('Failed to add/update player: ' + error.message);
            }
        }
    });
}

function setupBuyinControls() {
    const buyinAmount = document.getElementById('buyin-amount');
    const buyinBtns = document.querySelectorAll('.buyin-btn');
    const clearBtn = document.getElementById('buyin-clear-btn');
    
    buyinBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const increment = parseInt(btn.dataset.inc);
            currentBuyinAmount += increment;
            buyinAmount.textContent = `$${currentBuyinAmount}`;
        });
    });
    
    clearBtn.addEventListener('click', () => {
        currentBuyinAmount = 0;
        buyinAmount.textContent = '$0';
    });
}

function renderPlayerList() {
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = `
        <div class="player-list-header">
            <span class="player-name">Player</span>
            <span class="player-buyin">Buy-in</span>
            <span class="player-actions">Actions</span>
        </div>
        <div class="player-list-content">
            ${sessionPlayers.map(({ name, buyin }) => `
                <div class="player-row">
                    <span class="player-name">${name}</span>
                    <span class="player-buyin">$${buyin}</span>
                    <div class="player-actions">
                        <button class="rebuy-btn" onclick="handleRebuy('${name}')">Rebuy</button>
                        <button class="cashout-btn" onclick="handleCashout('${name}')">Cash Out</button>
                        <button class="remove-btn" onclick="handleRemove('${name}')">Remove</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderAllTimeStats() {
    const allTimeStatsDiv = document.querySelector('#alltime-stats .all-players-stats');
    if (!allTimeStatsDiv) return;
    
    // Get all players and sort them alphabetically
    const sortedPlayers = Object.entries(playerStats)
        .sort(([nameA], [nameB]) => nameA.localeCompare(nameB));

    allTimeStatsDiv.innerHTML = sortedPlayers.map(([name, stats]) => `
        <div class="player-stats">
            <h3>${name}</h3>
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Total Sessions:</span>
                    <span class="stat-value">${stats.totalSessions}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total Buy-ins:</span>
                    <span class="stat-value">$${stats.totalBuyins}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total Cash-outs:</span>
                    <span class="stat-value">$${stats.totalCashouts}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Net Profit:</span>
                    <span class="stat-value ${stats.netProfit >= 0 ? 'profit' : 'loss'}">$${stats.netProfit}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Biggest Win:</span>
                    <span class="stat-value profit">$${stats.biggestWin}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Biggest Loss:</span>
                    <span class="stat-value loss">$${stats.biggestLoss}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function updateSessionStats() {
    const sessionStatsDiv = document.getElementById('session-stats');
    sessionStatsDiv.innerHTML = `
        <h3>Current Session</h3>
        <p>Total Buy-ins: $${sessionStats.totalBuyins}</p>
        <p>Total Cash-outs: $${sessionStats.totalCashouts}</p>
        <p>Net: $${sessionStats.totalCashouts - sessionStats.totalBuyins}</p>
        ${sessionStats.startTime ? `<p>Started: ${sessionStats.startTime.toLocaleTimeString()}</p>` : ''}
    `;
}

// Function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Function to update all-time stats
async function updateAllTimeStats() {
    try {
        const response = await fetch('/api/players');
        const players = await response.json();
        
        const statsBody = document.getElementById('allTimeStatsBody');
        statsBody.innerHTML = '';
        
        players.forEach(player => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${player.name}</td>
                <td>${player.stats.totalSessions}</td>
                <td>${formatCurrency(player.stats.totalBuyins)}</td>
                <td>${formatCurrency(player.stats.totalCashouts)}</td>
                <td>${formatCurrency(player.stats.netProfit)}</td>
                <td>${formatCurrency(player.stats.biggestWin)}</td>
                <td>${formatCurrency(player.stats.biggestLoss)}</td>
            `;
            statsBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching all-time stats:', error);
    }
}

// Player action handlers
async function handleRebuy(playerName) {
    const amount = parseInt(prompt('Enter rebuy amount:'));
    if (amount && amount > 0) {
        try {
            // Update session player's buy-in
            const sessionPlayer = sessionPlayers.find(p => p.name === playerName);
            if (sessionPlayer) {
                sessionPlayer.buyin += amount;
                sessionStats.totalBuyins += amount;
            }

            // Update player's stats in database
            const stats = playerStats[playerName];
            stats.totalBuyins += amount;
            stats.netProfit = stats.totalCashouts - stats.totalBuyins;
            await updatePlayerStats(playerName, stats);

            // Update UI
            renderPlayerList();
            updateSessionStats();
            
            saveSessionState(); // Save state after rebuy
        } catch (error) {
            console.error('Error processing rebuy:', error);
            alert('Failed to process rebuy: ' + error.message);
        }
    }
}

async function handleCashout(playerName) {
    const amount = parseInt(prompt('Enter cashout amount:'));
    if (amount && amount > 0) {
        try {
            // Update session player's cashout
            const sessionPlayer = sessionPlayers.find(p => p.name === playerName);
            if (!sessionPlayer) {
                throw new Error('Player not found in current session');
            }

            // Ensure player stats exist
            if (!playerStats[playerName]) {
                // Try to load player stats from database
                const response = await fetch(`${API_URL}/players/${playerName}`);
                if (!response.ok) {
                    throw new Error('Failed to load player stats');
                }
                const player = await response.json();
                playerStats[playerName] = player.stats;
            }

            sessionStats.totalCashouts += amount;
            // Calculate profit/loss for this session
            const sessionProfit = amount - sessionPlayer.buyin;
            // Remove player from session
            sessionPlayers = sessionPlayers.filter(p => p.name !== playerName);

            // Update player's stats in database
            const stats = playerStats[playerName];
            stats.totalCashouts += amount;
            // Update net profit as total cashouts minus total buyins
            stats.netProfit = stats.totalCashouts - stats.totalBuyins;
            
            // Calculate win/loss for this session
            if (sessionProfit > 0) {
                // Only update biggest win if there was a profit this session
                stats.biggestWin = Math.max(stats.biggestWin, sessionProfit);
            } else if (sessionProfit < 0) {
                // Update biggest loss if there was a loss this session
                stats.biggestLoss = Math.max(stats.biggestLoss, Math.abs(sessionProfit));
            }
            
            await updatePlayerStats(playerName, stats);

            // Update UI
            renderPlayerList();
            updateSessionStats();
            renderAllTimeStats();
            
            saveSessionState(); // Save state after cashout
        } catch (error) {
            console.error('Error processing cashout:', error);
            alert('Failed to process cashout: ' + error.message);
        }
    }
}

async function handleRemove(playerName) {
    if (confirm(`Are you sure you want to remove ${playerName}?`)) {
        try {
            // Get the player's buy-in amount before removing
            const sessionPlayer = sessionPlayers.find(p => p.name === playerName);
            if (sessionPlayer) {
                // Update player's stats in database before removing from session
                const stats = playerStats[playerName];
                // Count the full buy-in as a loss when removing without cashout
                stats.biggestLoss = Math.max(stats.biggestLoss, sessionPlayer.buyin);
                await updatePlayerStats(playerName, stats);
            }

            // Remove from session players only
            sessionPlayers = sessionPlayers.filter(player => player.name !== playerName);
            
            // Update UI
            renderPlayerList();
            renderAllTimeStats();
            updateSessionStats();
            updateAllTimeStats();
            
            saveSessionState(); // Save state after removing player
        } catch (error) {
            console.error('Error removing player:', error);
            alert('Failed to remove player: ' + error.message);
        }
    }
}

// Login Modal Functions
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'block';
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

// Login Form Handler
function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                console.log('Attempting login...');
                const response = await fetch(`${API_URL}/admin/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.message || 'Login failed');
                }

                console.log('Login successful, storing token');
                authToken = data.token;
                closeLoginModal();
                // Now that we're logged in, proceed with reset
                await resetStats();
            } catch (error) {
                console.error('Login error:', error);
                alert('Login failed: ' + error.message);
            }
        });
    }
}

// Update reset stats functionality
async function resetStats() {
    console.log('Attempting to reset stats...');
    if (!authToken) {
        console.log('No auth token available');
        showLoginModal();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/reset-stats`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        console.log('Reset response status:', response.status);
        
        if (!response.ok) {
            const data = await response.json();
            if (response.status === 401 || response.status === 403) {
                console.log('Authentication required, showing login modal');
                authToken = null;
                showLoginModal();
                return;
            }
            throw new Error(data.message || 'Failed to reset stats');
        }
        
        console.log('Stats reset successful, clearing data...');
        // Clear local player stats
        playerStats = {};
        // Clear session players
        sessionPlayers = [];
        // Reset session stats
        sessionStats = {
            totalBuyins: 0,
            totalCashouts: 0,
            startTime: null,
            endTime: null
        };
        // Update UI
        renderPlayerList();
        renderAllTimeStats();
        updateSessionStats();
        updateAllTimeStats();
        alert('All players and their stats have been reset successfully');
    } catch (error) {
        console.error('Error resetting stats:', error);
        alert('Failed to reset stats: ' + error.message);
    }
}

// Update reset button click handler
function setupResetButton() {
    const resetButton = document.getElementById('reset-stats-btn');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset all player stats? This cannot be undone.')) {
                if (authToken) {
                    resetStats();
                } else {
                    showLoginModal();
                }
            }
        });
    }
} 