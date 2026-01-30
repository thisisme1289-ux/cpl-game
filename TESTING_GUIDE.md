# 🧪 CPL Game - Testing Guide (Post-Fix)

## ✅ What Was Fixed

### Problem 1: "Invalid Player Selection" Error
**Fixed:** Leaders now submit selections individually, server waits for both

### Problem 2: Game Not Starting / Stuck in Lobby
**Fixed:** Proper state transitions, clear visual feedback

---

## 🎮 Complete Test Flow

### Test 1: Basic Game Start (2 Players)

**Setup:**
1. Open two browser windows side by side
2. Window 1: Enter name "Alice", click "Join Random Room"
3. Window 2: Enter name "Bob", click "Join Random Room"

**Expected Result:**
- ✅ Both join same room
- ✅ Alice in Team A
- ✅ Bob in Team B

**Step 1: Select Leaders**
1. Either player clicks "Select Leaders"
2. **Expected:** 
   - Notification: "Leaders: Alice 👑 & Bob 👑"
   - Gold badges appear on both players
   - "Start Game" button becomes enabled

**Step 2: Start Game**
1. Either leader clicks "Start Game"
2. **Expected:**
   - Notification: "Game Started! Leaders are selecting players..."
   - State banner: "👥 Select Batter & Bowler"
   - Score shows: 0/0
   - Overs: 0.0 / 5

**Step 3: Player Selection**
1. Alice sees modal: "Select Batter 🏏"
   - Available: Alice (only Team A members)
   - Timer starts counting down from 30
2. Bob sees modal: "Select Bowler ⚾"
   - Available: Bob (only Team B members)
   - Timer starts counting down from 30

3. Alice clicks on "Alice", clicks "Confirm"
4. Bob clicks on "Bob", clicks "Confirm"

5. **Expected:**
   - Notification: "Alice 🏏 vs Bob ⚾"
   - State banner: "🏏 GAME IN PROGRESS"
   - Alice sees finger buttons (1-5)
   - Bob sees finger buttons (1-5)

**Step 4: Play Round**
1. Alice clicks "3", clicks "Confirm Choice"
2. Bob clicks "2", clicks "Confirm Choice"

3. **Expected:**
   - Full-screen overlay appears
   - Shows: "🤟 vs ✌️"
   - Shows: "+3 Runs! 🎉"
   - Score animates: 0 → 3
   - After 3 seconds, overlay closes
   - Score shows: 3/0
   - Overs: 0.1 / 5
   - Finger buttons re-enabled

**Step 5: Continue Playing**
1. Play more rounds
2. Try to get OUT (both choose same number)
3. Complete an over (6 balls)
4. Play until game ends

---

### Test 2: Multiplayer (4+ Players)

**Setup:**
1. Open 4 browser windows
2. Names: Alice, Bob, Charlie, David
3. All join same room

**Expected Teams:**
- Team A: Alice, Charlie
- Team B: Bob, David

**Flow:**
1. Select Leaders
   - **Expected:** One from Team A, one from Team B get 👑

2. Start Game
   - **Expected:** Both leaders see modals

3. Leader A selects from Team A (Alice or Charlie)
4. Leader B selects from Team B (Bob or David)

5. **Expected:** Game starts with selected players

---

### Test 3: OUT Scenario

**Play until OUT:**
1. Batter and bowler both choose same number (e.g., both choose "3")

**Expected:**
- Overlay: "🤟 vs 🤟"
- Shows: "OUT! 😱" (with shake animation)
- Score stays same
- Wickets: 0 → 1
- After 3 seconds:
  - Leader sees modal to select new batter
  - Bowler stays the same
  - Select new batter
  - Game continues

---

### Test 4: Over Complete

**Play 6 balls:**
1. Complete 6 balls without getting out

**Expected:**
- After 6th ball:
  - Notification: "Over 1 Complete! 🎉"
  - Overs: 0.6 → 1.0
  - Both leaders see modals
  - Can select new batter AND new bowler
  - Game continues

---

### Test 5: Game Over

**Option A: Complete All Overs**
1. Play until 5.0 overs

**Expected:**
- Match Summary appears
- Shows final score
- Shows statistics
- "New Game" and "Exit" buttons

**Option B: All Wickets**
1. Get 10 outs

**Expected:**
- Match Summary appears
- Reason: "All out"

---

## 🔍 Visual Checklist

### During Game Start:
- [ ] "Select Leaders" button works
- [ ] Leaders get 👑 badges
- [ ] "Start Game" button enables
- [ ] State banner updates correctly
- [ ] Player selection modals appear

### During Player Selection:
- [ ] Modal shows correct title ("Select Batter" or "Select Bowler")
- [ ] Only shows players from correct team
- [ ] Timer counts down
- [ ] Can select and confirm
- [ ] Modal closes after confirm
- [ ] Notification shows selected player
- [ ] Waiting message if only one selected

### During Gameplay:
- [ ] Finger buttons appear for active players
- [ ] Other players see waiting message
- [ ] Can choose 1-5
- [ ] Can confirm choice
- [ ] Result overlay appears
- [ ] Score updates correctly
- [ ] Overs update correctly
- [ ] State transitions work

### During Chat:
- [ ] All players can chat in lobby
- [ ] Spectators can chat during game
- [ ] Active players cannot chat during their turn
- [ ] Chat messages appear correctly

---

## 🐛 Common Issues & Solutions

### Issue: Modal doesn't appear
**Solution:** Make sure you're a leader (have 👑 badge)

### Issue: Can't select player
**Solution:** Check that timer hasn't expired (refresh if needed)

### Issue: "Invalid player" error
**Solution:** This should be fixed now. If still occurs, check console for errors

### Issue: Game stuck in PLAYER_SELECTION
**Solution:** Both leaders must select. Check if second leader's modal is open

### Issue: Finger buttons don't appear
**Solution:** Make sure player selection completed and state is "PLAYING"

---

## 📊 State Verification

At any point, you should be able to tell the state by:

| State | Banner | What You See |
|-------|--------|--------------|
| LOBBY | "LOBBY - Waiting for players" | Team lists, controls |
| PLAYER_SELECTION | "👥 Select Batter & Bowler" | Leaders see modals |
| PLAYING | "🏏 GAME IN PROGRESS" | Active players see fingers |
| BALL_RESULT | "📊 Processing..." | Result overlay |
| MATCH_END | "🏁 MATCH OVER" | Match summary |

---

## ✅ Success Criteria

The game is working correctly when:

1. ✅ Can start game without errors
2. ✅ Leaders can select players
3. ✅ Game transitions to PLAYING state
4. ✅ Can play complete rounds
5. ✅ Score updates correctly
6. ✅ Overs increment properly
7. ✅ OUT works as expected
8. ✅ Game ends properly
9. ✅ Match summary displays
10. ✅ Can start new game

---

## 🎯 Quick Smoke Test (2 minutes)

```
1. npm start
2. Open http://localhost:3000
3. Enter name "Test1", join
4. Open new tab, enter "Test2", join
5. Click "Select Leaders"
6. Click "Start Game"
7. Both leaders select players
8. Verify state = "PLAYING"
9. Both choose fingers
10. Verify result shows
11. Verify score updates
✅ If all pass = WORKING!
```

---

## 🔧 Debugging Tips

### Check Browser Console:
```javascript
// Should see:
[GAME START] room-xyz: Requesting player selections
[SELECTION SUBMITTED] room-xyz: batter = Alice
[SELECTION SUBMITTED] room-xyz: bowler = Bob
[PLAYERS SET] room-xyz: Alice vs Bob, State → PLAYING
```

### Check Network Tab:
- Socket.IO connection: Connected
- Events firing: ✅
- No 404 errors: ✅

### Check State:
- Open browser console
- Type: `localStorage.getItem('cpl-roomId')`
- Should show your room ID

---

**All tests passing = Game is fully functional!** ✅

🏏 **Ready to play!** 🏏
