# CPL Cricket Game

Realtime hand-cricket web game with room-code matches, 12 vs 12 team setup, and playable Player vs Bot practice.

## Run Locally

```bash
npm install
npm run dev
```

Client: http://localhost:5173  
Server: http://localhost:4000  
Backend info: http://localhost:4000  
Health check: http://localhost:4000/health  
Server stats: http://localhost:4000/stats

The local client connects to `http://localhost:4000` on the same computer. If you open the Vite network URL from a phone or another device, the browser app automatically uses that same host on port `4000` for Socket.IO. Example: `http://192.168.1.20:5173` connects to `http://192.168.1.20:4000`.

For production, always set `VITE_SOCKET_URL` to the deployed backend URL.

## Deployment Preflight

Run this before uploading, and again after Railway gives you public URLs:

```bash
npm run build
npm run check:deploy
```

By default, the preflight checks:

- built frontend output in `dist/`
- backend `/health`
- backend `/stats`
- frontend app shell
- two-player Socket.IO flow: create room, join by code, toss choice, number reveal, scored ball
- team-room Socket.IO flow: private room create/join, side selection, captain selection, ready state

The script opens temporary test sockets and disconnects them when finished. After a successful check, `/stats` should return `socketClients: 0`, `singleRooms: 0`, and `teamRooms: 0`.

For deployed services, point the check at the live URLs:

```bash
CPL_BACKEND_URL=https://your-cpl-backend-domain CPL_FRONTEND_URL=https://your-cpl-frontend-domain npm run check:deploy
```

On Windows PowerShell:

```powershell
$env:CPL_BACKEND_URL="https://your-cpl-backend-domain"; $env:CPL_FRONTEND_URL="https://your-cpl-frontend-domain"; npm run check:deploy
```

Clear the temporary PowerShell values when you are done:

```powershell
Remove-Item Env:CPL_BACKEND_URL; Remove-Item Env:CPL_FRONTEND_URL
```

## Deploy Live

Recommended setup: **GitHub + Railway**.

- GitHub stores the source code.
- Railway hosts the Vite browser app.
- Railway hosts the long-running Node/Express Socket.IO server.

Vercel alone is not recommended for this project because CPL needs a persistent Socket.IO server.

## GitHub Upload Checklist

Upload these files and folders:

- `src/`
- `server/`
- `index.html`
- `package.json`
- `package-lock.json`
- `README.md`
- `.gitignore`
- `.env.example`
- `railway.backend.json`
- `railway.frontend.json`

Do not upload:

- `node_modules/`
- `dist/`
- `.env`

## Railway Backend Service

Create a Railway service from the GitHub repo for the Socket.IO backend.

Settings:

- Root directory: repo root
- Build command: `npm install`
- Start command: `npm run server`
- Health check path: `/health`
- Optional Railway config template: `railway.backend.json`

Environment variables:

```bash
FRONTEND_URL=https://your-cpl-frontend-domain
```

Railway sets `PORT` automatically. The server also supports local fallback port `4000`.

After deployment, Railway will give you a public backend URL. Use that URL for the frontend `VITE_SOCKET_URL`.

Open the backend URL directly in a browser to confirm it identifies itself as `cpl-socket-server` and lists `/health`, `/stats`, and `/socket.io/`.

## Railway Frontend Service

Create a second Railway service from the same GitHub repo for the browser app.

Settings:

- Root directory: repo root
- Build command: `npm install && npm run build`
- Start command: `npm run frontend`
- Health check path: `/health`
- Optional Railway config template: `railway.frontend.json`

Environment variables:

```bash
VITE_SOCKET_URL=https://your-cpl-backend-domain
```

Use `https://` in production. A deployed HTTPS frontend cannot connect to an insecure `http://` Socket.IO backend.

The frontend service serves the built `dist/` folder through `server/frontend.js`, so Railway can run it as a normal Node service on its assigned `PORT`.

After the frontend URL is generated, update the backend service:

```bash
FRONTEND_URL=https://your-cpl-frontend-domain
```

Then redeploy the backend.

### Using the Railway JSON Templates

Railway usually reads `railway.json` from the repo root. Because this project needs two services from the same repo, this repo includes two explicit templates instead:

- `railway.backend.json`
- `railway.frontend.json`

Use them as copy references when configuring each Railway service. If Railway asks for one root `railway.json`, copy the matching template into `railway.json` for that service/branch, or enter the listed commands manually in the Railway dashboard.

## Multi-Device Test Plan

1. For local testing, run `npm run dev` and open the Vite Network URL on phone, laptop, and another browser. For deployed testing, open the deployed frontend URL.
2. Create a Single Player room on device A.
3. Join the room code from device B.
4. Confirm toss choice, ball choices, reveals, innings break, chase, and result panel.
5. Test Multiplayer public and private room setup.
6. Test Player vs Bot on each device.
7. Open the backend health URL and confirm it returns:

```json
{ "ok": true, "service": "cpl-socket-server" }
```

8. Open `/stats` on the backend URL and confirm room/player counts change while devices connect.
9. Open the backend root URL and confirm it lists `health`, `stats`, and `socket`.
10. If multiplayer does not connect, check browser console for CORS or mixed-content errors.

## Environment Variables

Frontend:

- `VITE_SOCKET_URL`: public Socket.IO backend URL.

Backend:

- `FRONTEND_URL`: public frontend URL allowed by Socket.IO CORS.
- `PORT`: server port. Railway sets this automatically.

For multiple frontend domains, comma-separate `FRONTEND_URL`:

```bash
FRONTEND_URL=https://main-domain.com,https://preview-domain.com
```

## Current Modes

- Single Player: playable `1 vs 1` room-code match.
- Multiplayer: playable team setup with public random rooms and private room codes.
- Player vs Bot: playable local practice mode with bot difficulty, stats, and match flow.

## Visual System

- Direction: stadium broadcast game UI.
- Local assets live in `src/assets/`.
- CSS motion respects reduced-motion preferences.
- Every UI change should remain responsive for desktop, mobile, and touch devices.
