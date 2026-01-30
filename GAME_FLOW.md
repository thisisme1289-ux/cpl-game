# CPL - Complete Game Flow Documentation

## 🎮 What Happens When "Start Game" is Clicked

This document explains the **complete gameplay flow** from start to finish, following the proper state machine architecture.

---

## 📊 Game State Machine

The game follows a strict **Finite State Machine** with these states:

```
LOBBY → PLAYER_SELECTION → PLAYING → BALL_RESULT → [Next State]
                                                           ↓
                                      ┌─────────────────────┴──────────────┐
                                      ↓                                    ↓
                              PLAYER_SELECTION                      MATCH_END
                              (if OUT/Over end)                   (if game over)
```

---

## 🚀 STEP-BY-STEP: Complete Game Flow

### **STEP 1: User Clicks "Start Game"**

**What happens on client:**
```javascript
User clicks button → socket.emit('start-game', roomId)
```

**What happens on server:**
```javascript
1. Verify requester is a leader ✅
2. Validate leaders exist ✅
3. Call startGame(roomId) function
```

**Inside `startGame()` function:**
```javascript
✓ Change state: LOBBY → PLAYER_SELECTION
✓ Initialize game:
  - score = 0
  - wickets = 0
  - overs = 0
  - balls = 0
  - battingTeam = 'A'
  - bowlingTeam = 'B'
  - outPlayers = []
  - history = []
```

**Server broadcasts to all clients:**
```javascript
emit('game-started', {
  message: 'Game started! Leaders, select batter and bowler',
  state: 'PLAYER_SELECTION'
})

emit('game-state', {
  state: 'PLAYER_SELECTION',
  score: 0,
  wickets: 0,
  overs: 0,
  balls: 0,
  ...
})
```

**Server sends to leaders specifically:**
```javascript
// To batting team leader (Team A)
emit('request-player-selection', {
  role: 'batter',
  team: 'A',
  availablePlayers: ['Alice', 'Bob', 'Charlie']
})

// To bowling team leader (Team B)
emit('request-player-selection', {
  role: 'bowler',
  team: 'B',
  availablePlayers: ['David', 'Eve', 'Frank']
})
```

---

### **STEP 2: Leaders Select Batter and Bowler**

**What happens on client:**
```javascript
Leader A selects: Alice (batter)
Leader B selects: David (bowler)

socket.emit('select-players', {
  roomId: 'room-xyz',
  batterName: 'Alice',
  bowlerName: 'David'
})
```

**What happens on server:**
```javascript
1. Verify state is PLAYER_SELECTION ✅
2. Find socket IDs for Alice and David ✅
3. Validate batter is from batting team ✅
4. Validate bowler is from bowling team ✅
5. Check batter is not already out ✅
6. Call selectPlayers(roomId, batterSocket, bowlerSocket)
```

**Inside `selectPlayers()` function:**
```javascript
✓ Set currentBatter = Alice's socketId
✓ Set currentBowler = David's socketId
✓ Reset inputs: batterInput = null, bowlerInput = null
✓ Change state: PLAYER_SELECTION → PLAYING
```

**Server broadcasts:**
```javascript
emit('players-selected', {
  batter: 'Alice',
  bowler: 'David'
})

emit('game-state', {
  state: 'PLAYING',
  currentBatter: 'Alice',
  currentBowler: 'David',
  ...
})
```

**Client UI updates:**
```javascript
✓ Hide player selection UI
✓ Show finger selection for Alice and David
✓ Show "PLAYING" banner
✓ Highlight Alice and David in team lists
```

---

### **STEP 3: Batter and Bowler Choose Fingers**

**What happens on client:**
```javascript
Alice clicks finger "3"
  → socket.emit('player-input', { roomId, fingers: 3 })

David clicks finger "2"
  → socket.emit('player-input', { roomId, fingers: 2 })
```

**What happens on server (for each input):**
```javascript
1. Call recordPlayerInput(roomId, socketId, fingers)
2. Validate state is PLAYING ✅
3. Validate finger value (1-5) ✅
4. Validate player is current batter/bowler ✅
5. Store input:
   - batterInput = 3 (Alice's choice)
   - bowlerInput = 2 (David's choice)
6. Send confirmation to player
```

**Server checks if both inputs received:**
```javascript
if (batterInput !== null && bowlerInput !== null) {
  // Both players have chosen → Process round!
  processRound(roomId)
}
```

---

### **STEP 4: Process Round (Core Game Logic)**

**Inside `processRound()` function:**

```javascript
// 1. Get inputs
batterFingers = 3
bowlerFingers = 2

// 2. Apply finger cricket rule
if (batterFingers === bowlerFingers) {
  isOut = true
  wickets += 1
  outPlayers.push(batterSocket)
} else {
  runs = batterFingers  // Alice scores 3 runs
  score += runs         // score = 0 + 3 = 3
}

// 3. Increment ball count
balls += 1  // balls = 1

// 4. Check if over complete
if (balls >= 6) {
  overs += 1
  balls = 0
  isOverComplete = true
}

// 5. Add to history
history.push({
  ball: 1,
  batter: 'Alice',
  bowler: 'David',
  batterFingers: 3,
  bowlerFingers: 2,
  runs: 3,
  isOut: false
})

// 6. Change state: PLAYING → BALL_RESULT
state = 'BALL_RESULT'

// 7. Reset inputs
batterInput = null
bowlerInput = null

// 8. Determine next state
if (isMatchOver()) {
  nextState = 'MATCH_END'
} else if (isOut || isOverComplete) {
  nextState = 'PLAYER_SELECTION'  // Need new players
} else {
  nextState = 'PLAYING'  // Continue with same players
}
```

**Server broadcasts result:**
```javascript
emit('round-result', {
  batterFingers: 3,
  bowlerFingers: 2,
  runs: 3,
  isOut: false,
  isOverComplete: false,
  batter: 'Alice',
  bowler: 'David',
  score: 3,
  wickets: 0
})
```

**Client shows animation:**
```javascript
✓ Display overlay: "3 vs 2"
✓ Show: "+3 Runs! 🎉"
✓ Animate score: 0 → 3
✓ Animation duration: 3 seconds
```

---

### **STEP 5: After Animation (3 seconds later)**

**Server transitions to next state:**
```javascript
transitionToNextState(roomId, nextState)

emit('game-state', {
  state: 'PLAYING',  // nextState
  score: 3,
  wickets: 0,
  overs: 0,
  balls: 1,
  ...
})
```

**Based on nextState:**

#### **Case A: nextState = PLAYING (Continue)**
```javascript
// Same players continue
emit('next-ball', { message: 'Next ball!' })

Client UI:
✓ Keep Alice and David active
✓ Re-enable finger selection
✓ Continue game
```

#### **Case B: nextState = PLAYER_SELECTION (OUT)**
```javascript
// Batter is out, need new batter
emit('waiting-for-selection', {
  message: 'Batter is OUT! Leader selecting new batter...'
})

emit('request-player-selection', {
  role: 'batter',
  reason: 'out',
  availablePlayers: ['Bob', 'Charlie']  // Alice is out
})

Client UI:
✓ Show "Waiting for leader..." message
✓ Leader sees player selection UI
✓ Loop back to STEP 2
```

#### **Case C: nextState = PLAYER_SELECTION (Over Complete)**
```javascript
// Over complete, can change both players
emit('over-complete', {
  over: 1,
  message: 'Over 1 complete!'
})

emit('request-player-selection', {
  role: 'batter',
  reason: 'over-complete',
  ...
})

emit('request-player-selection', {
  role: 'bowler',
  reason: 'over-complete',
  ...
})

Client UI:
✓ Show "Over Complete!" banner
✓ Both leaders select players
✓ Loop back to STEP 2
```

#### **Case D: nextState = MATCH_END (Game Over)**
```javascript
emit('game-over', {
  finalScore: 45,
  wickets: 8,
  overs: 5,
  reason: 'All overs completed'
})

Client UI:
✓ Show "GAME OVER" screen
✓ Display final score: 45/8
✓ Show match summary
✓ Disable all inputs
```

---

## 🔄 Complete Game Loop

```
1. Click "Start Game"
   ↓
2. State: PLAYER_SELECTION
   ↓
3. Leaders select batter/bowler
   ↓
4. State: PLAYING
   ↓
5. Players choose fingers
   ↓
6. State: BALL_RESULT
   ↓
7. Show animation (3s)
   ↓
8. Determine next state:
   • If OUT → PLAYER_SELECTION (select new batter)
   • If Over Complete → PLAYER_SELECTION (select new players)
   • If Game Over → MATCH_END (game ends)
   • Else → PLAYING (continue)
   ↓
9. Loop back to appropriate step
```

---

## 🎯 Key Rules

### **Score Rules**
- ✅ Score starts at 0
- ✅ Score increases ONLY when runs are scored
- ✅ Score NEVER decreases
- ✅ Score is NEVER NaN (always initialized)

### **OUT Rules**
- ✅ OUT occurs when batterFingers === bowlerFingers
- ✅ When OUT: wickets++, add to outPlayers[]
- ✅ OUT player cannot bat again in this innings
- ✅ Score does NOT change on OUT

### **Ball/Over Rules**
- ✅ Each ball increments ball count
- ✅ After 6 balls → over++, balls = 0
- ✅ After each over → can change players

### **Match End Rules**
- ✅ Game ends when overs >= totalOvers
- ✅ Game ends when wickets >= 10
- ✅ Game ends when no batters available

### **Input Validation**
- ✅ Only accept 1-5
- ✅ Only accept from current batter/bowler
- ✅ Only accept in PLAYING state
- ✅ Reject duplicate inputs

---

## 🛡️ Security & Edge Cases

### **What if batter disconnects mid-ball?**
```javascript
✓ 5-second grace period for reconnect
✓ If reconnected → game continues
✓ If not reconnected → leader selects new batter
```

### **What if leader disconnects?**
```javascript
✓ New leader auto-selected from team
✓ Game state preserved
✓ New leader continues from current state
```

### **What if both players input simultaneously?**
```javascript
✓ Server processes inputs sequentially
✓ Both inputs recorded correctly
✓ Round processed only when BOTH received
```

### **What if player tries to cheat (send multiple inputs)?**
```javascript
✓ Server validates: input already recorded?
✓ If yes → reject with error
✓ Only first input is accepted
```

---

## 📋 Socket Event Summary

### **Client → Server**
| Event | When | Purpose |
|-------|------|---------|
| `start-game` | Leader clicks button | Initialize game |
| `select-players` | Leader selects batter/bowler | Set active players |
| `player-input` | Player chooses fingers | Submit choice |

### **Server → Client**
| Event | When | Purpose |
|-------|------|---------|
| `game-started` | Game starts | Notify all players |
| `request-player-selection` | Need player selection | Ask leader to select |
| `players-selected` | Players chosen | Show active players |
| `game-state` | State changes | Update UI |
| `round-result` | Ball processed | Show animation |
| `next-ball` | Continue playing | Ready for next input |
| `over-complete` | Over ends | Show over summary |
| `game-over` | Match ends | Show final result |

---

## ✅ Summary

When "Start Game" is clicked:

1. **Server** initializes game state
2. **Server** transitions to PLAYER_SELECTION
3. **Server** requests leaders to select players
4. Leaders select → transition to PLAYING
5. Players input → process round → show result
6. After 3s → transition to next appropriate state
7. **Loop** continues until match ends

The game is **entirely server-authoritative**, ensuring fair play and preventing cheating!

---

**Made with ❤️ for classroom gamers everywhere**
