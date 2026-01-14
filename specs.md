This specification document is designed for an AI coding agent to build a **Real-Time Co-Streaming & Voice-Chat Application**. It focuses on the MVP (Minimum Viable Product) using URL-based video sources.

---

# Project Specification: "CineSync" Co-Streaming Platform

## 1. Project Overview

**CineSync** is a web-based application that allows two users in different locations to watch a video simultaneously. The app must synchronize playback states (play, pause, seek) and provide a "Push-to-Talk" or "Always-on" voice communication layer.

---

## 2. Technical Stack

* **Frontend:** Next.js.
* **Styling:** Tailwind CSS.
* **Real-time Sync:** Socket.io (Client & Server).
* **Voice Communication:** WebRTC (via `simple-peer`).
* **Video Player:** `video-react` or `ReactPlayer` (capable of handling raw MP4 URLs and HLS).

---

## 3. Core Features & Functional Requirements

### A. Room Management

* Users can "Create a Room" which generates a unique UUID-based URL.
* The second user joins via the unique link.
* Maximum capacity per room: 2 users (for MVP).

### B. Video Synchronization Logic

* **Source Input:** A text input field where a user pastes a direct video URL (MP4/WebM/HLS).
* **State Sync:**
* If User A clicks **Play**, User B’s player must play.
* If User A clicks **Pause**, User B’s player must pause.
* If User A **Seeks** (changes time), User B’s player must jump to the exact timestamp.


* **Latency Correction:** Implement a threshold (e.g., 1.5 seconds). If User B is more than 1.5s ahead/behind User A, force-sync User B to User A’s timestamp.

### C. "Movie Talkie" (Voice Chat)

* Integrate WebRTC to establish a peer-to-peer audio connection.
* **Toggle Modes:** * **Always On:** Continuous voice stream.
* **Push-to-Talk:** Audio only transmits while a specific key (e.g., Spacebar) is held.


* **Volume Mixing:** The UI must have separate sliders for "Movie Volume" and "Friend Volume."

---

## 4. System Architecture

1. **Signaling Server (Node.js/Socket.io):** Handles the initial handshake between peers and broadcasts video playback events.
2. **Client Application:** * Listens to local video player events.
* Emits socket events to the server.
* Receives socket events and updates the local player state without triggering an infinite loop of emits.



---

## 5. Implementation Instructions for the AI Agent

### Step 1: Socket.io Event Schema

The agent must implement the following event listeners:

* `join-room`: Initializes the session.
* `video-toggle`: Sends `{ playing: boolean, timestamp: number }`.
* `video-seek`: Sends `{ timestamp: number }`.
* `signal`: For WebRTC peer-to-peer handshake.

### Step 2: Prevention of "Feedback Loops"

**Crucial:** The agent must ensure that when the player state is updated programmatically (via a socket event), it does not trigger a *new* socket event, which would cause an endless loop of play/pause commands.

### Step 3: UI Layout

* **Left/Center Column:** Large video player.
* **Right Sidebar:** * Connection status indicator.
* Audio controls (Mic toggle, Volume sliders).
* Shared URL input field.



---

## 6. Success Metrics for the Build

1. Video starts/stops on both screens within 200ms of the command.
2. Audio is clear with no echo (implement `echoCancellation: true` in `getUserMedia`).
3. Refreshing the page allows the user to rejoin the same room and resync to the current timestamp.

---

**Would you like me to generate the initial `server.js` (Node/Socket.io) and `App.js` (React) boilerplate code based on this spec to get the agent started?**