# CineSync - Real-Time Video Co-Watching Platform

**CineSync** is a real-time synchronized video watching application that allows two users to watch videos together with voice communication, powered by **Pusher Channels** and **React**.

---

## 📺 Features

### Video Synchronization
- **Lock & Key Handshake Protocol**: Ensures both clients are ready before play/seek actions
- **Drift Correction**: 
  - Micro-drifts (<300ms) ignored
  - Minor drifts (300ms-1.5s) corrected with playback rate adjustment
  - Major drifts (>1.5s) trigger hard seek
- **State Sync**: New users automatically receive current video URL, time, and playback state
- **URL Sharing**: Change video URL from settings, synced to all room members

### 3-Second Walkie-Talkie Voice Chat
- **Press & Hold**: Record voice messages up to 3 seconds
- **Continuous Recording**: Keep holding to send multiple 3-second chunks
- **Auto-Send**: Releases automatically after 3s or on button release
- **Audio Ducking**: Video volume drops to 20% during voice playback
- **Max Volume Playback**: Received voice plays at 100% volume

### Mobile Optimized UI
- **48px+ Touch Targets**: All buttons meet accessibility guidelines
- **Double-Tap Skip**: Tap left/right of video to skip ±10 seconds
- **Orientation Aware**: Header hides in landscape mode for fullscreen experience
- **Safe Area Support**: Notch-friendly padding on iOS devices
- **Touch Seek Bar**: 30px hit area with `touch-action: none`
- **Auto-Hiding Controls**: Controls hide after 3s, tap to reveal

---

## 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 16.1** | React framework with App Router |
| **React 19** | UI library |
| **TypeScript** | Type safety |
| **Tailwind CSS 4** | Styling |
| **Pusher Channels** | Real-time WebSocket communication |
| **react-player 2.16** | Video player supporting YouTube, Vimeo, MP4, etc. |

---

## 📁 Project Structure

```
cinesync/
├── src/
│   ├── app/
│   │   ├── api/pusher/auth/     # Pusher authentication endpoint
│   │   ├── room/[roomId]/       # Dynamic room page
│   │   ├── page.tsx             # Home page (room creation)
│   │   ├── layout.tsx           # Root layout
│   │   └── globals.css          # Global styles + mobile utils
│   │
│   ├── components/
│   │   ├── VideoPlayer.tsx      # Video player with touch controls
│   │   ├── ControlBar.tsx       # Bottom control bar + walkie-talkie
│   │   ├── RoomHeader.tsx       # Room info header
│   │   └── Sidebar.tsx          # (Unused) Side panel
│   │
│   ├── hooks/
│   │   ├── usePusher.ts         # Pusher connection & presence
│   │   ├── useSyncLogic.ts      # Video synchronization logic
│   │   ├── useWalkieTalkie.ts   # Voice recording & transmission
│   │   ├── useVoiceChat.ts      # (Legacy) WebRTC voice chat
│   │   └── useVoiceRecorder.ts  # (Legacy) Voice recorder
│   │
│   └── lib/
│       └── utils.ts             # Utility functions
│
├── .env.local                   # Environment variables (Pusher keys)
└── package.json                 # Dependencies
```

---

## 🔧 Setup

### 1. Prerequisites
- Node.js 18+
- Pusher account (free tier works)

### 2. Pusher Configuration
1. Create app at [dashboard.pusher.com](https://dashboard.pusher.com)
2. Enable **Client Events** in App Settings
3. Copy credentials to `.env.local`:

```env
NEXT_PUBLIC_PUSHER_KEY=your_key
NEXT_PUBLIC_PUSHER_CLUSTER=your_cluster
PUSHER_APP_ID=your_app_id
PUSHER_SECRET=your_secret
```

### 3. Install & Run
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📡 Event Protocol

### Sync Events (Pusher Client Events)
| Event | Purpose |
|-------|---------|
| `client-sync-request` | Request play/seek with timestamp |
| `client-sync-ack` | Acknowledge sync readiness |
| `client-sync-go` | Execute synchronized playback |
| `client-pause` | Pause notification |
| `client-url` | URL change broadcast |
| `client-state-request` | New user requests state |
| `client-state-response` | Existing user shares state |
| `client-time-check` | Periodic drift check |
| `client-audio` | Voice message (base64 encoded) |

---

## ⚡ Performance Optimizations

### Video Sync
- Debounced event handlers (200ms)
- Sync lock prevents race conditions
- ReadyState-aware sync (waits for buffering)

### Voice Chat
- 24kbps bitrate keeps audio under 10KB
- 1-second cooldown between sends (rate limiting)
- Mic stream reused for continuous recording

### Mobile
- `playsInline` for iOS compatibility
- `touch-manipulation` CSS for instant response
- `-webkit-tap-highlight-color: transparent`

---

## 🐛 Known Limitations

1. **Pusher 10KB Limit**: Voice messages limited to ~3 seconds
2. **Rate Limiting**: May see warnings when sending rapidly
3. **YouTube**: Some control limitations due to iframe restrictions
4. **iOS Safari**: First play requires user interaction (audio unlock)

---

## 📝 Usage

1. **Create Room**: Click "Create Room" on home page
2. **Share Link**: Copy room URL and send to friend
3. **Load Video**: Click settings (⚙️) and paste video URL
4. **Watch Together**: Play/pause/seek syncs automatically
5. **Voice Chat**: Hold mic button to talk (3-second messages)

---

## 📄 License

MIT License - For educational and personal use.

---

*Built with ❤️ for synchronized movie nights*
