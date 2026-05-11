import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import "./styles.css";
import hand1 from "./assets/hand-1.svg";
import hand2 from "./assets/hand-2.svg";
import hand3 from "./assets/hand-3.svg";
import hand4 from "./assets/hand-4.svg";
import hand5 from "./assets/hand-5.svg";
import hand6 from "./assets/hand-6.svg";

const SOCKET_URL = resolveSocketUrl();
const socket = io(SOCKET_URL, {
  autoConnect: false,
});

const NUMBERS = [1, 2, 3, 4, 5, 6];
const STORAGE_NAME_KEY = "cpl:captain-name";
const STORAGE_STATS_KEY = "cpl:bot-stats";
const HUMAN_ID = "human";
const BOT_ID = "bot";
const REGULAR_MAX_BALLS = 30;
const SUPER_OVER_MAX_BALLS = 6;
const WICKET_LIMIT = 1;
const RUN_GESTURES = {
  1: hand1,
  2: hand2,
  3: hand3,
  4: hand4,
  5: hand5,
  6: hand6,
};

function resolveSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (typeof window === "undefined") return "http://localhost:4000";

  const { protocol, hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return "http://localhost:4000";
  return `${protocol}//${hostname}:4000`;
}

function initialRouteFromUrl() {
  if (typeof window === "undefined") return { roomCode: "", activeMode: "dashboard" };

  const params = new URLSearchParams(window.location.search);
  const singleRoom = params.get("room")?.trim().toUpperCase() ?? "";
  const teamRoom = params.get("team")?.trim().toUpperCase() ?? "";

  if (teamRoom) return { roomCode: teamRoom, activeMode: "private-multiplayer" };
  if (singleRoom) return { roomCode: singleRoom, activeMode: "single" };
  return { roomCode: "", activeMode: "dashboard" };
}

function buildInviteUrl(code, type) {
  if (typeof window === "undefined") return "";

  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set(type === "team" ? "team" : "room", code);
  return url.toString();
}

function App() {
  const initialRoute = initialRouteFromUrl();
  const [name, setName] = useState(() => localStorage.getItem(STORAGE_NAME_KEY) || "");
  const [botStats, setBotStats] = useState(loadBotStats);
  const [roomCode, setRoomCode] = useState(initialRoute.roomCode);
  const [activeMode, setActiveMode] = useState(initialRoute.activeMode);
  const [playerId, setPlayerId] = useState(null);
  const [teamPlayerId, setTeamPlayerId] = useState(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState(null);
  const [teamRoom, setTeamRoom] = useState(null);
  const [error, setError] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [serverStatus, setServerStatus] = useState({ state: "checking", label: "Checking", detail: "Contacting live server" });

  useEffect(() => {
    socket.on("connect", () => {
      setConnected(true);
      setConnectionMessage("");
    });
    socket.on("disconnect", () => {
      setConnected(false);
      setConnectionMessage("Disconnected from live server.");
    });
    socket.on("connect_error", (socketError) => {
      setConnected(false);
      setConnectionMessage(`Live server connection failed: ${socketError.message}`);
    });
    socket.io.on("reconnect_attempt", () => {
      setConnectionMessage("Reconnecting to live server...");
    });
    socket.io.on("reconnect_failed", () => {
      setConnectionMessage("Could not reconnect to live server. Check backend URL and CORS.");
    });
    socket.on("player:ready", ({ playerId }) => setPlayerId(playerId));
    socket.on("room:update", (nextRoom) => {
      setRoom(nextRoom);
      setRoomCode(nextRoom.code);
      setError("");
    });
    socket.on("team:ready", ({ playerId }) => setTeamPlayerId(playerId));
    socket.on("team:update", (nextRoom) => {
      setTeamRoom(nextRoom);
      setRoomCode(nextRoom.code);
      setError("");
    });
    socket.on("room:error", ({ message }) => setError(message));
    socket.on("team:error", ({ message }) => setError(message));

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.io.off("reconnect_attempt");
      socket.io.off("reconnect_failed");
      socket.off("player:ready");
      socket.off("room:update");
      socket.off("team:ready");
      socket.off("team:update");
      socket.off("room:error");
      socket.off("team:error");
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_NAME_KEY, name);
  }, [name]);

  useEffect(() => {
    localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(botStats));
  }, [botStats]);

  useEffect(() => {
    let active = true;

    async function checkServerHealth() {
      try {
        const response = await fetch(`${SOCKET_URL.replace(/\/+$/, "")}/health`);
        const payload = await response.json();
        if (!active) return;

        if (response.ok && payload.ok) {
          setServerStatus({
            state: "online",
            label: "Live server ready",
            detail: `${payload.rooms ?? 0} rooms, ${payload.teamRooms ?? 0} team rooms`,
          });
          return;
        }

        setServerStatus({ state: "warning", label: "Server response issue", detail: `HTTP ${response.status}` });
      } catch (healthError) {
        if (!active) return;
        setServerStatus({ state: "offline", label: "Server unreachable", detail: healthError.message });
      }
    }

    checkServerHealth();
    const interval = window.setInterval(checkServerHealth, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  function ensureConnection() {
    if (!socket.connected) socket.connect();
  }

  function requireName() {
    if (name.trim()) return true;
    setError("Enter your player name first.");
    return false;
  }

  function createRoom() {
    if (!requireName()) return;
    ensureConnection();
    socket.emit("room:create", { name: name.trim() });
  }

  function joinRoom() {
    if (!requireName()) return;
    if (!roomCode.trim()) {
      setError("Enter a room code.");
      return;
    }
    ensureConnection();
    socket.emit("room:join", {
      name: name.trim(),
      code: roomCode.trim().toUpperCase(),
    });
  }

  function leaveRoom() {
    socket.emit("room:leave");
    setRoom(null);
    setRoomCode("");
    setPlayerId(null);
    setError("");
  }

  function joinPublicTeamRoom() {
    if (!requireName()) return;
    ensureConnection();
    socket.emit("team:joinPublic", { name: name.trim() });
  }

  function createPrivateTeamRoom() {
    if (!requireName()) return;
    ensureConnection();
    socket.emit("team:createPrivate", { name: name.trim() });
  }

  function joinPrivateTeamRoom() {
    if (!requireName()) return;
    if (!roomCode.trim()) {
      setError("Enter a private room code.");
      return;
    }
    ensureConnection();
    socket.emit("team:joinPrivate", {
      name: name.trim(),
      code: roomCode.trim().toUpperCase(),
    });
  }

  function leaveTeamRoom() {
    socket.emit("team:leave");
    setTeamRoom(null);
    setRoomCode("");
    setTeamPlayerId(null);
    setError("");
  }

  function recordBotResult(match) {
    setBotStats((currentStats) => updateBotStats(currentStats, match));
  }

  if (room) {
    return (
      <SingleMatchScreen
        room={room}
        playerId={playerId}
        error={error}
        onLeave={leaveRoom}
        onToss={(decision) => socket.emit("toss:choose", { decision })}
        onPlay={(number) => socket.emit("ball:choice", { number })}
      />
    );
  }

  if (teamRoom) {
    return (
      <TeamRoomScreen
        room={teamRoom}
        currentPlayerId={teamPlayerId}
        error={error}
        onLeave={leaveTeamRoom}
        onChooseSide={(side) => socket.emit("team:chooseSide", { side })}
        onSelectCaptain={(side, selectedPlayerId) => socket.emit("team:selectCaptain", { side, playerId: selectedPlayerId })}
        onMoveOrder={(teamId, playerIdToMove, direction) => {
          const order = [...teamRoom.teams[teamId].order];
          const index = order.indexOf(playerIdToMove);
          const nextIndex = index + direction;
          if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return;
          [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
          socket.emit("team:order", { teamId, orderType: "order", playerIds: order });
        }}
        onReady={(ready) => socket.emit("team:setReady", { ready })}
      />
    );
  }

  if (activeMode === "single-player") {
    return (
      <SinglePlayerLobbyScreen
        name={name}
        roomCode={roomCode}
        connected={connected}
        connectionMessage={connectionMessage}
        error={error}
        onNameChange={setName}
        onRoomCodeChange={setRoomCode}
        onBack={() => setActiveMode("dashboard")}
        onCreate={createRoom}
        onJoin={joinRoom}
      />
    );
  }

  if (activeMode === "multiplayer") {
    return (
      <MultiplayerEntryScreen
        name={name}
        connected={connected}
        connectionMessage={connectionMessage}
        error={error}
        onNameChange={setName}
        onBack={() => setActiveMode("dashboard")}
        onPublic={joinPublicTeamRoom}
        onPrivate={() => setActiveMode("private-multiplayer")}
      />
    );
  }

  if (activeMode === "private-multiplayer") {
    return (
      <PrivateMultiplayerScreen
        name={name}
        roomCode={roomCode}
        error={error}
        connectionMessage={connectionMessage}
        onNameChange={setName}
        onRoomCodeChange={setRoomCode}
        onBack={() => setActiveMode("multiplayer")}
        onCreate={createPrivateTeamRoom}
        onJoin={joinPrivateTeamRoom}
      />
    );
  }

  if (activeMode === "player-vs-bot") {
    return (
      <BotPracticeScreen
        name={name}
        stats={botStats}
        onNameChange={setName}
        onBack={() => setActiveMode("dashboard")}
        onRecordResult={recordBotResult}
      />
    );
  }

  if (activeMode === "profile") {
    return <ProfileScreen name={name} stats={botStats} onNameChange={setName} onMode={setActiveMode} />;
  }

  if (activeMode === "leaderboard") {
    return <LeaderboardScreen name={name} stats={botStats} onMode={setActiveMode} />;
  }

  return <DashboardScreen name={name} stats={botStats} serverStatus={serverStatus} onNameChange={setName} onMode={setActiveMode} />;
}

function DashboardScreen({ name, stats, serverStatus, onNameChange, onMode }) {
  return (
    <AppChrome activePage="dashboard" name={name} stats={stats} onNameChange={onNameChange} onMode={onMode}>
      <section className="page-section">
        <h2 className="section-title"><Icon name="radio_button_checked" /> Quick Stats</h2>
        <div className="quick-stats-grid">
          <MiniStat label="Matches" value={stats.games || 0} />
          <MiniStat label="Wins" value={stats.wins} />
          <MiniStat label="Losses" value={stats.losses} />
          <MiniStat label="Win Rate" value={`${winRate(stats)}%`} />
        </div>
      </section>

      <LiveServerPanel status={serverStatus} />

      <section className="page-section">
        <h2 className="section-title"><Icon name="radio_button_checked" /> Game Modes</h2>
        <div className="mode-grid stitch-mode-grid">
          <ModeCard
            icon="shuffle"
            title="Random Match"
            status="Queue"
            value="12 vs 12"
            description="Join the next open multiplayer lobby."
            onClick={() => onMode("multiplayer")}
          />
          <ModeCard
            icon="add_circle"
            title="Create Room"
            status="Host"
            value="1 vs 1"
            description="Host a room and share the code."
            onClick={() => onMode("single-player")}
          />
          <ModeCard
            icon="group"
            title="Join Room"
            status="Private"
            value="Code"
            description="Enter a private multiplayer room."
            onClick={() => onMode("private-multiplayer")}
          />
          <ModeCard
            icon="smart_toy"
            title="Bot Play"
            status="Practice"
            value="CPU"
            description="Train against the local CPL Cortex."
            onClick={() => onMode("player-vs-bot")}
          />
        </div>
      </section>

      <button className="leaderboard-cta" type="button" onClick={() => onMode("leaderboard")}>
        <Icon name="emoji_events" />
        <strong>Access Global Leaderboard</strong>
        <span>View top players and seasonal rankings</span>
      </button>
    </AppChrome>
  );
}

function AppChrome({ activePage, name, stats, onNameChange, onMode, children }) {
  const playerNameValue = name.trim() || "Gaming Pro";
  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="brand-mark">
          <Icon name="sports_esports" />
          <strong>GameDash</strong>
        </div>
        <div className="topbar-profile">
          <span>Pro Player</span>
          <strong>Welcome, {playerNameValue}</strong>
          <div className="nav-avatar">{initials(playerNameValue)}</div>
        </div>
      </header>
      <div className="app-layout">
        <aside className="side-nav">
          <nav>
            <NavButton icon="grid_view" label="Dashboard" active={activePage === "dashboard"} onClick={() => onMode("dashboard")} />
            <NavButton icon="person" label="Profile" active={activePage === "profile"} onClick={() => onMode("profile")} />
            <NavButton icon="leaderboard" label="Leaderboard" active={activePage === "leaderboard"} onClick={() => onMode("leaderboard")} />
          </nav>
          <button className="nav-item nav-logout" type="button">
            <Icon name="logout" />
            <span>Logout</span>
          </button>
        </aside>
        <main className="app-content">
          {activePage === "dashboard" && <ProfileBar name={name} stats={stats} onNameChange={onNameChange} />}
          {children}
        </main>
      </div>
      <nav className="mobile-tabbar">
        <NavButton icon="person" label="Profile" active={activePage === "profile"} onClick={() => onMode("profile")} />
        <NavButton icon="grid_view" label="Dashboard" active={activePage === "dashboard"} onClick={() => onMode("dashboard")} />
        <NavButton icon="leaderboard" label="Ranking" active={activePage === "leaderboard"} onClick={() => onMode("leaderboard")} />
      </nav>
    </div>
  );
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button className={`nav-item ${active ? "is-active" : ""}`} type="button" onClick={onClick}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

function Icon({ name }) {
  const icons = {
    sports_esports: (
      <>
        <path d="M8.5 12.5h-3m1.5-1.5v3" />
        <path d="M15.5 12.5h.01M18.5 12.5h.01" />
        <path d="M7 9h10a5 5 0 0 1 4.8 6.4l-.7 2.4a2.2 2.2 0 0 1-3.7.9l-2.2-2.2H8.8l-2.2 2.2a2.2 2.2 0 0 1-3.7-.9l-.7-2.4A5 5 0 0 1 7 9Z" />
      </>
    ),
    grid_view: (
      <>
        <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
      </>
    ),
    person: (
      <>
        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
        <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
      </>
    ),
    leaderboard: (
      <>
        <path d="M4 19h16" />
        <path d="M6 16V9h4v7M14 16V5h4v11" />
      </>
    ),
    logout: (
      <>
        <path d="M10 5H5v14h5" />
        <path d="M14 8l4 4-4 4M18 12H9" />
      </>
    ),
    radio_button_checked: <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />,
    shuffle: (
      <>
        <path d="M3 7h3c4 0 5 10 9 10h6" />
        <path d="M17 13l4 4-4 4M3 17h3c1.7 0 2.8-1.7 3.8-3.7M14.5 8.5C15.4 7.6 16.4 7 18 7h3" />
        <path d="M17 3l4 4-4 4" />
      </>
    ),
    add_circle: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </>
    ),
    group: (
      <>
        <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM15 20a6 6 0 0 0-12 0" />
        <path d="M17 11a3 3 0 1 0-1.2-5.8M21 20a5 5 0 0 0-5-5" />
      </>
    ),
    groups: (
      <>
        <path d="M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2 20a6 6 0 0 1 12 0" />
        <path d="M16 11a3.5 3.5 0 1 0 0-7M22 20a6 6 0 0 0-6-6" />
      </>
    ),
    smart_toy: (
      <>
        <path d="M12 4v3" />
        <rect x="5" y="7" width="14" height="12" rx="3" />
        <path d="M9 12h.01M15 12h.01M9 16h6" />
      </>
    ),
    emoji_events: (
      <>
        <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
        <path d="M8 6H4a4 4 0 0 0 4 4M16 6h4a4 4 0 0 1-4 4M12 12v4M9 20h6M10 16h4" />
      </>
    ),
    verified: (
      <>
        <path d="M12 3l2.2 1.6 2.7-.1.8 2.6 2.2 1.7-.9 2.6.9 2.6-2.2 1.7-.8 2.6-2.7-.1L12 21l-2.2-1.6-2.7.1-.8-2.6-2.2-1.7.9-2.6-.9-2.6 2.2-1.7.8-2.6 2.7.1L12 3Z" />
        <path d="M8.5 12.2l2.1 2.1 4.9-5" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3l7 3v5c0 4.5-2.8 8.4-7 10-4.2-1.6-7-5.5-7-10V6l7-3Z" />
      </>
    ),
    military_tech: (
      <>
        <path d="M8 3h8l-2 6h-4L8 3Z" />
        <circle cx="12" cy="14" r="4" />
        <path d="M12 12v4M10 14h4" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      </>
    ),
  };
  return (
    <span className="app-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        {icons[name] ?? icons.radio_button_checked}
      </svg>
    </span>
  );
}

function ProfileScreen({ name, stats, onNameChange, onMode }) {
  const playerNameValue = name.trim() || "Gaming Pro";
  return (
    <AppChrome activePage="profile" name={name} stats={stats} onMode={onMode}>
      <section className="profile-hero">
        <div className="profile-orb">{initials(playerNameValue)}</div>
        <div>
          <h1>{playerNameValue}</h1>
          <span className="tier-pill">Elite Tier Member</span>
          <p>CPL hand cricket captain. Track your bot practice record, tune your name, and jump back into match day.</p>
        </div>
        <label className="profile-edit">
          Display name
          <input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Captain name" maxLength={20} />
        </label>
      </section>
      <section className="quick-stats-grid">
        <MiniStat label="Matches Played" value={stats.games || 0} />
        <MiniStat label="Win Rate" value={`${winRate(stats)}%`} />
        <MiniStat label="Best Score" value={stats.bestScore || "-"} />
        <MiniStat label="Global Rank" value="#142" />
      </section>
      <section className="profile-columns">
        <article className="stitch-panel">
          <h2>Recent Match History</h2>
          <MatchHistory result="Victory" title="Bot Practice Chase" detail={`Best score: ${stats.bestScore || 0}`} icon="shield" />
          <MatchHistory result={stats.lastResult || "Ready"} title="Latest Session" detail={`${stats.wins}-${stats.losses}-${stats.ties} record`} icon="military_tech" />
          <MatchHistory result="Queue" title="Multiplayer Lobby" detail="Public and private rooms available" icon="groups" />
        </article>
        <article className="stitch-panel">
          <h2>Top Achievements</h2>
          <Achievement title="Unstoppable" progress={Math.min(100, stats.wins * 10)} icon="emoji_events" />
          <Achievement title="Sharpshooter" progress={stats.bestScore ? Math.min(100, stats.bestScore * 4) : 24} icon="target" />
        </article>
      </section>
    </AppChrome>
  );
}

function LeaderboardScreen({ name, stats, onMode }) {
  const playerNameValue = name.trim() || "Gaming Pro";
  const rows = [
    ["#1", "ShadowHunter", 450, "12,400"],
    ["#2", "CyberKnight", 412, "11,850"],
    ["#3", "PixelMage", 398, "11,200"],
    ["#4", "VoidWalker", 385, "10,900"],
    ["#5", "StormBringer", 370, "10,550"],
    ["#6", "IronGrip", 355, "10,100"],
    ["#7", "NeonPulse", 340, "9,800"],
    ["#8", "FrostByte", 325, "9,450"],
  ];

  return (
    <AppChrome activePage="leaderboard" name={name} stats={stats} onMode={onMode}>
      <header className="leaderboard-head">
        <h1>Global Leaderboard</h1>
        <p>Competing against the top CPL players worldwide.</p>
      </header>
      <section className="leaderboard-table-wrap">
        <table className="leaderboard-table">
          <thead>
            <tr><th>Rank</th><th>Username</th><th>Wins</th><th>Score</th></tr>
          </thead>
          <tbody>
            {rows.map(([rank, username, wins, score]) => (
              <tr key={username}>
                <td>{rank}</td>
                <td>{username}{rank === "#1" && <Icon name="verified" />}</td>
                <td>{wins}</td>
                <td>{score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="your-rank">
        <div className="rank-box">
          <span>Rank</span>
          <strong>#142</strong>
        </div>
        <div>
          <h2>{playerNameValue}</h2>
          <p>Wins: {stats.wins} | Score: {Math.max(2450, stats.bestScore * 100)}</p>
          <span className="tier-pill">Elite Tier</span>
        </div>
        <div className="rank-progress">
          <div><span>Progress to Master</span><strong>82%</strong></div>
          <i><b style={{ width: "82%" }} /></i>
        </div>
      </section>
    </AppChrome>
  );
}

function MatchHistory({ result, title, detail, icon }) {
  return (
    <div className="history-row">
      <Icon name={icon} />
      <div><strong>{title}</strong><span>{detail}</span></div>
      <b>{result}</b>
    </div>
  );
}

function Achievement({ title, progress, icon }) {
  return (
    <div className="achievement-row">
      <Icon name={icon} />
      <div>
        <strong>{title}</strong>
        <i><b style={{ width: `${progress}%` }} /></i>
      </div>
    </div>
  );
}

function ProfileBar({ name, stats, onNameChange }) {
  return (
    <header className="profile-bar">
      <div className="avatar">{initials(name)}</div>
      <div className="profile-copy">
        <span>Guest Profile</span>
        <strong>{name.trim() || "New Captain"}</strong>
      </div>
      <div className="profile-stats" aria-label="Bot practice record">
        <MiniStat label="Bot Record" value={`${stats.wins}-${stats.losses}-${stats.ties}`} />
        <MiniStat label="Best" value={stats.bestScore ? `${stats.bestScore}` : "-"} />
      </div>
      <label className="profile-name">
        Display name
        <input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Captain name" maxLength={20} />
      </label>
    </header>
  );
}

function ModeCard({ icon, title, status, value, description, tone, disabled, onClick }) {
  const className = `mode-card ${disabled ? "coming" : "playable"} ${tone === "team" ? "team-mode" : ""} ${tone === "bot" ? "bot-mode" : ""}`;

  return (
    <button className={className} type="button" disabled={disabled} onClick={onClick}>
      {icon && <Icon name={icon} />}
      <span className="status-chip">{status}</span>
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{description}</small>
    </button>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LiveServerPanel({ status }) {
  return (
    <section className={`live-server-panel is-${status.state}`} aria-live="polite">
      <div>
        <span className="server-dot" />
        <div>
          <span>Live Backend</span>
          <strong>{status.label}</strong>
        </div>
      </div>
      <p>{status.detail}</p>
      <code>{SOCKET_URL}</code>
    </section>
  );
}

function SinglePlayerLobbyScreen({ name, roomCode, connected, connectionMessage, error, onNameChange, onRoomCodeChange, onBack, onCreate, onJoin }) {
  return (
    <main className="shell lobby">
      <button className="ghost back-button" onClick={onBack}>Back</button>
      <section className="broadcast-hero compact-hero">
        <div>
          <p className="eyebrow">Single Player</p>
          <h1>Quick 1 vs 1 match</h1>
        </div>
        <p>Create a private room or join with a code.</p>
      </section>

      <section className="quick-match-grid">
        <PlayerNamePanel name={name} onNameChange={onNameChange} connected={connected} connectionMessage={connectionMessage} error={error} />
        <article className="action-panel">
          <span className="status-chip">Host</span>
          <h2>Create Room</h2>
          <p>Start a room and share the code with your opponent.</p>
          <button onClick={onCreate}>Create Room</button>
        </article>
        <article className="action-panel">
          <span className="status-chip">Join</span>
          <h2>Enter Code</h2>
          <input value={roomCode} onChange={(event) => onRoomCodeChange(event.target.value.toUpperCase())} placeholder="ROOM" maxLength={4} />
          <button onClick={onJoin}>Join Match</button>
        </article>
      </section>
    </main>
  );
}

function MultiplayerEntryScreen({ name, connected, connectionMessage, error, onNameChange, onBack, onPublic, onPrivate }) {
  return (
    <main className="shell lobby">
      <button className="ghost back-button" onClick={onBack}>Back</button>
      <section className="broadcast-hero compact-hero">
        <div>
          <p className="eyebrow">Multiplayer</p>
          <h1>12 vs 12 team setup</h1>
        </div>
        <p>Quick join a public lobby or create a private room for your group.</p>
      </section>

      <section className="quick-match-grid">
        <PlayerNamePanel name={name} onNameChange={onNameChange} connected={connected} connectionMessage={connectionMessage} error={error} />
        <article className="action-panel public-action">
          <span className="status-chip">Public</span>
          <h2>Quick Public Room</h2>
          <p>Join the first open room and choose your side from the waiting pool.</p>
          <button onClick={onPublic}>Find Public Room</button>
        </article>
        <article className="action-panel">
          <span className="status-chip">Private</span>
          <h2>Room Code</h2>
          <p>Create or join a private multiplayer room.</p>
          <button className="secondary-action" onClick={onPrivate}>Private Room</button>
        </article>
      </section>
    </main>
  );
}

function PrivateMultiplayerScreen({ name, roomCode, error, connectionMessage, onNameChange, onRoomCodeChange, onBack, onCreate, onJoin }) {
  return (
    <main className="shell lobby">
      <button className="ghost back-button" onClick={onBack}>Back</button>
      <section className="broadcast-hero compact-hero">
        <div>
          <p className="eyebrow">Private Multiplayer</p>
          <h1>Create or join</h1>
        </div>
        <p>Private rooms are invite-only through the room code.</p>
      </section>

      <section className="quick-match-grid">
        <PlayerNamePanel name={name} onNameChange={onNameChange} connectionMessage={connectionMessage} error={error} />
        <article className="action-panel">
          <span className="status-chip">Host</span>
          <h2>Create Private</h2>
          <p>Become host and select captains after sides are formed.</p>
          <button onClick={onCreate}>Create Private</button>
        </article>
        <article className="action-panel">
          <span className="status-chip">Join</span>
          <h2>Room Code</h2>
          <input value={roomCode} onChange={(event) => onRoomCodeChange(event.target.value.toUpperCase())} placeholder="ROOM" maxLength={5} />
          <button onClick={onJoin}>Join Room</button>
        </article>
      </section>
    </main>
  );
}

function PlayerNamePanel({ name, connected, connectionMessage, error, onNameChange }) {
  return (
    <article className="action-panel player-panel">
      <span className="status-chip">Player</span>
      <label>
        Player name
        <input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Captain name" maxLength={20} />
      </label>
      {typeof connected === "boolean" && (
        <p className={connected ? "status online" : "status"}>{connected ? "Connected to server" : "Not connected yet"}</p>
      )}
      {connectionMessage && <p className="connection-warning" role="status" aria-live="polite">{connectionMessage}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </article>
  );
}

function BotPracticeScreen({ name, stats, onNameChange, onBack, onRecordResult }) {
  const [difficulty, setDifficulty] = useState("pro");
  const [match, setMatch] = useState(null);
  const [recordedMatchId, setRecordedMatchId] = useState(null);
  const schedule = useManagedTimeout();

  useEffect(() => {
    if (!match || match.phase !== "finished" || recordedMatchId === match.id) return;
    onRecordResult(match);
    setRecordedMatchId(match.id);
  }, [match, onRecordResult, recordedMatchId]);

  function start(decision) {
    setMatch(createBotMatch(name, difficulty, decision));
    setRecordedMatchId(null);
  }

  function reset() {
    setMatch(null);
  }

  function play(number) {
    setMatch((currentMatch) => {
      if (!currentMatch) return currentMatch;
      if (number === null) {
        if (currentMatch.phase !== "innings-break") return currentMatch;
        return startNextBotInnings(currentMatch);
      }
      if (currentMatch.phase !== "playing" || currentMatch.isRevealing) return currentMatch;
      const nextMatch = resolveBotBall(currentMatch, number);
      if (nextMatch.phase === "playing" && nextMatch.isRevealing) {
        schedule(() => {
          setMatch((queuedMatch) => {
            if (!queuedMatch || queuedMatch.id !== nextMatch.id || queuedMatch.phase !== "playing") return queuedMatch;
            return {
              ...queuedMatch,
              isRevealing: false,
              lastBall: null,
              message: `${playerName(queuedMatch, queuedMatch.current.battingId)} is batting. Read the pattern and pick your number.`,
            };
          });
        }, 950);
      }
      return nextMatch;
    });
  }

  if (!match) {
    return (
      <main className="shell lobby bot-lobby">
        <button className="ghost back-button" onClick={onBack}>Back</button>
        <section className="broadcast-hero compact-hero bot-hero">
          <div>
            <p className="eyebrow">Player vs Bot</p>
            <h1>Practice under pressure</h1>
          </div>
          <p>Train batting tempo, bowling traps, and chase decisions without a room code.</p>
        </section>

        <section className="quick-match-grid bot-setup-grid">
          <PlayerNamePanel name={name} onNameChange={onNameChange} />
          <article className="action-panel bot-record-panel">
            <span className="status-chip">Record</span>
            <h2>{stats.games ? `${stats.wins}-${stats.losses}-${stats.ties}` : "No matches yet"}</h2>
            <div className="record-grid">
              <MiniStat label="Streak" value={stats.streak ? `${stats.streak}` : "-"} />
              <MiniStat label="Best Score" value={stats.bestScore ? `${stats.bestScore}` : "-"} />
              <MiniStat label="Last" value={stats.lastResult || "Fresh"} />
            </div>
          </article>
          <article className="action-panel bot-difficulty">
            <span className="status-chip">AI Level</span>
            <h2>CPL Cortex</h2>
            <div className="difficulty-row" role="group" aria-label="Bot difficulty">
              {["rookie", "pro", "elite"].map((level) => (
                <button
                  key={level}
                  className={difficulty === level ? "is-selected" : "secondary-action"}
                  onClick={() => setDifficulty(level)}
                  aria-pressed={difficulty === level}
                >
                  {level}
                </button>
              ))}
            </div>
            <p>{botDifficultyCopy(difficulty)}</p>
          </article>
          <article className="action-panel">
            <span className="status-chip">Toss Call</span>
            <h2>Choose Plan</h2>
            <div className="choice-row">
              <button onClick={() => start("bat")}>Bat First</button>
              <button className="secondary-action" onClick={() => start("bowl")}>Bowl First</button>
            </div>
          </article>
        </section>
      </main>
    );
  }

  return (
      <BotMatchScreen
        match={match}
        stats={stats}
        onBack={reset}
        onExit={onBack}
        onPlay={play}
    />
  );
}

function BotMatchScreen({ match, stats, onBack, onExit, onPlay }) {
  const myRole = match.current?.battingId === HUMAN_ID ? "Batting" : "Bowling";
  const pressure = matchPressure(match);
  const canPlay = match.phase === "playing" && !match.isRevealing;
  const botRead = botInsight(match, myRole);
  const canStartNextInnings = match.phase === "innings-break" && Boolean(match.nextInnings);
  const continueInnings = useCallback(() => {
    if (!canStartNextInnings) return;
    onPlay(null);
  }, [canStartNextInnings, onPlay]);
  useNumberHotkeys(canPlay, onPlay);
  useEnterHotkey(canStartNextInnings, continueInnings);

  return (
    <main className={`shell game bot-match ${match.isRevealing ? "is-revealing" : ""}`}>
      <header className="scorebar broadcast-rail">
        <InfoTile label="Mode" value="Bot" />
        <InfoTile label="Score" value={`${match.current?.runs ?? 0}/${match.current?.wickets ?? 0}`} />
        <InfoTile label="Overs" value={`${formatOvers(match.current?.balls ?? 0)} / ${match.superOver ? "1" : "5"}`} />
        <InfoTile label="Target" value={match.target || "-"} />
      </header>

      <section className="match-meta">
        <div>
          <p>{playerName(match, HUMAN_ID)}</p>
          <strong>{myRole}</strong>
        </div>
        <div>
          <p>{playerName(match, BOT_ID)}</p>
          <strong>{match.difficultyLabel}</strong>
        </div>
        <button className="ghost" onClick={onExit}>Exit</button>
      </section>

      <section className={`match-stage ${match.isRevealing ? "is-revealing" : ""}`} aria-live="polite" aria-busy={match.isRevealing}>
        <p className="phase">{phaseLabel(match)}</p>
        <div className="pressure-row">
          <MiniStat label="Need" value={pressure.need} />
          <MiniStat label="Balls Left" value={pressure.ballsLeft} />
          <MiniStat label="Run Rate" value={pressure.runRate} />
          <MiniStat label="Req Rate" value={pressure.requiredRate} />
          <MiniStat label="Projected" value={pressure.projected} />
        </div>
          <RevealFaceoff
            room={match}
            batterChoice={match.lastBall?.batterChoice}
            bowlerChoice={match.lastBall?.bowlerChoice}
            batterId={match.current?.battingId}
            bowlerId={match.current?.bowlingId}
            isResolved={Boolean(match.lastBall)}
          />
        <h2>{match.message}</h2>
        <MatchCue room={match} perspectiveId={HUMAN_ID} />
        <RecentBalls events={match.current?.recentEvents ?? []} />
        <InningsSummary summaries={botInningsSummary(match)} room={match} />
        {match.phase === "finished" && (
          <ResultPanel
            title={resultTitle(match, HUMAN_ID)}
            detail={resultDetail(match)}
            primaryLabel="New Practice"
            secondaryLabel="Exit"
            onPrimary={onBack}
            onSecondary={onExit}
          />
        )}
      </section>

      <section className="bot-coach">
        <MiniStat label="Cortex Read" value={botRead} />
        <MiniStat label="Momentum" value={match.momentum} />
        <MiniStat label="Career" value={`${stats.wins}-${stats.losses}-${stats.ties}`} />
        <button className="ghost" onClick={onBack}>New Practice</button>
      </section>

      <section className="controls">
        <div className="pending">
          <span>{match.isRevealing ? "Cortex revealing the ball" : canPlay ? "Pick your number or press 1-6" : canStartNextInnings ? "Innings break. Press Enter or continue." : "Session complete"}</span>
          <span>{myRole === "Batting" ? "You score if numbers differ" : "Match the bot to take the wicket"}</span>
        </div>
        {canStartNextInnings && (
          <button className="continue-innings" onClick={continueInnings}>
            Start Next Innings
          </button>
        )}
        <div className="number-grid">
          {NUMBERS.map((number) => (
            <RunChoiceButton key={number} number={number} disabled={!canPlay} onPlay={onPlay} role={myRole} />
          ))}
        </div>
      </section>
    </main>
  );
}

function TeamRoomScreen({ room, currentPlayerId, error, onLeave, onChooseSide, onSelectCaptain, onMoveOrder, onReady }) {
  const isHost = room.hostId === currentPlayerId;
  const myTeamSide = getPlayerSide(room, currentPlayerId);
  const nextAction = teamNextAction(room, isHost, myTeamSide, currentPlayerId);
  const totalAssigned = room.teams.batting.players.length + room.teams.bowling.players.length;
  const readyCount = Number(Boolean(room.ready.batting)) + Number(Boolean(room.ready.bowling));

  return (
    <main className="shell team-room">
      <header className="team-header broadcast-rail">
        <InfoTile label={room.visibility === "public" ? "Public Room" : "Private Room"} value={room.code} />
        <InfoTile label="Players" value={`${room.players.length}/${room.maxPlayers}`} />
        <InfoTile label="Host" value={playerName(room, room.hostId)} />
        <InfoTile label="Phase" value={phaseName(room.phase)} />
        <button className="ghost" onClick={onLeave}>Leave</button>
      </header>

      <StatusBanner title={phaseTitle(room.phase)} message={nextAction} detail={room.message} tone={room.phase === "ready" ? "ready" : "live"} />
      {error && <p className="error room-error" role="alert">{error}</p>}

      {["setup", "ready"].includes(room.phase) && (
        <RoomInvitePanel code={room.code} type="team" label={room.visibility === "public" ? "Public team room" : "Private team room"} />
      )}

      <section className="setup-progress">
        <MiniStat label="Assigned" value={`${totalAssigned}/${room.players.length}`} />
        <MiniStat label="Captains" value={`${Number(Boolean(room.captains.batting)) + Number(Boolean(room.captains.bowling))}/2`} />
        <MiniStat label="Ready Sides" value={`${readyCount}/2`} />
        <div className="progress-track" aria-label="Room setup progress">
          <span style={{ width: `${teamSetupProgress(room)}%` }} />
        </div>
      </section>

      <section className="waiting-panel">
        <div>
          <span>Waiting Pool</span>
          <strong>{room.unassignedPlayers.length}</strong>
        </div>
        <PlayerList playerIds={room.unassignedPlayers} room={room} emptyText="All players have chosen a side" />
      </section>

      <section className="teams-grid batting-bowling-grid">
        {["batting", "bowling"].map((side) => (
          <TeamSetupPanel
            key={side}
            side={side}
            team={room.teams[side]}
            room={room}
            currentPlayerId={currentPlayerId}
            isHost={isHost}
            myTeamSide={myTeamSide}
            onChooseSide={onChooseSide}
            onSelectCaptain={onSelectCaptain}
            onMoveOrder={onMoveOrder}
            onReady={onReady}
          />
        ))}
      </section>
    </main>
  );
}

function InfoTile({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RoomInvitePanel({ code, type, label }) {
  const [status, setStatus] = useState("");
  const inviteUrl = buildInviteUrl(code, type);
  const inviteText = `Join my CPL ${type === "team" ? "team" : "hand cricket"} room ${code}: ${inviteUrl}`;

  async function copyInvite() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteText);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = inviteText;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setStatus("Invite copied");
    } catch {
      setStatus("Copy failed");
    }
  }

  async function shareInvite() {
    if (!navigator.share) {
      await copyInvite();
      return;
    }

    try {
      await navigator.share({
        title: "Join my CPL room",
        text: `Room code ${code}`,
        url: inviteUrl,
      });
      setStatus("Invite shared");
    } catch {
      setStatus("Share cancelled");
    }
  }

  return (
    <section className="invite-panel" aria-label={`${label} invite`}>
      <div>
        <span>{label}</span>
        <strong>{code}</strong>
        <p>{inviteUrl}</p>
      </div>
      <div className="invite-actions">
        <button type="button" onClick={copyInvite}>Copy Invite</button>
        <button type="button" className="secondary-action" onClick={shareInvite}>Share</button>
      </div>
      {status && <p className="invite-status" aria-live="polite">{status}</p>}
    </section>
  );
}

function StatusBanner({ title, message, detail, tone }) {
  return (
    <section className={`status-banner ${tone === "ready" ? "ready-banner is-ready" : "is-live"}`} aria-live="polite">
      <p className="phase">{title}</p>
      <h2>{message}</h2>
      {detail && <p>{detail}</p>}
    </section>
  );
}

function TeamSetupPanel({ side, team, room, currentPlayerId, isHost, myTeamSide, onChooseSide, onSelectCaptain, onMoveOrder, onReady }) {
  const captainId = room.captains[side];
  const isCaptain = captainId === currentPlayerId;
  const isFull = team.players.length >= room.maxPlayersPerSide;
  const selectedThisSide = myTeamSide === side;
  const orderTitle = side === "batting" ? "Batting Order" : "Bowling Order";

  return (
    <article className={`team-panel ${side}-panel ${room.ready[side] ? "is-ready" : ""} ${selectedThisSide ? "is-selected" : ""}`}>
      <header>
        <div>
          <span>{team.name}</span>
          <strong>{team.players.length}/{room.maxPlayersPerSide}</strong>
        </div>
        <div className="team-badges">
          <p>{side === "batting" ? "Bats first" : "Bowls first"}</p>
          {isCaptain && <p>Captain</p>}
        </div>
      </header>

      <button className="join-side-button" disabled={isFull || selectedThisSide} onClick={() => onChooseSide(side)}>
        {selectedThisSide ? "You are here" : isFull ? "Team Full" : `Join ${team.name}`}
      </button>

      <section className="captain-block">
        <h3>Captain</h3>
        <strong>{playerName(room, captainId) || "Not selected"}</strong>
        {isHost && team.players.length > 0 && (
          <div className="captain-actions">
            {team.players.map((playerId) => (
              <button key={playerId} className={captainId === playerId ? "selected-captain is-selected" : ""} onClick={() => onSelectCaptain(side, playerId)}>
                {playerName(room, playerId)}
              </button>
            ))}
          </div>
        )}
      </section>

      <OrderList title={orderTitle} team={team} room={room} isCaptain={isCaptain} onMove={(playerId, direction) => onMoveOrder(side, playerId, direction)} />

      <div className="ready-row">
        <span>{room.ready[side] ? "Ready" : "Not Ready"}</span>
        {isCaptain && (
          <button onClick={() => onReady(!room.ready[side])}>{room.ready[side] ? "Mark Not Ready" : "Mark Ready"}</button>
        )}
      </div>
    </article>
  );
}

function OrderList({ title, team, room, isCaptain, onMove }) {
  return (
    <section className="order-block">
      <h3>{title}</h3>
      <ol>
        {team.order.map((playerId, index) => (
          <li key={playerId}>
            <span>{index + 1}. {playerName(room, playerId)}</span>
            {isCaptain && (
              <div className="order-buttons">
                <button disabled={index === 0} onClick={() => onMove(playerId, -1)}>Up</button>
                <button disabled={index === team.order.length - 1} onClick={() => onMove(playerId, 1)}>Down</button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function SingleMatchScreen({ room, playerId, error, onLeave, onToss, onPlay }) {
  const me = room.players.find((player) => player.id === playerId);
  const opponent = room.players.find((player) => player.id !== playerId);
  const isTossWinner = room.toss?.winnerId === playerId;
  const needsTossChoice = room.phase === "toss-choice" && isTossWinner;
  const myRole = matchRoleLabel(room, playerId);
  const canPlay = room.phase === "playing" && room.players.length === 2 && !room.isRevealing && !room.pendingChoices[playerId];
  const pressure = matchPressure(room);
  const recentEvents = room.current?.recentEvents ?? [];
  useNumberHotkeys(canPlay, onPlay);

  return (
    <main className={`shell game ${room.isRevealing ? "is-revealing" : ""}`}>
      <header className="scorebar broadcast-rail">
        <InfoTile label="Room" value={room.code} />
        <InfoTile label="Score" value={`${room.current?.runs ?? 0}/${room.current?.wickets ?? 0}`} />
        <InfoTile label="Overs" value={`${formatOvers(room.current?.balls ?? 0)} / 5`} />
        <InfoTile label="Target" value={room.target || "-"} />
      </header>

      <section className="match-meta">
        <div>
          <p>{me?.name ?? "You"}</p>
          <strong>{myRole}</strong>
        </div>
        <div>
          <p>{opponent?.name ?? "Waiting for player"}</p>
          <strong>{opponent ? "Online" : "Share the room code"}</strong>
        </div>
        <button className="ghost" onClick={onLeave}>Leave</button>
      </section>

      {room.phase === "waiting" && (
        <>
          <StatusBanner title="Waiting" message="Waiting for opponent" detail={`Share room code ${room.code}. The toss starts when the second player joins.`} />
          <RoomInvitePanel code={room.code} type="room" label="Two-player room" />
        </>
      )}

      {room.phase === "toss-choice" && (
        <section className="status-banner is-live">
          <p className="phase">Toss</p>
          <h2>{isTossWinner ? "You won the toss" : `${winnerName(room)} won the toss`}</h2>
          {needsTossChoice ? (
            <div className="choice-row">
              <button onClick={() => onToss("bat")}>Bat First</button>
              <button onClick={() => onToss("bowl")}>Bowl First</button>
            </div>
          ) : (
            <p>Waiting for toss decision.</p>
          )}
        </section>
      )}

      {(room.phase === "playing" || room.phase === "innings-break" || room.phase === "finished") && (
        <section className={`match-stage ${room.isRevealing ? "is-revealing" : ""}`} aria-live="polite">
          <p className="phase">{phaseLabel(room)}</p>
        <div className="pressure-row">
          <MiniStat label="Need" value={pressure.need} />
          <MiniStat label="Balls Left" value={pressure.ballsLeft} />
          <MiniStat label="Run Rate" value={pressure.runRate} />
          <MiniStat label="Req Rate" value={pressure.requiredRate} />
          <MiniStat label="Projected" value={pressure.projected} />
        </div>
          <RevealFaceoff
            room={room}
            batterChoice={room.lastBall?.batterChoice}
            bowlerChoice={room.lastBall?.bowlerChoice}
            batterId={room.current?.battingId}
            bowlerId={room.current?.bowlingId}
            isResolved={Boolean(room.lastBall)}
          />
          <h2>{room.message}</h2>
          <MatchCue room={room} perspectiveId={playerId} />
          <RecentBalls events={recentEvents} />
          <InningsSummary summaries={room.inningsSummary ?? []} room={room} />
          {room.phase === "finished" && (
            <ResultPanel
              title={resultTitle(room, playerId)}
              detail={resultDetail(room)}
              primaryLabel="Leave Match"
              onPrimary={onLeave}
            />
          )}
        </section>
      )}

      <section className="controls">
        <div className="pending">
          {room.phase === "playing" && (
            <>
              <span>{room.isRevealing ? "Showing result" : room.pendingChoices[playerId] ? "Your choice locked" : "Pick your number or press 1-6"}</span>
              <span>{room.isRevealing ? "Next ball loading" : opponent ? (room.pendingChoices[opponent.id] ? "Opponent locked" : "Waiting on opponent") : "No opponent"}</span>
            </>
          )}
        </div>
        <div className="number-grid">
          {NUMBERS.map((number) => (
            <RunChoiceButton key={number} number={number} disabled={!canPlay} onPlay={onPlay} role={myRole} />
          ))}
        </div>
      </section>

      {error && <p className="error floating" role="alert">{error}</p>}
    </main>
  );
}

function RecentBalls({ events }) {
  if (!events.length) {
    return <p className="recent-empty">No balls yet. First choice sets the tone.</p>;
  }

  return (
    <ol className="recent-balls" aria-label="Recent balls">
      {events.map((event, index) => (
        <li key={`${event.batterChoice}-${event.bowlerChoice}-${index}`} className={event.isOut ? "is-wicket" : event.runs >= 4 ? "is-boundary" : ""}>
          {event.isOut ? "W" : event.runs}
        </li>
      ))}
    </ol>
  );
}

function MatchCue({ room, perspectiveId }) {
  const items = matchCueItems(room, perspectiveId);
  if (!items.length) return null;

  return (
    <section className="match-cue" aria-label="Match cues">
      {items.map((item) => (
        <div key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </section>
  );
}

function useNumberHotkeys(enabled, onPick) {
  useEffect(() => {
    if (!enabled) return undefined;

    function handleKeyDown(event) {
      const target = event.target;
      const isTyping = target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (isTyping || event.repeat || !/^[1-6]$/.test(event.key)) return;
      event.preventDefault();
      onPick(Number(event.key));
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onPick]);
}

function useEnterHotkey(enabled, onSubmit) {
  useEffect(() => {
    if (!enabled) return undefined;

    function handleKeyDown(event) {
      const target = event.target;
      const isTyping = target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (isTyping || event.repeat || event.key !== "Enter") return;
      event.preventDefault();
      onSubmit();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onSubmit]);
}

function useManagedTimeout() {
  const timeoutIdsRef = useRef([]);

  useEffect(() => {
    return () => {
      for (const timeoutId of timeoutIdsRef.current) window.clearTimeout(timeoutId);
      timeoutIdsRef.current = [];
    };
  }, []);

  return useCallback((callback, delay) => {
    const timeoutId = window.setTimeout(() => {
      timeoutIdsRef.current = timeoutIdsRef.current.filter((id) => id !== timeoutId);
      callback();
    }, delay);
    timeoutIdsRef.current.push(timeoutId);
    return timeoutId;
  }, []);
}

function RunChoiceButton({ number, disabled, onPlay, role }) {
  const gestureLabel = number === 6 ? "thumb" : `${number} finger${number === 1 ? "" : "s"}`;
  return (
    <button
      disabled={disabled}
      onClick={() => onPlay(number)}
      aria-label={`Play ${number}, ${gestureLabel}, ${choiceLabel(number, role)}`}
    >
      <img className="run-gesture" src={RUN_GESTURES[number]} alt="" aria-hidden="true" />
      <strong>{number}</strong>
      <span>{choiceLabel(number, role)}</span>
    </button>
  );
}

function RevealFaceoff({ room, batterChoice, bowlerChoice, batterId, bowlerId, isResolved }) {
  return (
    <div className="reveal faceoff-reveal">
      <CharacterReveal
        side="left"
        roleLabel="Batter"
        name={playerName(room, batterId)}
        choice={batterChoice}
        isResolved={isResolved}
      />
      <CharacterReveal
        side="right"
        roleLabel="Bowler"
        name={playerName(room, bowlerId)}
        choice={bowlerChoice}
        isResolved={isResolved}
      />
    </div>
  );
}

function CharacterReveal({ side, roleLabel, name, choice, isResolved }) {
  return (
    <div className={`faceoff-card ${side} ${isResolved ? "has-result" : ""}`}>
      <span>{roleLabel} · {name || "Player"}</span>
      <div className="character-stage">
        <div className="gesture-bubble" aria-label={`${roleLabel} choice`}>
          {choice ? <img src={RUN_GESTURES[choice]} alt="" aria-hidden="true" /> : <em>?</em>}
        </div>
        <div className={`player-silhouette ${side}`} aria-hidden="true" />
      </div>
    </div>
  );
}

function InningsSummary({ summaries, room }) {
  if (!summaries.length) return null;

  return (
    <ol className="innings-summary" aria-label="Innings summary">
      {summaries.map((innings, index) => (
        <li key={`${innings.battingId}-${index}`}>
          <span>{index + 1}</span>
          <strong>{playerName(room, innings.battingId)}</strong>
          <b>{innings.runs}/{innings.wickets}</b>
          <small>{formatOvers(innings.balls)} ov</small>
        </li>
      ))}
    </ol>
  );
}

function ResultPanel({ title, detail, primaryLabel, secondaryLabel, onPrimary, onSecondary }) {
  return (
    <section className="result-panel" aria-label="Match result">
      <p className="winner">{title}</p>
      <span>{detail}</span>
      <div className="result-actions">
        <button onClick={onPrimary}>{primaryLabel}</button>
        {secondaryLabel && <button className="ghost" onClick={onSecondary}>{secondaryLabel}</button>}
      </div>
    </section>
  );
}

function PlayerList({ playerIds, room, emptyText }) {
  if (playerIds.length === 0) return <p className="empty-list">{emptyText}</p>;

  return (
    <ol className="simple-player-list">
      {playerIds.map((playerId) => (
        <li key={playerId}>{playerName(room, playerId)}</li>
      ))}
    </ol>
  );
}

function teamNextAction(room, isHost, myTeamSide, currentPlayerId) {
  if (room.phase === "team-selection") return myTeamSide ? "Waiting for both sides to form" : "Choose Batting Team or Bowling Team";
  if (room.phase === "captain-selection") return isHost ? "Select one captain for each side" : "Waiting for host to select captains";
  if (room.phase === "order-selection") {
    const myCaptainSide = room.captains.batting === currentPlayerId ? "Batting Team" : room.captains.bowling === currentPlayerId ? "Bowling Team" : "";
    return myCaptainSide ? `Arrange ${myCaptainSide} and mark ready` : "Captains are arranging orders";
  }
  if (room.phase === "ready") return "Both captains are ready";
  return "Players are joining the room";
}

function phaseName(phase) {
  const names = {
    joining: "Joining",
    "team-selection": "Teams",
    "captain-selection": "Captains",
    "order-selection": "Orders",
    ready: "Ready",
  };
  return names[phase] ?? "Setup";
}

function phaseTitle(phase) {
  const titles = {
    joining: "Room open",
    "team-selection": "Team selection",
    "captain-selection": "Captain selection",
    "order-selection": "Order selection",
    ready: "Ready check complete",
  };
  return titles[phase] ?? "Team setup";
}

function teamSetupProgress(room) {
  const assigned = room.players.length ? ((room.teams.batting.players.length + room.teams.bowling.players.length) / room.players.length) * 34 : 0;
  const captains = (Number(Boolean(room.captains.batting)) + Number(Boolean(room.captains.bowling))) * 16;
  const ready = (Number(Boolean(room.ready.batting)) + Number(Boolean(room.ready.bowling))) * 17;
  return Math.min(100, Math.round(assigned + captains + ready));
}

function formatOvers(balls) {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

function matchPressure(room) {
  const balls = room.current?.balls ?? 0;
  const runs = room.current?.runs ?? 0;
  const maxBalls = room.superOver ? 6 : 30;
  const ballsLeft = Math.max(0, maxBalls - balls);
  const projected = balls > 0 ? Math.round((runs / balls) * maxBalls) : "-";
  const runRate = balls > 0 ? formatRate((runs * 6) / balls) : "-";

  if (room.target) {
    const need = Math.max(0, room.target - runs);
    return {
      need: room.phase === "finished" ? "0" : `${need}`,
      ballsLeft: `${ballsLeft}`,
      runRate,
      requiredRate: ballsLeft > 0 && room.phase !== "finished" ? formatRate((need * 6) / ballsLeft) : "0.0",
      projected: projected === "-" ? "-" : `${projected}`,
    };
  }

  return {
    need: "Set target",
    ballsLeft: `${ballsLeft}`,
    runRate,
    requiredRate: "-",
    projected: projected === "-" ? "-" : `${projected}`,
  };
}

function formatRate(value) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(1);
}

function matchRoleLabel(room, playerId) {
  if (!room.current) {
    if (room.phase === "waiting") return "Host";
    if (room.phase === "toss-choice") return room.toss?.winnerId === playerId ? "Toss Winner" : "Awaiting Toss";
    return "Ready";
  }
  return room.current.battingId === playerId ? "Batting" : "Bowling";
}

function resultTitle(room, perspectiveId) {
  if (!room.winnerId) return "Match tied";
  if (room.winnerId === perspectiveId) return "You win";
  return `${playerName(room, room.winnerId)} wins`;
}

function resultDetail(room) {
  const summaries = room.inningsSummary ?? botInningsSummary(room);
  if (summaries.length < 2) {
    return room.message || "Match complete.";
  }
  const [first, second] = summaries;
  const margin = Math.abs((second?.runs ?? 0) - (first?.runs ?? 0));
  if (!room.winnerId) return "Scores finished level after the final reveal.";
  if (second.runs > first.runs) {
    return `Chase completed by ${margin || 1} run${margin === 1 ? "" : "s"}.`;
  }
  return `Defended by ${margin || 1} run${margin === 1 ? "" : "s"}.`;
}

function matchCueItems(room, perspectiveId) {
  if (!room.current) return [];
  if (room.phase === "finished") return [];

  const current = room.current;
  const ballsLeft = Math.max(0, (room.superOver ? SUPER_OVER_MAX_BALLS : REGULAR_MAX_BALLS) - current.balls);

  if (room.phase === "innings-break") {
    return [
      { label: "Next Innings", value: `${playerName(room, current.bowlingId)} bats` },
      { label: "Target", value: room.target ? `${room.target}` : "Reset" },
      { label: "Pace", value: room.superOver ? "Super Over" : "Chase begins" },
    ];
  }

  if (room.phase !== "playing") return [];

  const isBatting = current.battingId === perspectiveId;
  const recentEvents = current.recentEvents ?? [];
  const lastEvent = recentEvents[recentEvents.length - 1];
  const need = room.target ? Math.max(0, room.target - current.runs) : null;
  const required = need === null || ballsLeft === 0 ? null : (need * 6) / ballsLeft;

  if (isBatting) {
    return [
      { label: "Plan", value: battingPlan(required, lastEvent) },
      { label: "Risk", value: lastEvent?.isOut ? "Fresh start" : "Avoid repeats" },
      { label: "Finish", value: need === null ? "Build target" : `${need} from ${ballsLeft}` },
    ];
  }

  return [
    { label: "Plan", value: bowlingPlan(required, lastEvent) },
    { label: "Wicket Ball", value: suggestedTrap(recentEvents) },
    { label: "Finish", value: need === null ? "Limit target" : `Defend ${need}` },
  ];
}

function battingPlan(required, lastEvent) {
  if (lastEvent?.isOut) return "Reset tempo";
  if (required === null) return "Bank runs";
  if (required >= 8) return "Attack now";
  if (required >= 5) return "Find a four";
  return "Rotate strike";
}

function bowlingPlan(required, lastEvent) {
  if (lastEvent?.isOut) return "Keep trap on";
  if (required === null) return "Stay tight";
  if (required >= 8) return "Protect sixes";
  if (required <= 3) return "Hunt wicket";
  return "Vary length";
}

function suggestedTrap(events) {
  const recent = events.slice(-4).map((event) => event.batterChoice);
  if (!recent.length) return "Read first";
  const counts = NUMBERS.map((number) => recent.filter((choice) => choice === number).length);
  const bestIndex = counts.indexOf(Math.max(...counts));
  return `${bestIndex + 1}`;
}

function choiceLabel(number, role) {
  if (role === "Bowling") {
    if (number <= 2) return "contain";
    if (number <= 4) return "trap";
    return "strike";
  }
  if (number <= 2) return "rotate";
  if (number <= 4) return "push";
  return "attack";
}

function botDifficultyCopy(difficulty) {
  const copy = {
    rookie: "Loose reads and wider random choices. Best for learning tempo.",
    pro: "Balanced pattern tracking with chase-aware batting.",
    elite: "Sharper reads, pressure batting, and more ruthless bowling traps.",
  };
  return copy[difficulty] ?? copy.pro;
}

function createBotMatch(name, difficulty, decision) {
  const playerNameValue = name.trim() || "New Captain";
  const difficultyLabel = difficulty[0].toUpperCase() + difficulty.slice(1);
  const battingId = decision === "bat" ? HUMAN_ID : BOT_ID;
  const bowlingId = decision === "bat" ? BOT_ID : HUMAN_ID;
  const match = {
    id: Date.now(),
    code: "CPU",
    players: [
      { id: HUMAN_ID, name: playerNameValue },
      { id: BOT_ID, name: "CPL Cortex" },
    ],
    difficulty,
    difficultyLabel,
    phase: "playing",
    innings: [],
    inningsIndex: 0,
    current: null,
    target: null,
    pendingChoices: {},
    lastBall: null,
    isRevealing: false,
    message: `${playerNameValue} ${decision === "bat" ? "takes first strike" : "opens with the ball"}.`,
    winnerId: null,
    superOver: false,
    momentum: "Fresh contest",
    nextInnings: null,
  };

  return startBotInnings(match, battingId, bowlingId);
}

function startBotInnings(match, battingId, bowlingId) {
  const innings = {
    battingId,
    bowlingId,
    runs: 0,
    wickets: 0,
    balls: 0,
    events: [],
    recentEvents: [],
  };

  return {
    ...match,
    phase: "playing",
    innings: [...match.innings, innings],
    inningsIndex: match.innings.length,
    current: innings,
    lastBall: null,
    isRevealing: false,
    message: `${playerName(match, battingId)} is batting. Pick your number.`,
    nextInnings: null,
  };
}

function resolveBotBall(match, humanNumber) {
  const botNumber = chooseBotNumber(match, humanNumber);
  const batterChoice = match.current.battingId === HUMAN_ID ? humanNumber : botNumber;
  const bowlerChoice = match.current.bowlingId === HUMAN_ID ? humanNumber : botNumber;
  const isOut = batterChoice === bowlerChoice;
  const event = {
    batterChoice,
    bowlerChoice,
    isOut,
    runs: isOut ? 0 : batterChoice,
  };
  const current = {
    ...match.current,
    balls: match.current.balls + 1,
    runs: match.current.runs + event.runs,
    wickets: match.current.wickets + (isOut ? 1 : 0),
    events: [...match.current.events, event],
    recentEvents: [...match.current.events, event].slice(-8),
  };
  const nextMatch = {
    ...match,
    current,
    innings: replaceCurrentInnings(match.innings, current),
    lastBall: event,
    isRevealing: true,
    message: botBallMessage(match, event),
    momentum: botMomentum(current, event),
  };

  if (isBotChaseComplete(nextMatch)) return finishBotMatch(nextMatch, current.battingId);
  if (isBotInningsOver(current, nextMatch)) return completeBotInnings(nextMatch);

  return nextMatch;
}

function replaceCurrentInnings(innings, current) {
  return innings.map((item, index) => (index === innings.length - 1 ? current : item));
}

function botBallMessage(match, event) {
  if (event.isOut) {
    return `Out! ${playerName(match, match.current.bowlingId)} read ${event.batterChoice}.`;
  }
  if (event.runs >= 5) return `${event.runs} runs! Clean strike into the lights.`;
  if (event.runs >= 3) return `${event.runs} runs. Pressure shifts.`;
  return `${event.runs} run${event.runs === 1 ? "" : "s"} added.`;
}

function botMomentum(current, event) {
  if (event.isOut) return "Wicket swing";
  const lastThree = current.recentEvents.slice(-3);
  const burst = lastThree.reduce((total, item) => total + item.runs, 0);
  if (burst >= 13) return "Batting surge";
  if (current.balls >= 18 && current.runs < 18) return "Bowling squeeze";
  if (event.runs >= 5) return "Boundary burst";
  return "Tactical arm-wrestle";
}

function isBotInningsOver(innings, match) {
  const maxBalls = match.superOver ? SUPER_OVER_MAX_BALLS : REGULAR_MAX_BALLS;
  return innings.balls >= maxBalls || innings.wickets >= WICKET_LIMIT;
}

function isBotChaseComplete(match) {
  return match.target && match.current.runs >= match.target;
}

function completeBotInnings(match) {
  const firstInnings = match.innings[0];

  if (match.innings.length === 1) {
    return {
      ...match,
      phase: "innings-break",
      target: firstInnings.runs + 1,
      isRevealing: false,
      message: `${playerName(match, firstInnings.battingId)} made ${firstInnings.runs}. Target is ${firstInnings.runs + 1}.`,
      nextInnings: {
        battingId: firstInnings.bowlingId,
        bowlingId: firstInnings.battingId,
      },
    };
  }

  const secondInnings = match.innings[1];
  if (secondInnings.runs === firstInnings.runs && !match.superOver) {
    return {
      ...match,
      phase: "innings-break",
      superOver: true,
      innings: [],
      inningsIndex: 0,
      target: null,
      current: match.current,
      isRevealing: false,
      message: "Scores level. Super Over starts now.",
      momentum: "Super Over",
      nextInnings: {
        battingId: match.current.bowlingId,
        bowlingId: match.current.battingId,
      },
    };
  }

  if (secondInnings.runs === firstInnings.runs && match.superOver) {
    return finishBotMatch(match, null);
  }

  return finishBotMatch(match, secondInnings.runs > firstInnings.runs ? secondInnings.battingId : firstInnings.battingId);
}

function startNextBotInnings(match) {
  if (!match.nextInnings) return match;
  return startBotInnings(match, match.nextInnings.battingId, match.nextInnings.bowlingId);
}

function finishBotMatch(match, winnerId) {
  return {
    ...match,
    phase: "finished",
    winnerId,
    isRevealing: false,
    message: winnerId ? `${playerName(match, winnerId)} wins the match.` : "Match tied.",
    momentum: winnerId === HUMAN_ID ? "Victory rush" : winnerId === BOT_ID ? "Defeat sting" : "Shared honors",
  };
}

function chooseBotNumber(match, humanNumber) {
  const role = match.current.battingId === BOT_ID ? "batting" : "bowling";
  const difficulty = match.difficulty;

  if (role === "batting") {
    return chooseBotBattingNumber(match, difficulty);
  }

  return chooseBotBowlingNumber(match, humanNumber, difficulty);
}

function chooseBotBattingNumber(match, difficulty) {
  const pressure = match.target ? Math.max(0, match.target - match.current.runs) / Math.max(1, (match.superOver ? SUPER_OVER_MAX_BALLS : REGULAR_MAX_BALLS) - match.current.balls) : 2.8;
  if (difficulty === "rookie") return randomWeighted([1, 2, 3, 4, 5, 6], [18, 18, 18, 18, 14, 14]);
  if (pressure >= 4.5) return randomWeighted([1, 2, 3, 4, 5, 6], [6, 8, 14, 20, 25, 27]);
  if (pressure <= 1.5) return randomWeighted([1, 2, 3, 4, 5, 6], [25, 23, 18, 14, 10, 10]);
  return randomWeighted([1, 2, 3, 4, 5, 6], difficulty === "elite" ? [13, 15, 19, 20, 17, 16] : [16, 17, 18, 18, 16, 15]);
}

function chooseBotBowlingNumber(match, humanNumber, difficulty) {
  if (difficulty === "rookie") return NUMBERS[Math.floor(Math.random() * NUMBERS.length)];

  const humanHistory = match.current.events.map((event) => event.batterChoice);
  const weights = NUMBERS.map((number) => 12);
  for (const number of humanHistory.slice(-6)) {
    weights[number - 1] += difficulty === "elite" ? 11 : 7;
  }
  if (difficulty === "elite") {
    weights[humanNumber - 1] += 6;
  }
  return randomWeighted(NUMBERS, weights);
}

function randomWeighted(values, weights) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;
  for (let index = 0; index < values.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return values[index];
  }
  return values[values.length - 1];
}

function loadBotStats() {
  const fallback = {
    games: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    streak: 0,
    bestScore: 0,
    lastResult: "",
  };

  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(STORAGE_STATS_KEY) || "{}") };
  } catch {
    return fallback;
  }
}

function updateBotStats(stats, match) {
  const result = match.winnerId === HUMAN_ID ? "Win" : match.winnerId === BOT_ID ? "Loss" : "Tie";
  const humanBestThisMatch = match.innings
    .filter((innings) => innings.battingId === HUMAN_ID)
    .reduce((best, innings) => Math.max(best, innings.runs), 0);

  return {
    games: stats.games + 1,
    wins: stats.wins + (result === "Win" ? 1 : 0),
    losses: stats.losses + (result === "Loss" ? 1 : 0),
    ties: stats.ties + (result === "Tie" ? 1 : 0),
    streak: result === "Win" ? Math.max(1, stats.streak + 1) : result === "Loss" ? Math.min(-1, stats.streak - 1) : 0,
    bestScore: Math.max(stats.bestScore, humanBestThisMatch),
    lastResult: result,
  };
}

function botInsight(match, myRole) {
  if (match.phase === "finished") return match.winnerId === HUMAN_ID ? "You cracked the read" : "Review the pattern";
  if (match.isRevealing) return "Ball resolved";
  if (myRole === "Batting") return match.difficulty === "elite" ? "Avoid repeating your favorite" : "Mix risk with singles";
  if (match.target) return "Defend the chase line";
  return "Hunt for the matching number";
}

function botInningsSummary(match) {
  return match.innings.map((innings) => ({
    battingId: innings.battingId,
    runs: innings.runs,
    wickets: innings.wickets,
    balls: innings.balls,
  }));
}

function playerName(room, id) {
  if (!id) return "";
  return room.players.find((player) => player.id === id)?.name ?? "Player";
}

function winnerName(room) {
  return playerName(room, room.toss?.winnerId);
}

function initials(name) {
  const cleanName = name.trim();
  if (!cleanName) return "CP";
  return cleanName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function winRate(stats) {
  const total = stats.wins + stats.losses + stats.ties;
  if (!total) return 0;
  return Math.round((stats.wins / total) * 100);
}

function getPlayerSide(room, playerId) {
  if (!playerId) return null;
  if (room.teams.batting.players.includes(playerId)) return "batting";
  if (room.teams.bowling.players.includes(playerId)) return "bowling";
  return null;
}

function phaseLabel(room) {
  if (room.phase === "innings-break") return "Innings break";
  if (room.phase === "finished") return "Match complete";
  if (room.superOver) return `Super Over - Innings ${room.inningsIndex + 1}`;
  return `Innings ${room.inningsIndex + 1}`;
}

createRoot(document.getElementById("root")).render(<App />);
