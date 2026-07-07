"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { io, Socket } from "socket.io-client"
import { IconMic, IconMicOff, IconCamera, IconCameraOff, IconMonitor, IconHand, IconMessage, IconVideo, IconUser, IconUsers } from "@/components/ui/Icons"

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
  const [showChat, setShowChat] = useState(false)
  const [joined, setJoined] = useState(false)
  const [roomCount, setRoomCount] = useState(0)
  const [duration, setDuration] = useState(0)
  const socketRef = useRef<Socket|null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const peerStreams = useRef<Map<string,HTMLVideoElement|null>>(new Map())
  const peerConnections = useRef<Map<string,RTCPeerConnection>>(new Map())
  const timerRef = useRef<any>(null)

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

      socket.on("peer-left", ({ socketId, user }) => {
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
      // Revert to camera
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
        // Replace video track for all peers
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

  if (!interview || !me) return <div style={S.loading}>Loading interview room...</div>

  if (!joined) return (
    <div style={S.lobby}>
      <div style={S.lobbyCard}>
        <div style={S.lobbyIcon}><IconVideo size={34} /></div>
        <h1 style={S.lobbyTitle}>{interview.title}</h1>
        <p style={S.lobbySub}>{interview.type.replace("_"," ")} · {interview.participants?.length} participant{interview.participants?.length!==1?"s":""}</p>
        <div style={S.lobbyInfo}>
          <div style={S.lobbyRow}><span style={S.lobbyLabel}>Room code</span><span style={S.lobbyCode}>{code}</span></div>
          <div style={S.lobbyRow}><span style={S.lobbyLabel}>Scheduled</span><span style={S.lobbyVal}>{new Date(interview.scheduledAt).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"})}</span></div>
          <div style={S.lobbyRow}><span style={S.lobbyLabel}>Duration</span><span style={S.lobbyVal}>{interview.duration} minutes</span></div>
          <div style={S.lobbyRow}><span style={S.lobbyLabel}>Host</span><span style={S.lobbyVal}>{interview.host?.name}</span></div>
        </div>
        {interview.notes && <div style={S.lobbyNotes}>{interview.notes}</div>}
        <button onClick={joinRoom} style={S.joinBtn}>Join interview</button>
        <button onClick={() => router.push("/interviews")} style={S.backBtn}>Back</button>
      </div>
    </div>
  )

  const allVideos = [
    { socketId:"local", name:me.name, stream:localStream, isLocal:true },
    ...peers.filter(p=>p.stream).map(p=>({ socketId:p.socketId, name:p.name, stream:p.stream, isLocal:false }))
  ]

  return (
    <div style={S.room}>
      {/* Header */}
      <div style={S.roomHead}>
        <div style={S.roomTitle}>{interview.title}</div>
        <div style={S.roomMeta}>
          <span style={S.timer}>{formatTime(duration)}</span>
          <span style={S.pCount}>{roomCount} in room</span>
        </div>
        <div style={S.roomCode}>Room: {code}</div>
      </div>

      {/* Video grid */}
      <div style={S.videoGrid}>
        {allVideos.map(v => (
          <div key={v.socketId} style={S.videoTile}>
            <video
              ref={el => {
                if (!el) return
                if (v.isLocal) localVideoRef.current = el
                else peerStreams.current.set(v.socketId, el)
                if (el.srcObject !== v.stream) el.srcObject = v.stream ?? null
              }}
              autoPlay playsInline muted={v.isLocal}
              style={S.videoEl}
            />
            <div style={S.videoLabel}>{v.name}{v.isLocal?" (You)":""}</div>
            {!videoOn && v.isLocal && <div style={S.videoOff}><span style={{color:"rgba(255,255,255,.5)"}}><IconUser size={32} /></span></div>}
          </div>
        ))}
        {allVideos.length === 1 && (
          <div style={S.waitingTile}>
            <span style={{color:"rgba(255,255,255,.45)"}}><IconUsers size={32} /></span>
            <p style={{fontSize:14,color:"rgba(255,255,255,.5)",marginTop:8}}>Waiting for others to join...</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={S.controls}>
        <div style={S.controlsLeft}>
          <button onClick={toggleAudio} style={{...S.ctrlBtn,...(!audioOn?S.ctrlBtnOff:{})}} title={audioOn?"Mute":"Unmute"}>
            {audioOn?<IconMic size={19} />:<IconMicOff size={19} />}
          </button>
          <button onClick={toggleVideo} style={{...S.ctrlBtn,...(!videoOn?S.ctrlBtnOff:{})}} title={videoOn?"Stop video":"Start video"}>
            {videoOn?<IconCamera size={19} />:<IconCameraOff size={19} />}
          </button>
          <button onClick={toggleScreen} style={{...S.ctrlBtn,...(screenSharing?S.ctrlBtnOn:{})}} title="Share screen">
            <IconMonitor size={19} />
          </button>
          <button onClick={raiseHand} style={{...S.ctrlBtn,...(handRaised?S.ctrlBtnOn:{})}} title="Raise hand">
            <IconHand size={19} />
          </button>
          <button onClick={() => setShowChat(!showChat)} style={{...S.ctrlBtn,...(showChat?S.ctrlBtnOn:{})}} title="Chat">
            <IconMessage size={19} />
          </button>
        </div>
        <button onClick={endCall} style={S.endBtn}>End call</button>
      </div>

      {/* Chat panel */}
      {showChat && (
        <div style={S.chatPanel}>
          <div style={S.chatHead}>In-call messages</div>
          <div style={S.chatMessages}>
            {messages.map((m,i) => (
              <div key={i} style={m.system?S.sysMsg:S.chatMsg}>
                {!m.system&&<span style={S.chatName}>{m.user?.name}: </span>}
                <span style={{fontSize:13}}>{m.message}</span>
                <span style={S.chatTime}>{new Date(m.timestamp).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}</span>
              </div>
            ))}
          </div>
          <div style={S.chatInput}>
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendChat()}} placeholder="Type a message..." style={S.chatInputEl} />
            <button onClick={sendChat} style={S.chatSend}>Send</button>
          </div>
        </div>
      )}
    </div>
  )
}

const S: Record<string,any> = {
  loading:{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#04342C",color:"#fff",fontSize:14},
  lobby:{minHeight:"100vh",background:"#04342C",display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem"},
  lobbyCard:{background:"rgba(255,255,255,.05)",border:"0.5px solid rgba(255,255,255,.1)",borderRadius:20,padding:"2.5rem",width:"100%",maxWidth:460,textAlign:"center" as const},
  lobbyIcon:{fontSize:56,marginBottom:"1rem"},
  lobbyTitle:{fontSize:22,fontWeight:600,color:"#fff",letterSpacing:"-.3px",marginBottom:6},
  lobbySub:{fontSize:14,color:"rgba(255,255,255,.5)",marginBottom:"1.5rem"},
  lobbyInfo:{background:"rgba(255,255,255,.04)",borderRadius:12,padding:"1rem",marginBottom:"1.25rem",textAlign:"left" as const},
  lobbyRow:{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"0.5px solid rgba(255,255,255,.06)"},
  lobbyLabel:{fontSize:12,color:"rgba(255,255,255,.4)"},
  lobbyCode:{fontSize:14,fontWeight:700,color:"#9FD4C3",letterSpacing:"2px"},
  lobbyVal:{fontSize:13,color:"rgba(255,255,255,.8)"},
  lobbyNotes:{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"10px 12px",fontSize:13,color:"rgba(255,255,255,.6)",marginBottom:"1.25rem",textAlign:"left" as const},
  joinBtn:{width:"100%",background:"#0F6E56",color:"#fff",border:"none",borderRadius:10,padding:"13px",fontSize:15,fontWeight:600,cursor:"pointer",marginBottom:8},
  backBtn:{width:"100%",background:"none",border:"0.5px solid rgba(255,255,255,.15)",color:"rgba(255,255,255,.6)",borderRadius:10,padding:"11px",fontSize:14,cursor:"pointer"},
  room:{display:"flex",flexDirection:"column" as const,height:"100vh",background:"#04342C",overflow:"hidden"},
  roomHead:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 1.5rem",borderBottom:"0.5px solid rgba(255,255,255,.06)",flexShrink:0},
  roomTitle:{fontSize:15,fontWeight:600,color:"#fff"},
  roomMeta:{display:"flex",alignItems:"center",gap:12},
  timer:{fontSize:13,color:"#9FD4C3",fontWeight:600,fontVariantNumeric:"tabular-nums"},
  pCount:{fontSize:12,color:"rgba(255,255,255,.4)"},
  roomCode:{fontSize:12,color:"rgba(255,255,255,.3)"},
  videoGrid:{flex:1,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:8,padding:"1rem",overflow:"hidden"},
  videoTile:{position:"relative" as const,background:"#1A1A2E",borderRadius:14,overflow:"hidden",aspectRatio:"16/9"},
  videoEl:{width:"100%",height:"100%",objectFit:"cover" as const,transform:"scaleX(-1)"},
  videoLabel:{position:"absolute" as const,bottom:8,left:10,fontSize:12,color:"#fff",background:"rgba(0,0,0,.5)",padding:"2px 8px",borderRadius:6},
  videoOff:{position:"absolute" as const,inset:0,background:"#1A1A2E",display:"flex",alignItems:"center",justifyContent:"center"},
  waitingTile:{background:"rgba(255,255,255,.03)",borderRadius:14,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center",aspectRatio:"16/9"},
  controls:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1rem 1.5rem",background:"rgba(0,0,0,.3)",flexShrink:0},
  controlsLeft:{display:"flex",gap:10},
  ctrlBtn:{width:48,height:48,borderRadius:12,background:"rgba(255,255,255,.1)",border:"0.5px solid rgba(255,255,255,.1)",color:"#fff",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"},
  ctrlBtnOff:{background:"#DC2626",border:"0.5px solid #DC2626"},
  ctrlBtnOn:{background:"#0F6E56",border:"0.5px solid #0F6E56"},
  endBtn:{background:"#DC2626",color:"#fff",border:"none",borderRadius:10,padding:"10px 24px",fontSize:14,fontWeight:600,cursor:"pointer"},
  chatPanel:{position:"fixed" as const,right:16,bottom:80,width:300,background:"#1A1A2E",border:"0.5px solid rgba(255,255,255,.1)",borderRadius:14,overflow:"hidden",display:"flex",flexDirection:"column" as const,maxHeight:400},
  chatHead:{padding:"10px 14px",fontSize:13,fontWeight:600,color:"#fff",borderBottom:"0.5px solid rgba(255,255,255,.07)"},
  chatMessages:{flex:1,overflowY:"auto" as const,padding:"10px 14px",display:"flex",flexDirection:"column" as const,gap:6},
  chatMsg:{fontSize:13,color:"rgba(255,255,255,.8)",lineHeight:1.5},
  sysMsg:{fontSize:12,color:"rgba(255,255,255,.4)",fontStyle:"italic" as const},
  chatName:{fontWeight:600,color:"#9FD4C3"},
  chatTime:{fontSize:11,color:"rgba(255,255,255,.3)",marginLeft:6},
  chatInput:{display:"flex",gap:6,padding:"8px 10px",borderTop:"0.5px solid rgba(255,255,255,.07)"},
  chatInputEl:{flex:1,background:"rgba(255,255,255,.08)",border:"none",borderRadius:8,padding:"6px 10px",fontSize:13,color:"#fff",outline:"none"},
  chatSend:{background:"#0F6E56",color:"#fff",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer"},
}