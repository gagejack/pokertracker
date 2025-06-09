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
let currentTransferFrom = null;
let selectedBuyer = null;
let currentCashoutPlayer = null;
let currentRebuyPlayer = null;
let isAdmin = false;
let pendingAction = null;

// Update API URL to match server routes
const API_URL = '/api';

// Tab Switching Functionality
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const gameContents = document.querySelectorAll('.game-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            gameContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const tabName = button.getAttribute('data-tab');
            document.getElementById(`${tabName}-content`).classList.add('active');
        });
    });
});

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
    // Add event listener for cashout form after DOM is loaded
    document.getElementById('cashoutForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const amount = parseFloat(document.getElementById('cashoutAmount').value);
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid cashout amount.');
            return;
        }
        
        if (currentCashoutPlayer) {
            await handleCashout(currentCashoutPlayer, amount);
        }
        closeCashoutModal();
    });
    // Add event listener for rebuy form after DOM is loaded
    document.getElementById('rebuyForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const amount = parseFloat(document.getElementById('rebuyAmount').value);
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid rebuy amount.');
            return;
        }

        if (currentRebuyPlayer) {
            await handleRebuy(currentRebuyPlayer, amount);
        }
        closeRebuyModal();
    });
    renderAllTimeStats();
    updateAllTimeStats();
    // Add event listener for transfer form after DOM is loaded
    document.getElementById('transferForm').addEventListener('submit', handleTransfer);

    // Setup controls for Cashout and Rebuy Modals
    setupModalAmountControls('cashoutAmount', 'cashout-controls', 'cashout-clear-btn');
    setupModalAmountControls('rebuyAmount', 'rebuy-controls', 'rebuy-clear-btn');

    // Edit Stats button listeners
    document.getElementById('edit-stats-btn').addEventListener('click', () => showEditStatsModal('poker'));
    document.getElementById('blackjack-edit-stats-btn').addEventListener('click', () => showEditStatsModal('blackjack'));
    
    // Player select change listener
    document.getElementById('editPlayerSelect').addEventListener('change', function() {
        const gameType = document.querySelector('.game-content.active').id.split('-')[0];
        populateEditForm(this.value, gameType);
    });
    
    // Edit stats form submit listener
    document.getElementById('editStatsForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const gameType = document.querySelector('.game-content.active').id.split('-')[0];
        const playerName = document.getElementById('editPlayerSelect').value;
        
        // Validate form values
        const totalSessions = parseInt(document.getElementById('editTotalSessions').value);
        const totalBuyins = parseFloat(document.getElementById('editTotalBuyins').value);
        const totalCashouts = parseFloat(document.getElementById('editTotalCashouts').value);
        const biggestWin = parseFloat(document.getElementById('editBiggestWin').value);

        // Validate numeric values
        if (isNaN(totalSessions) || isNaN(totalBuyins) || isNaN(totalCashouts) || isNaN(biggestWin)) {
            alert('Please enter valid numbers for all fields');
            return;
        }

        const stats = {
            totalSessions,
            totalBuyins,
            totalCashouts,
            netProfit: totalCashouts - totalBuyins,
            biggestWin
        };
        
        try {
            console.log('Sending stats update request:', { gameType, playerName, stats });
            
            const response = await fetch(`${API_URL}/stats/${gameType}/${encodeURIComponent(playerName)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(stats)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                console.log('Stats updated successfully:', data);
                // Refresh the stats display
                await loadAllTimeStats(gameType);
                closeEditStatsModal();
                alert('Stats updated successfully');
            } else {
                console.error('Failed to update stats:', data);
                alert('Failed to update stats: ' + (data.message || 'Please try again'));
            }
        } catch (error) {
            console.error('Error updating stats:', error);
            alert('An error occurred while updating stats: ' + error.message);
        }
    });

    // Haptic Feedback Function
    function vibrate(duration = 50) {
        if ('vibrate' in navigator) {
            navigator.vibrate(duration);
        }
    }

    // Add haptic feedback to all buttons
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => vibrate());
    });

    // Add haptic feedback to form submissions
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', () => vibrate(100)); // Longer vibration for form submissions
    });

    // Add haptic feedback to tab buttons with a different pattern
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => vibrate(30)); // Shorter vibration for tabs
    });

    // Add haptic feedback to buyin buttons with a different pattern
    document.querySelectorAll('.buyin-btn').forEach(button => {
        button.addEventListener('click', () => vibrate(40)); // Medium vibration for buyin buttons
    });

    // Add haptic feedback to clear buttons
    document.querySelectorAll('.buyin-clear-btn').forEach(button => {
        button.addEventListener('click', () => vibrate(60)); // Longer vibration for clear actions
    });

    // Add haptic feedback to player action buttons (rebuy, cashout, remove)
    document.querySelectorAll('.rebuy-btn, .cashout-btn, .remove-btn').forEach(button => {
        button.addEventListener('click', () => vibrate(70)); // Longer vibration for important actions
    });
});

// Generic function to set up amount controls for modals
function setupModalAmountControls(amountInputId, controlsContainerId, clearButtonId) {
    const amountInput = document.getElementById(amountInputId);
    const controlsContainer = document.getElementById(controlsContainerId);
    const clearBtn = document.getElementById(clearButtonId);

    if (!amountInput || !controlsContainer || !clearBtn) {
        console.error(`Missing elements for modal amount controls: ${amountInputId}, ${controlsContainerId}, ${clearButtonId}`);
        return;
    }

    controlsContainer.querySelectorAll('.buyin-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const increment = parseInt(btn.dataset.inc);
            let currentAmount = parseFloat(amountInput.value) || 0;
            currentAmount += increment;
            amountInput.value = currentAmount;
        });
    });

    clearBtn.addEventListener('click', () => {
        amountInput.value = 0;
    });
}

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
        
        // Add player to session with isBanker property
        sessionPlayers.push({
            name: name,
            buyin: buyinAmount,
            isBanker: false
        });
        
        // Update session stats with the new buy-in
        sessionStats.totalBuyins += buyinAmount;
        
        renderPlayerList();
        updateSessionStats();
        saveSessionState();
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
        // If there are players in the session, show the cashout modal
        if (sessionPlayers.length > 0) {
            showEndSessionModal();
        } else {
            endSession();
        }
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
                    
                    // Add to session players
                    sessionPlayers.push({ name, buyin: currentBuyinAmount, isBanker: false });
                    sessionStats.totalBuyins += currentBuyinAmount;
                } else {
                    // Add new player
                    await addPlayer(name, currentBuyinAmount);
                }
                
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
    const gameType = document.querySelector('.game-content.active').id.split('-')[0];
    const listId = gameType === 'poker' ? 'player-list' : 'blackjack-player-list';
    
    // Check if any player is banker
    const hasBanker = sessionPlayers.some(p => p.isBanker);
    
    playerList.innerHTML = sessionPlayers.map(player => `
        <div class="player-card">
            <div class="player-header">
                <div class="player-info">
                    <h3>${player.name}</h3>
                    <span class="buyin-amount">$${player.buyin}</span>
                </div>
                <div class="player-actions">
                    <button class="banker-btn ${player.isBanker ? 'active' : ''}" 
                            onclick="toggleBanker('${player.name}')"
                            ${hasBanker && !player.isBanker ? 'disabled' : ''}>
                        <i class="fas fa-landmark"></i> Banker
                    </button>
                    <button class="rebuy-btn" onclick="showRebuyModal('${player.name}')">
                        <i class="fas fa-plus"></i> Rebuy
                    </button>
                    <button class="cashout-btn" onclick="showCashoutModal('${player.name}')">
                        <i class="fas fa-money-bill-wave"></i> Cash Out
                    </button>
                    <button class="transfer-btn" onclick="showTransferModal('${player.name}')">
                        <i class="fas fa-exchange-alt"></i> Buy from Player
                    </button>
                    <button class="remove-btn" onclick="handleRemove('${player.name}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
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
                    <span class="stat-value">${formatCurrency(stats.totalBuyins)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total Cash-outs:</span>
                    <span class="stat-value">${formatCurrency(stats.totalCashouts)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Net Profit:</span>
                    <span class="stat-value ${stats.netProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(stats.netProfit)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Biggest Win:</span>
                    <span class="stat-value profit">${formatCurrency(stats.biggestWin || 0)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Biggest Loss:</span>
                    <span class="stat-value loss">${formatCurrency(stats.biggestLoss || 0)}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function updateSessionStats() {
    const sessionStatsDiv = document.getElementById('session-stats');
    const gameType = document.querySelector('.game-content.active').id.split('-')[0];
    const statsId = gameType === 'poker' ? 'session-stats' : 'blackjack-session-stats';
    
    // Calculate bank balance (total buyins - total cashouts)
    const bankBalance = sessionStats.totalBuyins - sessionStats.totalCashouts;
    
    sessionStatsDiv.innerHTML = `
        <h3>Current Session</h3>
        <p>Total Buy-ins: $${sessionStats.totalBuyins}</p>
        <p>Total Cash-outs: $${sessionStats.totalCashouts}</p>
        <p>Bank Balance: $${bankBalance}</p>
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
                <td class="${player.stats.netProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(player.stats.netProfit)}</td>
                <td class="profit">${formatCurrency(player.stats.biggestWin || 0)}</td>
                <td class="loss">${formatCurrency(player.stats.biggestLoss || 0)}</td>
            `;
            statsBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error fetching all-time stats:', error);
    }
}

// Player action handlers
async function handleRebuy(playerName, specifiedAmount = null) {
    const amount = specifiedAmount || parseInt(prompt('Enter rebuy amount:'));
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

// Rebuy Modal Functions
function showRebuyModal(playerName) {
    currentRebuyPlayer = playerName;
    document.getElementById('rebuyModal').style.display = 'block';
    document.getElementById('rebuyAmount').value = ''; // Clear previous amount
}

function closeRebuyModal() {
    document.getElementById('rebuyModal').style.display = 'none';
    currentRebuyPlayer = null;
}

// Cashout Modal Functions
function showCashoutModal(playerName) {
    currentCashoutPlayer = playerName;
    document.getElementById('cashoutModal').style.display = 'block';
    document.getElementById('cashoutAmount').value = ''; // Clear previous amount
}

function closeCashoutModal() {
    document.getElementById('cashoutModal').style.display = 'none';
    currentCashoutPlayer = null;
}

async function handleCashout(playerName, amount) {
    try {
        console.log('=== Cashout Process Started ===');
        console.log('Player:', playerName);
        console.log('Cashout Amount:', amount);

        // Update session player's cashout
        const sessionPlayer = sessionPlayers.find(p => p.name === playerName);
        if (!sessionPlayer) {
            console.error('Player not found in session:', playerName);
            throw new Error('Player not found in current session');
        }

        console.log('Current Player State:', {
            name: sessionPlayer.name,
            buyin: sessionPlayer.buyin,
            currentCashout: sessionPlayer.cashout || 0
        });

        // Validate amount is not negative
        if (amount < 0) {
            console.error('Invalid cashout amount:', amount);
            throw new Error('Cashout amount cannot be negative');
        }

        // Update the player's cashout amount
        sessionPlayer.cashout = amount;
        sessionStats.totalCashouts += amount;
        
        console.log('Updated Session Stats:', {
            totalBuyins: sessionStats.totalBuyins,
            totalCashouts: sessionStats.totalCashouts
        });
        
        // Update player's stats in database
        const stats = playerStats[playerName];
        stats.totalCashouts += amount;
        stats.netProfit = stats.totalCashouts - stats.totalBuyins;

        // Calculate profit/loss for this session
        const sessionProfit = amount - sessionPlayer.buyin;
        
        // Update biggest win if this session's profit is higher
        if (sessionProfit > (stats.biggestWin || 0)) {
            stats.biggestWin = sessionProfit;
            console.log('New biggest win recorded:', stats.biggestWin);
        }

        // Update biggest loss if player lost money
        if (amount < sessionPlayer.buyin) {
            const sessionLoss = sessionPlayer.buyin - amount;
            if (sessionLoss > (stats.biggestLoss || 0)) {
                stats.biggestLoss = sessionLoss;
                console.log('New biggest loss recorded:', stats.biggestLoss);
            }
        }

        console.log('Updated Player Stats:', {
            name: playerName,
            totalBuyins: stats.totalBuyins,
            totalCashouts: stats.totalCashouts,
            netProfit: stats.netProfit,
            biggestWin: stats.biggestWin,
            biggestLoss: stats.biggestLoss
        });

        await updatePlayerStats(playerName, stats);

        // If player cashed out more than their buy-in, remove them from the session
        if (amount >= sessionPlayer.buyin) {
            console.log('Player fully cashed out, removing from session');
            sessionPlayers = sessionPlayers.filter(p => p.name !== playerName);
        } else {
            // Otherwise, just update their buyin amount
            const newBuyin = sessionPlayer.buyin - amount;
            console.log('Updating player buyin:', {
                oldBuyin: sessionPlayer.buyin,
                newBuyin: newBuyin
            });
            sessionPlayer.buyin = newBuyin;
        }

        // Update UI
        renderPlayerList();
        updateSessionStats();
        renderAllTimeStats();
        updateAllTimeStats();
        
        saveSessionState(); // Save state after cashout
        console.log('=== Cashout Process Completed ===');
    } catch (error) {
        console.error('Error processing cashout:', error);
        alert('Failed to process cashout: ' + error.message);
    }
}

async function handleRemove(playerName) {
    if (!confirm(`Are you sure you want to remove ${playerName} from the session?`)) {
        return;
    }

    try {
        await removePlayer(playerName);
    } catch (error) {
        console.error('Error removing player:', error);
        alert('Failed to remove player. Please try again.');
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
        loginForm.addEventListener('submit', async function(e) {
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
                
                if (response.ok) {
                    console.log('Login successful, storing token');
                    authToken = data.token;
                    isAdmin = true;
                    closeLoginModal();
                    
                    // Handle the pending action after successful login
                    if (pendingAction) {
                        if (pendingAction.type === 'edit') {
                            showEditStatsModal(pendingAction.gameType);
                        } else if (pendingAction.type === 'reset') {
                            resetAllStats(pendingAction.gameType);
                        }
                        pendingAction = null;
                    }
                } else {
                    alert('Login failed: ' + (data.message || 'Invalid credentials'));
                }
            } catch (error) {
                console.error('Login error:', error);
                alert('Login failed: ' + (error.message || 'An error occurred during login'));
            }
        });
    }
}

// Update reset stats functionality
async function resetAllStats(gameType) {
    console.log('Attempting to reset stats...');
    if (!authToken) {
        console.log('No auth token available');
        pendingAction = { type: 'reset', gameType };
        showLoginModal();
        return;
    }

    if (!confirm('Are you sure you want to reset all statistics? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/reset-stats`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.message || 'Failed to reset statistics');
        }

        alert('All statistics have been reset successfully.');
        // Reload the stats
        await loadPlayerStats();
        renderAllTimeStats();
        updateAllTimeStats();
    } catch (error) {
        console.error('Error resetting stats:', error);
        alert('Failed to reset statistics: ' + error.message);
    }
}

// Update the setupResetButton function
function setupResetButton() {
    const resetBtn = document.getElementById('reset-stats-btn');
    const blackjackResetBtn = document.getElementById('blackjack-reset-stats-btn');

    if (resetBtn) {
        resetBtn.addEventListener('click', () => resetAllStats('poker'));
    }
    if (blackjackResetBtn) {
        blackjackResetBtn.addEventListener('click', () => resetAllStats('blackjack'));
    }
}

// Transfer Modal Functions
function showTransferModal(playerId) {
    currentTransferFrom = playerId;
    document.getElementById('transferModal').style.display = 'block';
    document.getElementById('transferAmount').value = ''; // Clear previous amount
    selectedBuyer = null; // Reset selected buyer
    
    // Populate buyer list
    const buyerList = document.getElementById('buyerList');
    buyerList.innerHTML = sessionPlayers
        .filter(player => player.name !== playerId) // Exclude the seller
        .map(player => `
            <div class="buyer-option" onclick="selectBuyer('${player.name}')">
                ${player.name}
            </div>
        `).join('');
}

function selectBuyer(buyerName) {
    selectedBuyer = buyerName;
    // Update visual selection
    const buyerOptions = document.querySelectorAll('.buyer-option');
    buyerOptions.forEach(option => {
        if (option.textContent.trim() === buyerName) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

function closeTransferModal() {
    document.getElementById('transferModal').style.display = 'none';
    currentTransferFrom = null;
    selectedBuyer = null;
}

async function handleTransfer(event) {
    event.preventDefault();
    
    if (!selectedBuyer) {
        alert('Please select a buyer first');
        return;
    }

    const amount = parseFloat(document.getElementById('transferAmount').value);
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }

    try {
        // First, cash out the seller
        const seller = sessionPlayers.find(p => p.name === currentTransferFrom);
        if (!seller) {
            alert('Seller not found');
            return;
        }

        // Temporarily store the amount for the rebuy
        const transferAmount = amount;

        // Call handleCashout for the seller
        await handleCashout(currentTransferFrom, transferAmount);

        // Then, rebuy the buyer
        const buyer = sessionPlayers.find(p => p.name === selectedBuyer);
        if (!buyer) {
            alert('Buyer not found');
            return;
        }

        // Call handleRebuy for the buyer with the same amount
        await handleRebuy(selectedBuyer, transferAmount);

        // Close the transfer modal
        closeTransferModal();
    } catch (error) {
        console.error('Error processing transfer:', error);
        alert('Failed to process transfer: ' + error.message);
    }
}

// Edit Stats Functionality
function showEditStatsModal(gameType) {
    if (!isAdmin) {
        pendingAction = { type: 'edit', gameType };
        showLoginModal();
        return;
    }
    
    const modal = document.getElementById('editStatsModal');
    const playerSelect = document.getElementById('editPlayerSelect');
    const table = document.getElementById(gameType === 'poker' ? 'allTimeStatsTable' : 'blackjack-allTimeStatsTable');
    
    // Only clear and repopulate if there are players in the table
    if (table && table.querySelector('tbody tr')) {
        // Clear existing options
        playerSelect.innerHTML = '';
        
        // Add options for each player in the table
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const playerName = row.cells[0].textContent;
            const option = document.createElement('option');
            option.value = playerName;
            option.textContent = playerName;
            playerSelect.appendChild(option);
        });
        
        // Show the modal
        modal.style.display = 'block';
    } else {
        alert('No players found in the statistics table.');
    }
}

function closeEditStatsModal() {
    const modal = document.getElementById('editStatsModal');
    modal.style.display = 'none';
}

function populateEditForm(playerName, gameType) {
    const table = document.getElementById(gameType === 'poker' ? 'allTimeStatsTable' : 'blackjack-allTimeStatsTable');
    const rows = table.querySelectorAll('tbody tr');
    
    for (const row of rows) {
        if (row.cells[0].textContent === playerName) {
            document.getElementById('editTotalSessions').value = row.cells[1].textContent;
            document.getElementById('editTotalBuyins').value = parseFloat(row.cells[2].textContent.replace('$', ''));
            document.getElementById('editTotalCashouts').value = parseFloat(row.cells[3].textContent.replace('$', ''));
            document.getElementById('editBiggestWin').value = parseFloat(row.cells[5].textContent.replace('$', ''));
            break;
        }
    }
}

// Function to load all-time stats
async function loadAllTimeStats(gameType) {
    try {
        const response = await fetch(`${API_URL}/players`);
        const players = await response.json();
        
        const tableBody = document.getElementById(gameType === 'poker' ? 'allTimeStatsBody' : 'blackjack-allTimeStatsBody');
        tableBody.innerHTML = '';
        
        players.forEach(player => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${player.name}</td>
                <td>${player.stats.totalSessions}</td>
                <td>$${player.stats.totalBuyins.toFixed(2)}</td>
                <td>$${player.stats.totalCashouts.toFixed(2)}</td>
                <td class="${player.stats.netProfit >= 0 ? 'profit' : 'loss'}">$${player.stats.netProfit.toFixed(2)}</td>
                <td class="profit">$${(player.stats.biggestWin || 0).toFixed(2)}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading all-time stats:', error);
        alert('Error loading statistics. Please refresh the page.');
    }
}

// Update the toggleBanker function
function toggleBanker(playerName) {
    // Find the player
    const player = sessionPlayers.find(p => p.name === playerName);
    if (!player) return;

    // If player is already banker, do nothing
    if (player.isBanker) return;

    // Check if any other player is already banker
    const hasBanker = sessionPlayers.some(p => p.isBanker);
    if (hasBanker) return;

    // Set new banker
    player.isBanker = true;

    // Update UI
    renderPlayerList();
    saveSessionState();
}

// End Session Modal Functions
function showEndSessionModal() {
    const modal = document.getElementById('endSessionModal');
    const playersContainer = document.getElementById('endSessionPlayers');
    
    // Clear previous content
    playersContainer.innerHTML = '';
    
    // Find the banker
    const banker = sessionPlayers.find(p => p.isBanker);
    const nonBankers = sessionPlayers.filter(p => !p.isBanker);
    
    // Create cashout form for each non-banker player
    nonBankers.forEach(player => {
        const playerForm = document.createElement('div');
        playerForm.className = 'player-cashout-form';
        playerForm.innerHTML = `
            <div class="form-group">
                <label for="cashout-${player.name}">${player.name} (Current Buy-in: $${player.buyin})</label>
                <div class="cashout-controls">
                    <input type="number" id="cashout-${player.name}" 
                           placeholder="Enter cashout amount" required min="0" step="1">
                </div>
            </div>
        `;
        playersContainer.appendChild(playerForm);
    });

    // Add banker info section
    if (banker) {
        const bankerInfo = document.createElement('div');
        bankerInfo.className = 'banker-info';
        bankerInfo.innerHTML = `
            <div class="form-group">
                <h3>${banker.name} (Banker)</h3>
                <p>Total Buy-ins: $${sessionStats.totalBuyins}</p>
                <p>Total Cash-outs: $${sessionStats.totalCashouts}</p>
                <p>Bank Balance: $${sessionStats.totalBuyins - sessionStats.totalCashouts}</p>
            </div>
        `;
        playersContainer.appendChild(bankerInfo);
    }
    
    modal.style.display = 'block';
}

function closeEndSessionModal() {
    document.getElementById('endSessionModal').style.display = 'none';
}

async function processEndSessionCashouts() {
    const playersContainer = document.getElementById('endSessionPlayers');
    const forms = playersContainer.querySelectorAll('.player-cashout-form');
    let hasError = false;

    // Process cashouts for non-banker players
    for (const form of forms) {
        const input = form.querySelector('input[type="number"]');
        const amount = parseFloat(input.value);
        const playerName = input.id.replace('cashout-', '');

        if (isNaN(amount) || amount < 0) {
            alert(`Please enter a valid cashout amount for ${playerName} (must be 0 or greater)`);
            hasError = true;
            break;
        }

        try {
            await handleCashout(playerName, amount);
        } catch (error) {
            alert(`Error processing cashout for ${playerName}: ${error.message}`);
            hasError = true;
            break;
        }
    }

    if (!hasError) {
        // Handle banker's final cashout
        const banker = sessionPlayers.find(p => p.isBanker);
        if (banker) {
            const bankBalance = sessionStats.totalBuyins - sessionStats.totalCashouts;
            try {
                await handleCashout(banker.name, bankBalance);
            } catch (error) {
                alert(`Error processing banker's final cashout: ${error.message}`);
                hasError = true;
            }
        }

        if (!hasError) {
            closeEndSessionModal();
            endSession();
        }
    }
}

function endSession() {
    const startBtn = document.getElementById('start-session-btn');
    const endBtn = document.getElementById('end-session-btn');
    
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
}

async function handleAddMoney(playerName, amount) {
    try {
        console.log('=== Add Money Process Started ===');
        console.log('Player:', playerName);
        console.log('Amount:', amount);

        // Validate amount is not negative
        if (amount < 0) {
            console.error('Invalid add money amount:', amount);
            throw new Error('Add money amount cannot be negative');
        }

        // Update session player's buyin
        const sessionPlayer = sessionPlayers.find(p => p.name === playerName);
        if (!sessionPlayer) {
            console.error('Player not found in session:', playerName);
            throw new Error('Player not found in current session');
        }

        console.log('Current Player State:', {
            name: sessionPlayer.name,
            buyin: sessionPlayer.buyin,
            currentCashout: sessionPlayer.cashout || 0
        });

        // Update the player's buyin amount
        sessionPlayer.buyin += amount;
        sessionStats.totalBuyins += amount;
        
        console.log('Updated Session Stats:', {
            totalBuyins: sessionStats.totalBuyins,
            totalCashouts: sessionStats.totalCashouts
        });
        
        // Update player's stats in database
        const stats = playerStats[playerName];
        // Only increment totalBuyins if this is their first buy-in for the session
        if (!sessionPlayer.hasAddedMoney) {
            stats.totalBuyins += amount;
            sessionPlayer.hasAddedMoney = true;
        }
        stats.netProfit = stats.totalCashouts - stats.totalBuyins;

        console.log('Updated Player Stats:', {
            name: playerName,
            totalBuyins: stats.totalBuyins,
            totalCashouts: stats.totalCashouts,
            netProfit: stats.netProfit
        });

        await updatePlayerStats(playerName, stats);

        // Update UI
        renderPlayerList();
        updateSessionStats();
        renderAllTimeStats();
        updateAllTimeStats();
        
        saveSessionState(); // Save state after adding money
        console.log('=== Add Money Process Completed ===');
    } catch (error) {
        console.error('Error processing add money:', error);
        alert('Failed to process add money: ' + error.message);
    }
}

async function removePlayer(playerName) {
    try {
        console.log('=== Remove Player Process Started ===');
        console.log('Player:', playerName);

        // Find the player in the session
        const sessionPlayer = sessionPlayers.find(p => p.name === playerName);
        if (!sessionPlayer) {
            console.error('Player not found in session:', playerName);
            throw new Error('Player not found in current session');
        }

        console.log('Current Player State:', {
            name: sessionPlayer.name,
            buyin: sessionPlayer.buyin,
            currentCashout: sessionPlayer.cashout || 0
        });

        // Update session stats
        sessionStats.totalBuyins -= sessionPlayer.buyin;
        if (sessionPlayer.cashout) {
            sessionStats.totalCashouts -= sessionPlayer.cashout;
        }
        
        console.log('Updated Session Stats:', {
            totalBuyins: sessionStats.totalBuyins,
            totalCashouts: sessionStats.totalCashouts
        });
        
        // Update player's stats in database
        const stats = playerStats[playerName];
        stats.totalBuyins -= sessionPlayer.buyin;
        if (sessionPlayer.cashout) {
            stats.totalCashouts -= sessionPlayer.cashout;
        }
        stats.netProfit = stats.totalCashouts - stats.totalBuyins;

        // Calculate loss for this session
        const sessionLoss = sessionPlayer.buyin - (sessionPlayer.cashout || 0);
        if (sessionLoss > 0 && sessionLoss > (stats.biggestLoss || 0)) {
            stats.biggestLoss = sessionLoss;
            console.log('New biggest loss recorded:', stats.biggestLoss);
        }

        console.log('Updated Player Stats:', {
            name: playerName,
            totalBuyins: stats.totalBuyins,
            totalCashouts: stats.totalCashouts,
            netProfit: stats.netProfit,
            biggestWin: stats.biggestWin,
            biggestLoss: stats.biggestLoss
        });

        await updatePlayerStats(playerName, stats);

        // Remove player from session
        sessionPlayers = sessionPlayers.filter(p => p.name !== playerName);
        
        // Update UI
        renderPlayerList();
        updateSessionStats();
        renderAllTimeStats();
        updateAllTimeStats();
        
        saveSessionState(); // Save state after removing player
        console.log('=== Remove Player Process Completed ===');
    } catch (error) {
        console.error('Error removing player:', error);
        alert('Failed to remove player: ' + error.message);
    }
} 