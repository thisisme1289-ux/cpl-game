import { existsSync } from "node:fs";
import { io } from "socket.io-client";

const backendUrl = trimTrailingSlash(process.env.CPL_BACKEND_URL || process.env.VITE_SOCKET_URL || "http://localhost:4000");
const frontendUrl = trimTrailingSlash(process.env.CPL_FRONTEND_URL || "http://localhost:5173");
const checks = [];

await check("dist build output exists", () => {
  if (!existsSync("dist/index.html")) {
    throw new Error("dist/index.html is missing. Run npm run build first.");
  }
});

await check(`backend health ${backendUrl}/health`, async () => {
  const payload = await fetchJson(`${backendUrl}/health`);
  if (!payload.ok || payload.service !== "cpl-socket-server") {
    throw new Error(`unexpected backend health payload: ${JSON.stringify(payload)}`);
  }
});

await check(`backend stats ${backendUrl}/stats`, async () => {
  const payload = await fetchJson(`${backendUrl}/stats`);
  if (typeof payload.socketClients !== "number") {
    throw new Error(`unexpected backend stats payload: ${JSON.stringify(payload)}`);
  }
});

await check(`frontend responds ${frontendUrl}`, async () => {
  const response = await fetch(frontendUrl);
  const html = await response.text();
  if (!response.ok || !html.includes("<div id=\"root\">")) {
    throw new Error(`frontend did not serve the CPL app shell. HTTP ${response.status}`);
  }
});

await check(`Socket.IO room create/join ${backendUrl}`, () => smokeRoomFlow(backendUrl, frontendUrl));
await check(`Socket.IO team room setup ${backendUrl}`, () => smokeTeamRoomFlow(backendUrl, frontendUrl));

const failed = checks.filter((result) => !result.ok);
for (const result of checks) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}${result.error ? ` - ${result.error}` : ""}`);
}

if (failed.length) {
  console.error(`CPL deploy preflight failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}

console.log(`CPL deploy preflight passed: ${checks.length}/${checks.length} checks passed.`);

async function check(name, task) {
  try {
    await task();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, error: error.message });
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function smokeRoomFlow(url, origin) {
  return new Promise((resolve, reject) => {
    const host = createSocket(url, origin);
    const guest = createSocket(url, origin);
    let roomCode = "";
    let hostId = "";
    let guestId = "";
    let tossSent = false;
    let ballSent = false;

    const timer = setTimeout(() => {
      closeSockets();
      reject(new Error("room smoke test timed out"));
    }, 9000);

    host.on("connect", () => {
      host.emit("room:create", { name: "Preflight Host" });
    });

    host.on("player:ready", ({ playerId }) => {
      hostId = playerId;
    });

    host.on("room:update", (room) => {
      if (!roomCode) {
        roomCode = room.code;
        guest.emit("room:join", { name: "Preflight Guest", code: roomCode });
      }

      if (!tossSent && room.players?.length === 2 && room.phase === "toss-choice" && hostId && guestId) {
        tossSent = true;
        const tossWinner = room.toss?.winnerId === hostId ? host : guest;
        tossWinner.emit("toss:choose", { decision: "bat" });
      }

      if (!ballSent && room.phase === "playing" && room.current?.battingId && room.current?.bowlingId) {
        ballSent = true;
        const batter = room.current.battingId === hostId ? host : guest;
        const bowler = room.current.bowlingId === hostId ? host : guest;
        batter.emit("ball:choice", { number: 4 });
        bowler.emit("ball:choice", { number: 2 });
      }

      if (room.lastBall?.batterChoice === 4 && room.lastBall?.bowlerChoice === 2 && room.current?.runs >= 4) {
        clearTimeout(timer);
        closeSockets();
        resolve();
      }
    });

    guest.on("player:ready", ({ playerId }) => {
      guestId = playerId;
    });

    guest.on("room:error", ({ message }) => {
      clearTimeout(timer);
      closeSockets();
      reject(new Error(message));
    });

    host.on("connect_error", handleSocketError);
    guest.on("connect_error", handleSocketError);

    function handleSocketError(error) {
      clearTimeout(timer);
      closeSockets();
      reject(error);
    }

    function closeSockets() {
      host.disconnect();
      guest.disconnect();
    }
  });
}

function smokeTeamRoomFlow(url, origin) {
  return new Promise((resolve, reject) => {
    const host = createSocket(url, origin);
    const batter = createSocket(url, origin);
    const bowler = createSocket(url, origin);
    let roomCode = "";
    let hostId = "";
    let batterId = "";
    let bowlerId = "";
    let sidesSent = false;
    let captainsSent = false;
    let readySent = false;
    let latestRoom = null;

    const timer = setTimeout(() => {
      closeSockets();
      reject(new Error("team room smoke test timed out"));
    }, 11000);

    host.on("connect", () => {
      host.emit("team:createPrivate", { name: "Preflight Captain" });
    });

    host.on("team:ready", ({ playerId }) => {
      hostId = playerId;
      processTeamRoom();
    });

    batter.on("team:ready", ({ playerId }) => {
      batterId = playerId;
      processTeamRoom();
    });

    bowler.on("team:ready", ({ playerId }) => {
      bowlerId = playerId;
      processTeamRoom();
    });

    host.on("team:update", (room) => {
      latestRoom = room;
      if (!roomCode) {
        roomCode = room.code;
        batter.emit("team:joinPrivate", { name: "Preflight Batter", code: roomCode });
        bowler.emit("team:joinPrivate", { name: "Preflight Bowler", code: roomCode });
      }

      processTeamRoom();
    });

    for (const socket of [host, batter, bowler]) {
      socket.on("team:error", ({ message }) => {
        clearTimeout(timer);
        closeSockets();
        reject(new Error(message));
      });
      socket.on("connect_error", (error) => {
        clearTimeout(timer);
        closeSockets();
        reject(error);
      });
    }

    function processTeamRoom() {
      const room = latestRoom;
      if (!room) return;

      if (!sidesSent && room.players?.length === 3 && hostId && batterId && bowlerId) {
        sidesSent = true;
        host.emit("team:chooseSide", { side: "batting" });
        batter.emit("team:chooseSide", { side: "batting" });
        bowler.emit("team:chooseSide", { side: "bowling" });
      }

      const hasBatting = room.teams?.batting?.players?.includes(hostId) && room.teams?.batting?.players?.includes(batterId);
      const hasBowling = room.teams?.bowling?.players?.includes(bowlerId);
      if (!captainsSent && hasBatting && hasBowling) {
        captainsSent = true;
        host.emit("team:selectCaptain", { side: "batting", playerId: hostId });
        host.emit("team:selectCaptain", { side: "bowling", playerId: bowlerId });
      }

      const captainsSelected = room.captains?.batting === hostId && room.captains?.bowling === bowlerId;
      if (!readySent && captainsSelected) {
        readySent = true;
        host.emit("team:setReady", { ready: true });
        bowler.emit("team:setReady", { ready: true });
      }

      if (room.phase === "ready" && room.ready?.batting && room.ready?.bowling) {
        clearTimeout(timer);
        closeSockets();
        resolve();
      }
    }

    function closeSockets() {
      host.disconnect();
      batter.disconnect();
      bowler.disconnect();
    }
  });
}

function createSocket(url, origin) {
  return io(url, {
    extraHeaders: { Origin: origin },
    reconnection: false,
    timeout: 4000,
  });
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, "");
}
