"use client"
import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { io, Socket } from "socket.io-client"
import { IconMic, IconMicOff, IconCamera, IconCameraOff, IconMonitor, IconHand, IconMessage, IconVideo, IconUser, IconUsers, IconShield, IconX, IconPhoneOff, IconCheck } from "@/components/ui/Icons"

// Production sets NEXT_PUBLIC_SIGNAL_URL to an https:// endpoint; dev falls back to localhost.
const SIGNAL_URL = process.env.NEXT_PUBLIC_SIGNAL_URL
  || (typeof window !== "undefined" && window.location.protocol === "https:"
    ? `https://${window.location.host.replace(/:\d+$/, "")}:3002`
    : "http://localhost:3002")
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
]

interface Peer {
  socketId: string
  userId: string
  name: string
  role: string
  stream?: MediaStream
  pc?: RTCPeerConnection
}

const SPEAK_THRESHOLD = 14 // measured mic energy (0-255) above room noise

export default function InterviewRoom() {
  const params = useParams()
  const router = useRouter()
  const code = params.code as string
  const [interview, setInterview] = useState<any>(null)
  const [me, setMe] = useState<any>(null)
  const [peers, setPeers] = useState<Peer[]>([])
  const [localStream, setLocalStream] = useState<MediaStream|null>(null)
  const [screenStream, setScreenStream] = useState<MediaStream|null>(null)
  const [audioOn, setAudioOn] = useState(true)
  const [videoOn, setVideoOn] = useState(true)
  const [screenSharing, setScreenSharing] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [chatInput, setChatInput] = useState("")
  const [panel, setPanel] = useState<"chat" | "people" | null>(null)
  const [unread, setUnread] = useState(0)
  const [levels, setLevels] = useState<Record<string, number>>({})
  const [quality, setQuality] = useState<Record<string, "good" | "fair" | "poor">>({})
  const [pinned, setPinned] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)
  const [roomCount, setRoomCount] = useState(0)
  const [duration, setDuration] = useState(0)
  const socketRef = useRef<Socket|null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const peerStreams = useRef<Map<string,HTMLVideoElement|null>>(new Map())
  const peerConnections = useRef<Map<string,RTCPeerConnection>>(new Map())
  const timerRef = useRef<any>(null)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then(r=>r.json()),
      fetch(`/api/interviews/${code}`).then(r=>r.json()),
    ]).then(([meData, intData]) => {
      setMe(meData.user)
      setInterview(intData.interview)
    })
    return () => {
      leaveRoom()
      clearInterval(timerRef.current)
    }
  }, [code])

  async function joinRoom() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true })
      setLocalStream(stream)
      if (localVideoRef.current) localVideoRef.current.srcObject = stream

      const socket = io(SIGNAL_URL)
      socketRef.current = socket

      socket.on("connect", () => {
        socket.emit("join-room", { roomCode:code, userId:me.id, name:me.name, role:"PARTICIPANT" })
      })

      socket.on("existing-peers", async (existingPeers: Peer[]) => {
        for (const peer of existingPeers) {
          const pc = createPeerConnection(peer.socketId, stream)
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          socket.emit("offer", { to:peer.socketId, offer })
          setPeers(prev => [...prev.filter(p=>p.socketId!==peer.socketId), { ...peer, pc }])
        }
      })

      socket.on("peer-joined", async (peer: Peer) => {
        const pc = createPeerConnection(peer.socketId, stream)
        setPeers(prev => [...prev.filter(p=>p.socketId!==peer.socketId), { ...peer, pc }])
      })

      socket.on("offer", async ({ from, offer }) => {
        const pc = createPeerConnection(from, stream)
        await pc.setRemoteDescription(offer)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit("answer", { to:from, answer })
      })

      socket.on("answer", async ({ from, answer }) => {
        const pc = peerConnections.current.get(from)
        if (pc) await pc.setRemoteDescription(answer)
      })

      socket.on("ice-candidate", async ({ from, candidate }) => {
        const pc = peerConnections.current.get(from)
        if (pc && candidate) await pc.addIceCandidate(candidate)
      })

      socket.on("peer-left", ({ socketId }) => {
        peerConnections.current.get(socketId)?.close()
        peerConnections.current.delete(socketId)
        setPeers(prev => prev.filter(p => p.socketId !== socketId))
      })

      socket.on("room-count", (count: number) => setRoomCount(count))
      socket.on("room-message", (msg: any) => setMessages(prev => [...prev, msg]))
      socket.on("raise-hand", ({ user }) => {
        setMessages(prev => [...prev, { system:true, message:`${user?.name} raised their hand`, timestamp:new Date().toISOString() }])
      })
      socket.on("screen-share-start", ({ user }) => {
        setMessages(prev => [...prev, { system:true, message:`${user?.name} started screen sharing`, timestamp:new Date().toISOString() }])
      })

      setJoined(true)
      timerRef.current = setInterval(() => setDuration(d => d+1), 1000)
    } catch (err: any) {
      alert("Could not access camera/microphone: " + err.message)
    }
  }

  function createPeerConnection(socketId: string, stream: MediaStream): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    peerConnections.current.set(socketId, pc)

    stream.getTracks().forEach(track => pc.addTrack(track, stream))

    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current?.emit("ice-candidate", { to:socketId, candidate:e.candidate })
    }

    pc.ontrack = (e) => {
      const remoteStream = e.streams[0]
      setPeers(prev => prev.map(p => p.socketId === socketId ? { ...p, stream:remoteStream } : p))
      setTimeout(() => {
        const videoEl = peerStreams.current.get(socketId)
        if (videoEl) videoEl.srcObject = remoteStream
      }, 100)
    }

    return pc
  }

  function leaveRoom() {
    localStream?.getTracks().forEach(t => t.stop())
    screenStream?.getTracks().forEach(t => t.stop())
    peerConnections.current.forEach(pc => pc.close())
    socketRef.current?.disconnect()
  }

  function toggleAudio() {
    localStream?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setAudioOn(prev => !prev)
  }

  function toggleVideo() {
    localStream?.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setVideoOn(prev => !prev)
  }

  async function toggleScreen() {
    if (screenSharing) {
      screenStream?.getTracks().forEach(t => t.stop())
      setScreenStream(null)
      setScreenSharing(false)
      socketRef.current?.emit("screen-share-stop", { roomCode:code })
      if (localStream) {
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video")
          const camTrack = localStream.getVideoTracks()[0]
          if (sender && camTrack) sender.replaceTrack(camTrack)
        })
      }
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video:true, audio:true })
        setScreenStream(screen)
        setScreenSharing(true)
        socketRef.current?.emit("screen-share-start", { roomCode:code })
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === "video")
          if (sender) sender.replaceTrack(screen.getVideoTracks()[0])
        })
        screen.getVideoTracks()[0].onended = () => toggleScreen()
      } catch {}
    }
  }

  function sendChat() {
    if (!chatInput.trim()) return
    socketRef.current?.emit("room-message", { roomCode:code, message:chatInput.trim() })
    setChatInput("")
  }

  function raiseHand() {
    socketRef.current?.emit("raise-hand", { roomCode:code })
    setHandRaised(prev => !prev)
  }

  function endCall() {
    leaveRoom()
    router.push("/interviews")
  }

  const formatTime = (s: number) => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`

  /* Speaking detection — Web Audio analyser per stream. A measured signal, not a
     decorative animation: the ring only reacts when that mic is genuinely above
     the room noise floor. Entirely client-side. */
  useEffect(() => {
    if (!joined) return
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AC) return
    const ctx: AudioContext = new AC()
    // Buffer must be ArrayBuffer-backed for getByteFrequencyData's type signature.
    const nodes: { id: string; an: AnalyserNode; src: MediaStreamAudioSourceNode; buf: Uint8Array<ArrayBuffer> }[] = []
    const add = (id: string, stream: MediaStream | null | undefined) => {
      if (!stream || !stream.getAudioTracks().length) return
      try {
        const src = ctx.createMediaStreamSource(stream)
        const an = ctx.createAnalyser()
        an.fftSize = 512; an.smoothingTimeConstant = .75
        src.connect(an)
        nodes.push({ id, an, src, buf: new Uint8Array(new ArrayBuffer(an.frequencyBinCount)) })
      } catch {}
    }
    add("local", localStream)
    peers.forEach(p => add(p.socketId, p.stream))
    let raf = 0
    const tick = () => {
      const next: Record<string, number> = {}
      for (const n of nodes) {
        n.an.getByteFrequencyData(n.buf)
        let sum = 0
        for (let i = 0; i < n.buf.length; i++) sum += n.buf[i]
        next[n.id] = sum / n.buf.length
      }
      setLevels(next)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); nodes.forEach(n => { try { n.src.disconnect() } catch {} }); ctx.close().catch(() => {}) }
  }, [joined, localStream, peers])

  /* Connection quality read from the real peer connection, not guessed. */
  useEffect(() => {
    if (!joined) return
    const t = setInterval(async () => {
      const out: Record<string, "good" | "fair" | "poor"> = {}
      for (const [id, pc] of peerConnections.current) {
        try {
          const stats = await pc.getStats()
          let loss = 0, packets = 0, rtt = 0
          stats.forEach((r: any) => {
            if (r.type === "inbound-rtp" && r.kind === "video") { loss += r.packetsLost || 0; packets += r.packetsReceived || 0 }
            if (r.type === "candidate-pair" && r.state === "succeeded" && r.currentRoundTripTime) rtt = r.currentRoundTripTime
          })
          const pct = packets ? loss / (loss + packets) : 0
          out[id] = pct > .05 || rtt > .4 ? "poor" : pct > .02 || rtt > .2 ? "fair" : "good"
        } catch {}
      }
      setQuality(out)
    }, 3000)
    return () => clearInterval(t)
  }, [joined])

  /* Keyboard shortcuts, ignored while typing. */
  useEffect(() => {
    if (!joined) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return
      const k = e.key.toLowerCase()
      if (k === "m") { e.preventDefault(); toggleAudio() }
      else if (k === "v") { e.preventDefault(); toggleVideo() }
      else if (k === "s") { e.preventDefault(); toggleScreen() }
      else if (k === "h") { e.preventDefault(); raiseHand() }
      else if (k === "c") { e.preventDefault(); setPanel(p => p === "chat" ? null : "chat") }
      else if (k === "p") { e.preventDefault(); setPanel(p => p === "people" ? null : "people") }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [joined]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (panel === "chat") { setUnread(0); chatEndRef.current?.scrollIntoView({ behavior: "smooth" }) }
    else if (messages.length) setUnread(u => u + 1)
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!interview || !me) return <div className="mLoad">Loading room…</div>

  /* ─────────────────────────── LOBBY ─────────────────────────── */
  if (!joined) return (
    <div className="mRoot mLobby">
      <div className="mLobbyCard">
        <div className="mLobbyIcon"><IconVideo size={26} /></div>
        <h1 className="mLobbyTitle">{interview.title}</h1>
        <p className="mLobbySub">{String(interview.type||"").replace(/_/g," ").toLowerCase()} · hosted by {interview.host?.name}</p>
        <dl className="mLobbyInfo">
          <div><dt>Room</dt><dd className="mMono">{code}</dd></div>
          <div><dt>Scheduled</dt><dd>{new Date(interview.scheduledAt).toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"})}</dd></div>
          <div><dt>Duration</dt><dd>{interview.duration} min</dd></div>
        </dl>
        {interview.notes && <p className="mLobbyNotes">{interview.notes}</p>}
        <button onClick={joinRoom} className="mJoin">Join now</button>
        <button onClick={() => router.push("/interviews")} className="mBack">Back to interviews</button>
        <p className="mLobbyFine"><IconShield size={12} /> Peer-to-peer and encrypted in transit. Your camera starts only after you join.</p>
      </div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  )

  const tiles = [
    { id:"local", name:me.name, stream:localStream, isLocal:true, muted:!audioOn, camOff:!videoOn, hand:handRaised },
    ...peers.filter(p=>p.stream).map(p=>({ id:p.socketId, name:p.name, stream:p.stream, isLocal:false, muted:false, camOff:false, hand:false }))
  ]
  const focus = pinned && tiles.find(t => t.id === pinned) ? pinned : (screenSharing ? "local" : null)
  const cols = tiles.length <= 1 ? 1 : tiles.length <= 4 ? 2 : tiles.length <= 9 ? 3 : 4

  const Tile = ({ t, big }: any) => {
    const speaking = (levels[t.id] || 0) > SPEAK_THRESHOLD && !t.muted
    const q = t.isLocal ? "good" : (quality[t.id] || "good")
    return (
      <div className={"mTile" + (speaking ? " speaking" : "") + (big ? " big" : "")} onDoubleClick={() => setPinned(pinned === t.id ? null : t.id)}>
        <video
          ref={el => {
            if (!el) return
            if (t.isLocal) localVideoRef.current = el
            else peerStreams.current.set(t.id, el)
            if (el.srcObject !== t.stream) el.srcObject = t.stream ?? null
          }}
          autoPlay playsInline muted={t.isLocal} className="mVideo"
        />
        {t.camOff && <div className="mCamOff"><span className="mAvatar">{(t.name||"?").slice(0,2).toUpperCase()}</span></div>}
        <div className="mTileTop">
          {t.hand && <span className="mBadge amber"><IconHand size={11} /> Hand up</span>}
          {t.isLocal && screenSharing && <span className="mBadge"><IconMonitor size={11} /> Sharing</span>}
          {pinned === t.id && <span className="mBadge">Pinned</span>}
        </div>
        <div className="mTileBot">
          <span className="mName">
            {t.muted ? <IconMicOff size={12} /> : <IconMic size={12} />}
            {t.name}{t.isLocal ? " (You)" : ""}
          </span>
          <span className={"mQ " + q} title={`Connection ${q}`}><i /><i /><i /></span>
        </div>
      </div>
    )
  }

  /* ─────────────────────────── ROOM ─────────────────────────── */
  return (
    <div className="mRoot">
      <header className="mBar">
        <div className="mBarL">
          <span className="mDot" /> <b>{interview.title}</b>
          <span className="mSep">·</span>
          <span className="mMono">{formatTime(duration)}</span>
        </div>
        <div className="mBarR">
          <span className="mChip"><IconShield size={12} /> Encrypted</span>
          <span className="mChip"><IconUsers size={12} /> {Math.max(roomCount, tiles.length)}</span>
          <span className="mChip mMono">{code}</span>
        </div>
      </header>

      <main className={"mStage" + (panel ? " withPanel" : "")}>
        <div className={"mGrid" + (focus ? " focused" : "")} style={focus ? undefined : { gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {focus ? (
            <>
              <div className="mFocus"><Tile t={tiles.find(t => t.id === focus)} big /></div>
              <div className="mStrip">{tiles.filter(t => t.id !== focus).map(t => <Tile key={t.id} t={t} />)}</div>
            </>
          ) : tiles.map(t => <Tile key={t.id} t={t} />)}
        </div>

        {tiles.length === 1 && (
          <div className="mWait">
            <IconUsers size={22} />
            <p>Waiting for others to join</p>
            <span>Share the room code <b className="mMono">{code}</b></span>
          </div>
        )}

        {panel && (
          <aside className="mPanel">
            <div className="mPanelTabs">
              <button className={panel === "chat" ? "on" : ""} onClick={() => setPanel("chat")}>Chat</button>
              <button className={panel === "people" ? "on" : ""} onClick={() => setPanel("people")}>People ({tiles.length})</button>
              <button className="mPanelX" onClick={() => setPanel(null)} aria-label="Close panel"><IconX size={15} /></button>
            </div>

            {panel === "chat" ? (
              <>
                <div className="mMsgs">
                  {messages.length === 0 && <p className="mEmpty">No messages yet.</p>}
                  {messages.map((m, i) => m.system ? (
                    <p key={i} className="mSys">{m.message}</p>
                  ) : (
                    <div key={i} className="mMsg">
                      <span className="mMsgWho">{m.user?.name || m.name || "Someone"}</span>
                      <span className="mMsgTxt">{m.message}</span>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form className="mCompose" onSubmit={e => { e.preventDefault(); sendChat() }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Message everyone…" />
                  <button type="submit" disabled={!chatInput.trim()}>Send</button>
                </form>
              </>
            ) : (
              <div className="mPeople">
                {tiles.map(t => (
                  <div key={t.id} className="mPerson">
                    <span className="mAvatarSm">{(t.name||"?").slice(0,2).toUpperCase()}</span>
                    <span className="mPersonName">{t.name}{t.isLocal ? " (You)" : ""}</span>
                    {(levels[t.id] || 0) > SPEAK_THRESHOLD && !t.muted && <span className="mBadge">Speaking</span>}
                    {t.muted ? <IconMicOff size={14} /> : <IconMic size={14} />}
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </main>

      <div className="mDock">
        <button onClick={toggleAudio} className={"mCtl" + (audioOn ? "" : " danger")} data-tip={`${audioOn ? "Mute" : "Unmute"} · M`}>
          {audioOn ? <IconMic size={18} /> : <IconMicOff size={18} />}
        </button>
        <button onClick={toggleVideo} className={"mCtl" + (videoOn ? "" : " danger")} data-tip={`${videoOn ? "Stop video" : "Start video"} · V`}>
          {videoOn ? <IconCamera size={18} /> : <IconCameraOff size={18} />}
        </button>
        <button onClick={toggleScreen} className={"mCtl" + (screenSharing ? " on" : "")} data-tip="Share screen · S">
          <IconMonitor size={18} />
        </button>
        <button onClick={raiseHand} className={"mCtl" + (handRaised ? " on" : "")} data-tip="Raise hand · H">
          <IconHand size={18} />
        </button>
        <button onClick={() => setPanel(p => p === "chat" ? null : "chat")} className={"mCtl" + (panel === "chat" ? " on" : "")} data-tip="Chat · C">
          <IconMessage size={18} />
          {unread > 0 && panel !== "chat" && <span className="mUnread">{unread > 9 ? "9+" : unread}</span>}
        </button>
        <button onClick={() => setPanel(p => p === "people" ? null : "people")} className={"mCtl" + (panel === "people" ? " on" : "")} data-tip="People · P">
          <IconUsers size={18} />
        </button>
        <span className="mDockSep" />
        <button onClick={endCall} className="mLeave" data-tip="Leave"><IconPhoneOff size={17} /> <span>Leave</span></button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  )
}

const CSS = `
.mRoot{--bg:#0B0F14;--surface:#141A21;--surface2:#1B222B;--line:rgba(255,255,255,.09);
 --ink:#E8EDF2;--ink2:#93A1B0;--ink3:#64717F;--g:#12B76A;--brand:#0D7A5F;--danger:#F04438;--amber:#F79009;
 --e:cubic-bezier(.22,1,.36,1);
 position:fixed;inset:0;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;
 font-family:var(--font-inter),Inter,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}
.mRoot *{box-sizing:border-box}
.mMono{font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
.mLoad{position:fixed;inset:0;display:grid;place-items:center;background:#0B0F14;color:#93A1B0;font-family:Inter,sans-serif}

/* top bar */
.mBar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;border-bottom:1px solid var(--line);background:rgba(20,26,33,.7);backdrop-filter:blur(14px) saturate(160%);flex-wrap:nowrap}
.mBarL{display:flex;align-items:center;gap:9px;font-size:14px;min-width:0;overflow:hidden;white-space:nowrap}
.mBarL b{font-weight:600;overflow:hidden;text-overflow:ellipsis}
.mSep{color:var(--ink3)}
.mDot{width:8px;height:8px;border-radius:50%;background:var(--danger);box-shadow:0 0 0 4px rgba(240,68,56,.16);flex-shrink:0;animation:mPulse 2s infinite}
.mBarR{display:flex;align-items:center;gap:8px;flex-shrink:0}
.mChip{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--ink2);background:var(--surface2);border:1px solid var(--line);padding:5px 10px;border-radius:999px}

/* stage */
.mStage{flex:1;display:flex;gap:14px;padding:14px;min-height:0;position:relative}
.mGrid{flex:1;display:grid;gap:12px;min-height:0}
.mGrid.focused{display:grid;grid-template-rows:1fr auto}
.mFocus{min-height:0}
.mStrip{display:flex;gap:10px;overflow-x:auto;padding-top:10px}
.mStrip .mTile{width:190px;flex:0 0 190px;aspect-ratio:16/10}

/* tiles */
.mTile{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden;min-height:0;
 box-shadow:0 1px 2px rgba(0,0,0,.3);transition:box-shadow .2s var(--e),transform .2s var(--e)}
.mTile.big{height:100%}
.mTile.speaking{box-shadow:0 0 0 2px var(--g),0 8px 30px rgba(18,183,106,.18)}
.mVideo{width:100%;height:100%;object-fit:cover;display:block;background:#0E141A}
.mCamOff{position:absolute;inset:0;display:grid;place-items:center;background:var(--surface)}
.mAvatar{width:66px;height:66px;border-radius:50%;background:var(--surface2);color:var(--ink2);display:grid;place-items:center;font-size:20px;font-weight:600}
.mTileTop{position:absolute;top:10px;left:10px;display:flex;gap:6px;flex-wrap:wrap}
.mTileBot{position:absolute;left:10px;right:10px;bottom:10px;display:flex;align-items:center;justify-content:space-between;gap:8px}
.mName{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:500;background:rgba(11,15,20,.66);backdrop-filter:blur(6px);padding:5px 10px;border-radius:8px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mBadge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;background:rgba(11,15,20,.66);backdrop-filter:blur(6px);padding:4px 9px;border-radius:999px;color:var(--ink)}
.mBadge.amber{color:#FEC84B}
.mQ{display:inline-flex;align-items:flex-end;gap:2px;height:12px;background:rgba(11,15,20,.66);padding:4px 6px;border-radius:6px}
.mQ i{width:3px;background:var(--ink3);border-radius:1px}
.mQ i:nth-child(1){height:4px}.mQ i:nth-child(2){height:7px}.mQ i:nth-child(3){height:10px}
.mQ.good i{background:var(--g)}
.mQ.fair i:nth-child(1),.mQ.fair i:nth-child(2){background:var(--amber)}
.mQ.poor i:nth-child(1){background:var(--danger)}

/* waiting */
.mWait{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:var(--ink3);pointer-events:none}
.mWait p{font-size:15px;color:var(--ink2);margin:4px 0 0}
.mWait span{font-size:13px}

/* panel */
.mPanel{width:330px;flex:0 0 330px;background:var(--surface);border:1px solid var(--line);border-radius:18px;display:flex;flex-direction:column;overflow:hidden}
.mPanelTabs{display:flex;align-items:center;gap:4px;padding:8px;border-bottom:1px solid var(--line)}
.mPanelTabs button{flex:1;padding:8px;border:none;background:none;color:var(--ink2);font:inherit;font-size:13px;font-weight:600;border-radius:9px;cursor:pointer;transition:background .15s,color .15s}
.mPanelTabs button.on{background:var(--surface2);color:var(--ink)}
.mPanelX{flex:0 0 34px!important;color:var(--ink3)!important}
.mMsgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
.mEmpty{color:var(--ink3);font-size:13px;text-align:center;margin-top:20px}
.mSys{font-size:12px;color:var(--ink3);text-align:center;margin:0}
.mMsg{display:flex;flex-direction:column;gap:2px}
.mMsgWho{font-size:11.5px;font-weight:600;color:var(--ink2)}
.mMsgTxt{font-size:13.5px;line-height:1.5;background:var(--surface2);padding:8px 11px;border-radius:12px;word-break:break-word}
.mCompose{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line)}
.mCompose input{flex:1;background:var(--surface2);border:1px solid var(--line);border-radius:11px;padding:10px 12px;color:var(--ink);font:inherit;font-size:13.5px;outline:none;min-width:0}
.mCompose input:focus{border-color:var(--brand)}
.mCompose button{background:var(--brand);color:#fff;border:none;border-radius:11px;padding:0 15px;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.mCompose button:disabled{opacity:.4;cursor:not-allowed}
.mPeople{flex:1;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:4px}
.mPerson{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:11px;font-size:13.5px}
.mPerson:hover{background:var(--surface2)}
.mPersonName{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mAvatarSm{width:30px;height:30px;border-radius:50%;background:var(--surface2);display:grid;place-items:center;font-size:11.5px;font-weight:600;color:var(--ink2);flex-shrink:0}

/* dock */
.mDock{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;margin:0 14px 14px;background:rgba(27,34,43,.82);backdrop-filter:blur(18px) saturate(160%);border:1px solid var(--line);border-radius:999px;align-self:center;box-shadow:0 10px 40px rgba(0,0,0,.4)}
.mCtl{position:relative;width:46px;height:46px;border-radius:50%;border:1px solid var(--line);background:var(--surface2);color:var(--ink);display:grid;place-items:center;cursor:pointer;transition:background .15s var(--e),transform .12s var(--e),color .15s}
.mCtl:hover{background:#232C36;transform:translateY(-2px)}
.mCtl:active{transform:scale(.94)}
.mCtl.on{background:var(--brand);border-color:transparent;color:#fff}
.mCtl.danger{background:var(--danger);border-color:transparent;color:#fff}
.mCtl::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);white-space:nowrap;font-size:11.5px;background:#000;color:#fff;padding:5px 9px;border-radius:7px;opacity:0;pointer-events:none;transition:opacity .15s}
.mCtl:hover::after{opacity:.92}
.mUnread{position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:var(--danger);color:#fff;font-size:10.5px;font-weight:700;display:grid;place-items:center}
.mDockSep{width:1px;height:26px;background:var(--line);margin:0 4px}
.mLeave{display:inline-flex;align-items:center;gap:8px;height:46px;padding:0 20px;border-radius:999px;border:none;background:var(--danger);color:#fff;font:inherit;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s,transform .12s var(--e)}
.mLeave:hover{background:#D92D20}
.mLeave:active{transform:scale(.96)}

/* lobby */
.mLobby{display:grid;place-items:center;padding:20px;overflow-y:auto}
.mLobbyCard{width:100%;max-width:430px;background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:30px;text-align:center}
.mLobbyIcon{width:52px;height:52px;border-radius:15px;background:rgba(13,122,95,.16);color:#34D399;display:grid;place-items:center;margin:0 auto 16px}
.mLobbyTitle{font-size:22px;font-weight:600;margin:0;letter-spacing:-.02em}
.mLobbySub{font-size:13.5px;color:var(--ink2);margin:6px 0 20px;text-transform:capitalize}
.mLobbyInfo{display:flex;flex-direction:column;gap:2px;margin:0 0 16px;text-align:left}
.mLobbyInfo>div{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line);font-size:13.5px}
.mLobbyInfo dt{color:var(--ink3);margin:0}
.mLobbyInfo dd{margin:0;font-weight:500}
.mLobbyNotes{font-size:13px;color:var(--ink2);background:var(--surface2);padding:11px 13px;border-radius:12px;text-align:left;line-height:1.55}
.mJoin{width:100%;margin-top:6px;padding:14px;border:none;border-radius:14px;background:var(--brand);color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer;transition:background .15s,transform .12s var(--e)}
.mJoin:hover{background:#0B6C54}
.mJoin:active{transform:scale(.98)}
.mBack{width:100%;margin-top:8px;padding:12px;border:1px solid var(--line);border-radius:14px;background:none;color:var(--ink2);font:inherit;font-size:14px;cursor:pointer}
.mLobbyFine{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--ink3);margin:16px 0 0;line-height:1.5}

@keyframes mPulse{0%,100%{opacity:1}50%{opacity:.45}}

/* responsive */
@media (max-width:900px){
  .mStage{flex-direction:column;padding:10px;gap:10px}
  .mPanel{width:auto;flex:1 1 auto;max-height:46vh}
  .mStage.withPanel .mGrid{flex:0 0 42vh}
  .mBarL b{max-width:34vw}
  .mChip:not(.mMono){display:none}
}
@media (max-width:640px){
  .mDock{gap:6px;padding:9px;margin:0 8px 8px}
  .mCtl{width:42px;height:42px}
  .mLeave{padding:0 14px;height:42px}
  .mLeave span{display:none}
  .mGrid{grid-template-columns:1fr!important}
  .mStrip .mTile{width:132px;flex:0 0 132px}
}
@media (prefers-reduced-motion:reduce){.mRoot *{animation:none!important;transition:none!important}}
`
