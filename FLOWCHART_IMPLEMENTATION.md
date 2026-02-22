# 🎮 CPL GAME FLOWCHARTS - COMPLETE IMPLEMENTATION GUIDE

This document explains how each flowchart is implemented in the codebase.

---

## 🔴 RANDOM MATCH FLOW

### Implementation Status: ✅ COMPLETE

### Frontend Flow (`public/js/dashboard.js`)
```javascript
// User clicks Random button
handleModeSelection('random')
  ↓
joinRandomGame()
  ↓
window.location.href = '/game?mode=random'
```

### Backend Flow (`src/socket/gameHandler.js`)
```javascript
// 1. User joins random lobby
socket.on('lobby:join', { mode: 'random' })
  ↓
// 2. Check for existing waiting room
const randomRooms = roomManager.getRoomsByMode('random')
const availableRoom = randomRooms.find(r => r.status === 'waiting' && r.players.length < r.maxPlayers)
  ↓
// 3a. Room exists? Join it
if (availableRoom) {
    roomManager.addPlayer(availableRoom.id, user)
}
// 3b. No room? Create new one
else {
    room = roomManager.createRoom('random', user)
    startCountdown(roomId) // 1 minute timer
}
  ↓
// 4. When countdown ends or room fills
roomManager.startGame(roomId)
  ↓
// 5. Auto-select captains (player with most lifetime runs)
balanceTeams(roomId) // Divide players equally
selectCaptains(room) // Auto-select based on stats
  ↓
// 6. Emit captain names to all players
io.to(roomId).emit('captains:selected', { captainA, captainB })
  ↓
// 7. Perform toss
performToss(roomId)
  ↓
// 8. Captains choose bat/bowl
socket.on('choose:action', { action: 'bat' or 'bowl' })
  ↓
// 9. Captains select batting lineup
socket.on('lineup:selected', { batters: [...], bowlers: [...] })
  ↓
// 10. Start match
socket.emit('game:start')
  ↓
// Gameplay loop (see Game Logic section)
  ↓
// After match completion
socket.on('play:again')
  ↓
// Reopen room for 1 minute
// OR back to dashboard
```

### Files Involved:
- `src/socket/gameHandler.js` - Main game flow
- `src/utils/roomManager.js` - Room management
- `src/config/game.js` - Constants (timer: 60s)

---

## 🤖 BOT MATCH FLOW

### Implementation Status: ✅ COMPLETE

### Frontend Flow
```javascript
// 1. User clicks Bot button
handleModeSelection('bot')
  ↓
// 2. Show difficulty modal
botModal.style.display = 'flex'
  ↓
// 3. User selects difficulty (Easy/Medium/Hard)
difficulty-btn.onclick → playWithBot(difficulty)
  ↓
// 4. Redirect with difficulty parameter
window.location.href = `/game?mode=bot&difficulty=${difficulty}`
```

### Backend Flow
```javascript
// 1. Create bot room instantly (no waiting)
room = roomManager.createRoom('bot', user, { difficulty })
  ↓
// 2. Add bot player to team B
const bot = {
    id: 'bot-' + Date.now(),
    name: getBotName(),
    isBot: true,
    team: 'B',
    difficulty: difficulty
}
  ↓
// 3. Start game immediately
socket.emit('game:start')
  ↓
// 4. Player bats first (automatic)
setInnings(1, playerTeam: 'A')
  ↓
// 5. Gameplay loop
// Player submits choice
socket.emit('game:choice_made', { choice })
  ↓
// Bot generates choice based on difficulty
botChoice = GameEngine.generateBotChoice(difficulty)
// Easy: [0.30, 0.25, 0.20, 0.15, 0.10] - More 1s & 2s
// Medium: [0.20, 0.20, 0.20, 0.20, 0.20] - Balanced
// Hard: [0.10, 0.15, 0.20, 0.25, 0.30] - More 4s & 5s
  ↓
// Compare choices
if (playerChoice === botChoice) → OUT
else → Runs added
  ↓
// Continue until innings ends
  ↓
// Second innings (bot bats, player bowls)
  ↓
// Target chase logic
  ↓
// Match result
socket.emit('game:over', { result })
  ↓
// Show "New Game" button
// Restart or back to dashboard
```

### Files Involved:
- `public/views/dashboard.html` - Bot difficulty modal
- `public/js/dashboard.js` - Difficulty selection
- `src/utils/gameEngine.js` - `generateBotChoice()` method
- `src/config/game.js` - Bot difficulty strategies

---

## 🔵 CREATE ROOM FLOW

### Implementation Status: ✅ COMPLETE

### Frontend Flow
```javascript
// 1. User clicks Create button
handleModeSelection('create')
  ↓
// 2. Show create room form
createModal.style.display = 'flex'
  ↓
// 3. User fills:
// - Room name
// - Max players (2-12)
// - Overs (1-20)
  ↓
// 4. User clicks Create
confirmCreateBtn.onclick
  ↓
// Validate inputs
if (!roomName || maxPlayers < 2 || overs < 1) return
  ↓
// 5. Redirect with parameters
window.location.href = `/game?mode=create&name=${roomName}&max=${maxPlayers}&overs=${overs}`
```

### Backend Flow
```javascript
// 1. Create room with custom settings
socket.on('lobby:join', { mode: 'create', settings: {...} })
  ↓
// 2. Generate room ID (e.g., "ABC123")
const roomId = generateRoomCode() // 6-character code
  ↓
// 3. Create room
room = roomManager.createRoom('create', user, {
    maxPlayers: settings.max,
    overs: settings.overs,
    name: settings.name
})
  ↓
// 4. User enters lobby
socket.emit('room:joined', {
    roomId,
    players,
    isCreator: true
})
  ↓
// 5. Show lobby UI with:
// - Room ID (with copy button)
// - Player list
// - Team switch option
// - Start button (creator only)
  ↓
// 6. Other players join using room ID
socket.emit('lobby:join', { mode: 'join', roomId })
  ↓
// 7. Players can switch teams
socket.emit('team:switch')
  ↓
// 8. Creator clicks Start
socket.emit('game:start')
  ↓
// 9. Lock room (no more joins)
room.status = 'CAPTAIN_SELECTION'
socket.emit('room:locked')
  ↓
// 10. Captain selection flow
// Auto or manual (configurable)
selectCaptains(room)
  ↓
// 11. Toss
performToss(roomId)
  ↓
// 12. Choose bat or bowl
socket.on('choose:action')
  ↓
// 13. Select batting lineup
socket.on('lineup:selected', { batters })
  ↓
// 14. Select bowling lineup
socket.on('lineup:selected', { bowlers })
  ↓
// 15. Start match
socket.emit('game:start')
  ↓
// Gameplay
  ↓
// Match ends
socket.emit('game:over')
  ↓
// Return to room lobby
// Creator can start new match
// Or players leave
```

### Files Involved:
- `public/views/dashboard.html` - Create room modal
- `public/css/dashboard.css` - Form styling
- `public/js/dashboard.js` - Create room logic
- `src/utils/helpers.js` - `generateRoomCode()`
- `src/utils/roomManager.js` - Room creation

---

## 🟢 JOIN ROOM FLOW

### Implementation Status: ✅ COMPLETE

### Frontend Flow
```javascript
// 1. User clicks Join button
handleModeSelection('join')
  ↓
// 2. Show enter room ID modal
joinModal.style.display = 'flex'
  ↓
// 3. User enters 6-character code
roomCodeInput.value = 'ABC123'
  ↓
// 4. User clicks Join
confirmJoinBtn.onclick
  ↓
// Validate (must be 6 characters)
if (code.length !== 6) return
  ↓
// 5. Redirect with room code
window.location.href = `/game?mode=join&code=${code}`
```

### Backend Flow
```javascript
// 1. Validate room exists
const room = roomManager.getRoom(roomId)
  ↓
// 2. Check if room exists
if (!room) {
    socket.emit('room:not_found')
    return
}
  ↓
// 3. Check if room is open
if (room.status !== 'waiting' && room.status !== 'ready') {
    socket.emit('room:locked')
    return
}
  ↓
// 4. Check if room is full
if (room.players.length >= room.maxPlayers) {
    socket.emit('room:full')
    return
}
  ↓
// 5. Join room
roomManager.addPlayer(roomId, user)
  ↓
// 6. Enter lobby
socket.emit('room:joined', {
    roomId,
    players,
    isCreator: false
})
  ↓
// 7. Show lobby UI:
// - Player list
// - Team assignment
// - "Waiting for creator to start..."
  ↓
// 8. Wait for creator to click Start
socket.on('game:start')
  ↓
// 9. Room locks
  ↓
// Captain selection → Toss → Lineup → Match
```

### Files Involved:
- `public/views/dashboard.html` - Join room modal
- `public/js/dashboard.js` - Join room logic
- `src/socket/gameHandler.js` - Room validation

---

## 🏏 GAME LOGIC FLOW

### Implementation Status: ✅ COMPLETE

### Match Initialization
```javascript
// src/utils/gameEngine.js

constructor(roomId, overs) {
    this.roomId = roomId
    this.overs = overs
    this.innings = 1
    this.runs = 0
    this.wickets = 0
    this.balls = 0
    this.currentOver = 0
    this.currentBall = 0
    this.ballHistory = []
    this.lastSixBalls = []
}
```

### Ball-by-Ball Logic
```javascript
// 1. Set current batter and bowler
engine.setPlayers(batter, bowler)
  ↓
// 2. Batter submits choice (1-5)
socket.emit('game:choice_made', { choice: batterChoice, role: 'batter' })
engine.submitChoice('batter', choice)
  ↓
// 3. Bowler submits choice (1-5)
socket.emit('game:choice_made', { choice: bowlerChoice, role: 'bowler' })
engine.submitChoice('bowler', choice)
  ↓
// 4. Both choices received
if (engine.batterChoice !== null && engine.bowlerChoice !== null)
  ↓
// 5. Compare numbers
const result = engine.processBall()
  ↓
// 6. Determine outcome
if (batterChoice === bowlerChoice) {
    // OUT
    wickets++
    nextBatter()
} else {
    // RUNS
    runs += batterChoice
}
  ↓
// 7. Update scoreboard
socket.emit('game:round_result', {
    batter: batterChoice,
    bowler: bowlerChoice,
    isOut: isOut,
    runs: runsScored,
    totalRuns: engine.runs,
    wickets: engine.wickets
})
  ↓
// 8. Update last 6 balls
engine.lastSixBalls.unshift(isOut ? 'W' : runsScored)
if (engine.lastSixBalls.length > 6) engine.lastSixBalls.pop()
  ↓
// 9. Increment ball count
engine.balls++
engine.currentBall++
  ↓
// 10. Check if over complete (6 balls)
if (engine.currentBall === 6) {
    engine.currentOver++
    engine.currentBall = 0
    changeBowler() // Same bowler cannot bowl consecutive overs
    socket.emit('game:over_complete')
}
```

### Over Logic
```javascript
// Every 6 balls = 1 over
if (balls % 6 === 0) {
    currentOver++
    currentBall = 0
    
    // Change bowler (cannot bowl consecutive overs)
    if (lastBowler === currentBowler) {
        currentBowler = getNextBowler()
    }
}
```

### Innings End Conditions
```javascript
function isInningsComplete() {
    // 1. All wickets fallen (10 out)
    if (wickets >= 10) return true
    
    // 2. All overs completed
    if (currentOver >= totalOvers) return true
    
    // 3. Target reached (second innings only)
    if (innings === 2 && runs > target) return true
    
    return false
}
```

### Second Innings Logic
```javascript
// After first innings ends
  ↓
// 1. Store first innings score
const target = firstInningsRuns + 1
  ↓
// 2. Switch teams
swapBattingBowling()
  ↓
// 3. Start second innings
engine.startInnings(2)
engine.setTarget(target)
  ↓
// 4. Show innings break
socket.emit('game:innings_change', {
    message: `Target: ${target}`,
    target: target
})
  ↓
// 5. Resume gameplay with target chase
// During play, check if target reached
if (runs > target) {
    // Match ends immediately
    socket.emit('game:over')
}
```

### Match End Conditions
```javascript
// Second innings ends when:
// 1. Target reached (chasing team wins)
// 2. All out (bowling team wins)
// 3. Overs completed (compare scores)

function calculateResult() {
    if (secondInningsRuns > firstInningsRuns) {
        winner = chasingTeam
        result = `Team ${chasingTeam} won by ${10 - wickets} wickets`
    } else if (firstInningsRuns > secondInningsRuns) {
        winner = battingFirstTeam
        result = `Team ${battingFirstTeam} won by ${firstInningsRuns - secondInningsRuns} runs`
    } else {
        winner = 'tie'
        result = 'Match tied'
    }
}
```

### Stats Calculation
```javascript
// After match ends, update player stats
async function updatePlayerStats(room, result) {
    for (player of room.players) {
        if (player.isBot) continue
        
        const won = player.team === result.winner
        const runs = getPlayerRuns(player)
        const wickets = getPlayerWickets(player)
        
        // Update user in database
        await User.findById(player.id).recordGame(won, runs, wickets)
    }
}

// User model calculates:
// - Games played
// - Games won/lost
// - Total runs
// - Total wickets
// - Points (for leaderboard)
// - XP and level
```

### Auto-Choice on Timeout
```javascript
// Frontend timer: 30 seconds
let timeLeft = 30
setInterval(() => {
    timeLeft--
    if (timeLeft === 0) {
        // Auto-submit random choice
        const randomChoice = Math.floor(Math.random() * 5) + 1
        submitChoice(randomChoice)
    }
}, 1000)
```

---

## 📊 STATE FLOW DIAGRAM

```
WAITING → READY → CAPTAIN_SELECTION → TOSS → CHOOSE_ACTION → 
LINEUP_SELECTION → PLAYING → INNINGS_BREAK → PLAYING → COMPLETED
```

### State Explanations:

1. **WAITING**: Room exists, waiting for players to join
2. **READY**: Minimum players reached, countdown started
3. **CAPTAIN_SELECTION**: Auto-selecting or manual captain selection
4. **TOSS**: Performing coin toss
5. **CHOOSE_ACTION**: Winning captain chooses bat or bowl
6. **LINEUP_SELECTION**: Captains select batting/bowling order
7. **PLAYING**: Match in progress (first innings)
8. **INNINGS_BREAK**: Show summary, prepare for second innings
9. **PLAYING**: Second innings in progress
10. **COMPLETED**: Match finished, show result

---

## 🔧 KEY IMPLEMENTATION FILES

### Backend:
- `src/socket/gameHandler.js` - ALL Socket.IO event handlers
- `src/utils/gameEngine.js` - Cricket game logic
- `src/utils/roomManager.js` - Room lifecycle management
- `src/config/game.js` - Game constants and settings

### Frontend:
- `public/js/game.js` - Real-time game client
- `public/js/dashboard.js` - Mode selection and room creation
- `public/views/game.html` - Game arena UI
- `public/css/game.css` - Game styling

### Models:
- `src/models/User.js` - Player stats and ranking
- `src/models/Game.js` - Match history storage

---

## ✅ IMPLEMENTATION CHECKLIST

### Random Match:
- [x] Check for existing waiting room
- [x] Join or create room
- [x] 1-minute countdown
- [x] Auto-balance teams
- [x] Auto-select captains
- [x] Toss logic
- [x] Captain lineup selection
- [x] Match gameplay
- [x] Play again option

### Bot Match:
- [x] Difficulty selection modal
- [x] Instant room creation
- [x] Bot AI with difficulty levels
- [x] Player bats first
- [x] Target chase logic
- [x] New game option

### Create Room:
- [x] Room creation form
- [x] Generate room ID
- [x] Show room code
- [x] Copy button
- [x] Team switch
- [x] Creator-only start button
- [x] Lock room on start

### Join Room:
- [x] Enter room code modal
- [x] Room validation
- [x] Error handling
- [x] Join lobby
- [x] Wait for creator

### Game Logic:
- [x] Ball-by-ball comparison
- [x] Over tracking (6 balls)
- [x] Bowler change logic
- [x] Innings end conditions
- [x] Target chase
- [x] Match result calculation
- [x] Stats update
- [x] Auto-timeout choice

---

## 🚀 TESTING THE FLOWS

### Test Random Match:
1. Open two browsers
2. Click "Random" in both
3. Both join same room
4. Wait for countdown
5. Auto-captains selected
6. Toss performed
7. Play match

### Test Bot Match:
1. Click "Bot"
2. Select difficulty
3. Instant game start
4. Play full match
5. Click "New Game"

### Test Create Room:
1. Click "Create"
2. Fill form
3. Copy room code
4. Share with friend
5. Friend joins
6. Creator starts game

### Test Join Room:
1. Get room code from friend
2. Click "Join"
3. Enter code
4. Join lobby
5. Wait for start

---

**All flowcharts are fully implemented and ready to use!** 🎉
