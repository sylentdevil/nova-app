import { useState, useRef, useEffect } from "react";
const TUNNEL = "https://solved-take-msgid-empire.trycloudflare.com";
const C = {
  bg:'#07090F',surface:'#0C1018',card:'#111827',
  border:'rgba(99,179,237,0.1)',borderActive:'rgba(99,179,237,0.28)',
  cyan:'#63B3ED',text:'#E2E8F0',muted:'#4B5563',purple:'#A78BFA',
};
const SUGGESTIONS = ["Où est Cynthia ?","Allume la cuisine","Mets de la musique","État de l'alarme","Éteins les lumières","Quel temps fait-il ?"];
const NovaLogo = ({ size=28 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <defs>
      <radialGradient id="ng" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#63B3ED" stopOpacity="0.25"/>
        <stop offset="100%" stopColor="#63B3ED" stopOpacity="0"/>
      </radialGradient>
      <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#63B3ED"/>
        <stop offset="100%" stopColor="#A78BFA"/>
      </linearGradient>
    </defs>
    <circle cx="16" cy="16" r="15" fill="url(#ng)" stroke="#63B3ED" strokeWidth="0.8" strokeOpacity="0.4"/>
    <path d="M16 4L18.8 13.2L28 16L18.8 18.8L16 28L13.2 18.8L4 16L13.2 13.2Z" fill="url(#sg)"/>
    <circle cx="16" cy="16" r="2.8" fill="#07090F"/>
  </svg>
);

const VoiceOrb = ({ listening, speaking, onClick }) => {
  const state = speaking ? 'speaking' : listening ? 'listening' : 'idle';
  const colors = {
    idle: ['rgba(99,179,237,0.15)', 'rgba(99,179,237,0.08)', 'rgba(99,179,237,0.03)'],
    listening: ['rgba(99,179,237,0.9)', 'rgba(99,179,237,0.4)', 'rgba(99,179,237,0.1)'],
    speaking: ['rgba(167,139,250,0.9)', 'rgba(167,139,250,0.4)', 'rgba(167,139,250,0.1)'],
  };
  const c = colors[state];
  return (
    <div onClick={onClick} style={{cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',position:'relative',width:120,height:120}}>
      {/* Anneaux externes */}
      <div style={{position:'absolute',width:120,height:120,borderRadius:'50%',background:c[2],animation:state!=='idle'?'orbOuter 2s ease-in-out infinite':'none'}}/>
      <div style={{position:'absolute',width:90,height:90,borderRadius:'50%',background:c[1],animation:state!=='idle'?'orbMid 1.5s ease-in-out infinite':'none'}}/>
      {/* Cercle principal */}
      <div style={{
        position:'relative',width:64,height:64,borderRadius:'50%',
        background:`radial-gradient(circle at 35% 35%, ${state==='speaking'?'#A78BFA':'#63B3ED'}, ${state==='speaking'?'#7C3AED':'#1E40AF'})`,
        boxShadow:`0 0 ${state!=='idle'?'30px':'10px'} ${state==='speaking'?'rgba(167,139,250,0.6)':'rgba(99,179,237,0.4)'}`,
        display:'flex',alignItems:'center',justifyContent:'center',
        transition:'all 0.3s ease',
        animation:state!=='idle'?'orbPulse 1s ease-in-out infinite':'none'
      }}>
        {state==='idle' && <span style={{fontSize:24}}>🎤</span>}
        {state==='listening' && (
          <div style={{display:'flex',gap:3,alignItems:'center'}}>
            {[0,1,2,3].map(i=>(
              <div key={i} style={{width:3,borderRadius:2,background:'white',animation:`bar 0.8s ${i*0.1}s ease-in-out infinite`}}/>
            ))}
          </div>
        )}
        {state==='speaking' && (
          <div style={{display:'flex',gap:3,alignItems:'center'}}>
            {[0,1,2,3,4].map(i=>(
              <div key={i} style={{width:3,borderRadius:2,background:'white',animation:`bar 0.6s ${i*0.08}s ease-in-out infinite`}}/>
            ))}
          </div>
        )}
      </div>
      {/* Label */}
      <div style={{position:'absolute',bottom:-24,fontSize:11,color:state==='idle'?C.muted:state==='speaking'?C.purple:C.cyan,fontWeight:500,letterSpacing:'0.05em'}}>
        {state==='idle'?'Appuyer pour parler':state==='listening'?'En écoute...':'Nova parle...'}
      </div>
    </div>
  );
};

let nextId = 2;
export default function App() {
  const [conversations, setConversations] = useState(() => {
    try {
      const saved = localStorage.getItem('nova_conversations');
      return saved ? JSON.parse(saved) : [{id:1,title:"Nouvelle conversation",messages:[]}];
    } catch { return [{id:1,title:"Nouvelle conversation",messages:[]}]; }
  });
  const [activeId, setActiveId] = useState(() => {
    try { return parseInt(localStorage.getItem('nova_activeId')) || 1; } catch { return 1; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [focused, setFocused] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [tts, setTts] = useState(true);
  const endRef = useRef(null);
  const taRef = useRef(null);
  const recRef = useRef(null);
  const liveRef = useRef(false);
  const speakRef = useRef(true);
  const loadingRef = useRef(false);
  const activeIdRef = useRef(activeId);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { speakRef.current = tts; }, [tts]);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      *{box-sizing:border-box;margin:0;padding:0;}
      body{background:#07090F;overscroll-behavior:none;}
      ::-webkit-scrollbar{width:3px;}
      ::-webkit-scrollbar-thumb{background:rgba(99,179,237,0.18);border-radius:2px;}
      @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
      @keyframes dot{0%,60%,100%{opacity:.25;transform:scale(.75)}30%{opacity:1;transform:scale(1)}}
      @keyframes orbPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
      @keyframes orbMid{0%,100%{transform:scale(1);opacity:0.4}50%{transform:scale(1.1);opacity:0.7}}
      @keyframes orbOuter{0%,100%{transform:scale(1);opacity:0.1}50%{transform:scale(1.15);opacity:0.3}}
      @keyframes bar{0%,100%{height:6px}50%{height:22px}}
      .msg{animation:fadeUp .22s ease forwards;}
      .d1{animation:dot 1.3s infinite}
      .d2{animation:dot 1.3s .18s infinite}
      .d3{animation:dot 1.3s .36s infinite}
      textarea{font-family:'Plus Jakarta Sans',sans-serif;resize:none;}
      textarea:focus{outline:none;}
      textarea::placeholder{color:#4B5563;}
      button{cursor:pointer;}
      .sugg:hover{background:rgba(99,179,237,0.1);border-color:rgba(99,179,237,0.25);color:#E2E8F0;}
      .ci:hover{background:rgba(99,179,237,0.05);}
    `;
    document.head.appendChild(style);
    const link = document.createElement('link');
    link.rel='stylesheet';
    link.href='https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('nova_conversations', JSON.stringify(conversations));
      localStorage.setItem('nova_activeId', activeId);
      // Mettre à jour nextId
      const maxId = Math.max(...conversations.map(c => c.id), 1);
      nextId = maxId + 1;
    } catch {}
  }, [conversations, activeId]);

  const active = conversations.find(c => c.id === activeId);
  const msgs = active?.messages || [];
  useEffect(() => { endRef.current?.scrollIntoView({behavior:'smooth'}); }, [msgs, loading]);

  const newConv = () => {
    const id = nextId++;
    setConversations(p => [...p, {id, title:"Nouvelle conversation", messages:[]}]);
    setActiveId(id);
    setSidebar(false);
  };

  const speak = (text) => {
    if (!speakRef.current) return;
    window.speechSynthesis.cancel();
    setSpeaking(true);
    const trySpeak = () => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "fr-FR";
      u.rate = 0.92;
      u.pitch = 1.2;
      u.volume = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const frVoice =
        voices.find(v => v.lang === "fr-FR" && v.name.includes("Google") && !v.name.toLowerCase().includes("male")) ||
        voices.find(v => v.lang === "fr-FR" && v.name.includes("Google")) ||
        voices.find(v => v.lang === "fr-FR" && !v.name.toLowerCase().includes("male")) ||
        voices.find(v => v.lang === "fr-FR") ||
        voices.find(v => v.lang.startsWith("fr"));
      if (frVoice) u.voice = frVoice;
      u.onend = () => {
        setSpeaking(false);
        if (liveRef.current) setTimeout(() => startListening(), 400);
      };
      window.speechSynthesis.speak(u);
    };
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = trySpeak;
    } else { trySpeak(); }
  };

  const sendMsg = async (text) => {
    const msg = text.trim();
    if (!msg) return;
    setInput("");
    if (taRef.current) taRef.current.style.height = 'auto';
    const currentMsgs = conversations.find(c => c.id === activeIdRef.current)?.messages || [];
    const updated = [...currentMsgs, {role:"user", content:msg}];
    setConversations(p => p.map(c => c.id === activeIdRef.current ? {
      ...c,
      title: c.messages.length === 0 ? msg.slice(0,38)+(msg.length>38?'…':'') : c.title,
      messages: updated
    } : c));
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(`${TUNNEL}/v1/chat/completions`, {
        method:"POST", signal: controller.signal,
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({model:"qwen3:8b", messages:updated, stream:false})
      });
      const data = await res.json();
      clearTimeout(timeoutId);
      const reply = data.choices?.[0]?.message?.content || "Désolée, une erreur s'est produite.";
      setConversations(p => p.map(c => c.id === activeIdRef.current ? {...c, messages:[...updated,{role:"assistant",content:reply}]} : c));
      speak(reply);
    } catch {
      setConversations(p => p.map(c => c.id === activeIdRef.current ? {...c, messages:[...updated,{role:"assistant",content:"Erreur de connexion."}]} : c));
      setSpeaking(false);
      if (liveRef.current) setTimeout(() => startListening(), 400);
    }
    setLoading(false);
  };

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !liveRef.current || loadingRef.current) return;
    const r = new SR();
    r.lang = "fr-FR";
    r.continuous = false;
    r.interimResults = false;
    r.onstart = () => setListening(true);
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); if (liveRef.current) setTimeout(() => startListening(), 1500); };
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) t += e.results[i][0].transcript;
      }
      if (t.trim()) sendMsg(t.trim());
    };
    recRef.current = r;
    try { r.start(); } catch(e) {}
  };

  const toggleVoiceMode = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Micro non supporté"); return; }
    if (liveRef.current) {
      liveRef.current = false;
      recRef.current && recRef.current.stop();
      window.speechSynthesis.cancel();
      setListening(false);
      setSpeaking(false);
      setVoiceMode(false);
    } else {
      liveRef.current = true;
      setVoiceMode(true);
      startListening();
    }
  };

  const send = () => { if (input.trim() && !loading) sendMsg(input); };
  const onKey = (e) => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} };
  const onInput = (e) => {
    setInput(e.target.value);
    e.target.style.height='auto';
    e.target.style.height=Math.min(e.target.scrollHeight,130)+'px';
  };
  const canSend = input.trim().length > 0 && !loading;

  return (
    <div style={{display:'flex',height:'100vh',background:C.bg,fontFamily:"'Plus Jakarta Sans',sans-serif",color:C.text,position:'relative',overflow:'hidden'}}>
      {sidebar && <div onClick={()=>setSidebar(false)} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.6)',zIndex:99,backdropFilter:'blur(3px)'}}/>}
      {/* Sidebar */}
      <div style={{width:264,background:C.surface,borderRight:`1px solid ${C.border}`,display:'flex',flexDirection:'column',position:'absolute',left:sidebar?0:-264,top:0,bottom:0,zIndex:100,transition:'left 0.3s cubic-bezier(.4,0,.2,1)'}}>
        <div style={{padding:'20px 16px 14px',borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:14}}>
            <NovaLogo size={24}/><span style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:700}}>Nova</span>
          </div>
          <button onClick={newConv} style={{width:'100%',padding:'9px 12px',background:'rgba(99,179,237,0.08)',border:`1px solid ${C.border}`,borderRadius:10,color:C.cyan,fontSize:13,display:'flex',alignItems:'center',gap:7}}>
            <span style={{fontSize:17}}>+</span> Nouvelle conversation
          </button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'6px 8px'}}>
          <div style={{fontSize:10,color:C.muted,padding:'8px 8px 4px',textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>Conversations</div>
          {[...conversations].reverse().map(c => (
            <div key={c.id} className="ci" onClick={()=>{setActiveId(c.id);setSidebar(false);}} style={{padding:'9px 10px',borderRadius:8,cursor:'pointer',marginBottom:1,borderLeft:c.id===activeId?`2px solid ${C.cyan}`:'2px solid transparent',background:c.id===activeId?'rgba(99,179,237,0.08)':'transparent',transition:'all .12s'}}>
              <div style={{fontSize:13,color:c.id===activeId?C.text:C.muted,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{c.title}</div>
            </div>
          ))}
        </div>
        <div style={{padding:'12px 16px',borderTop:`1px solid ${C.border}`,display:'flex',flexDirection:'column',gap:8}}>
          <button onClick={()=>{
            if(window.confirm('Effacer tout l\'historique ?')){
              const id=nextId++;
              setConversations([{id,title:"Nouvelle conversation",messages:[]}]);
              setActiveId(id);
              setSidebar(false);
            }
          }} style={{width:'100%',padding:'8px 12px',background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:10,color:'#F87171',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            🗑️ Effacer tout l'historique
          </button>
          <div style={{fontSize:11,color:C.muted,textAlign:'center'}}>Nova · Maison connectée</div>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {/* Header */}
        <div style={{padding:'13px 18px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',gap:10,background:'rgba(7,9,15,0.9)',backdropFilter:'blur(24px)'}}>
          <button onClick={()=>setSidebar(!sidebar)} style={{width:34,height:34,background:'rgba(99,179,237,0.07)',border:`1px solid ${C.border}`,borderRadius:8,color:C.cyan,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>☰</button>
          <NovaLogo size={26}/>
          <span style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:700,flex:1}}>Nova</span>
          <button onClick={()=>{setTts(t=>!t);}} style={{background:'none',border:'none',fontSize:16,color:tts?C.purple:C.muted,cursor:'pointer'}} title="Voix on/off">{tts?'🔊':'🔇'}</button>
          <span style={{fontSize:10,padding:'3px 9px',fontWeight:600,background:'rgba(99,179,237,0.1)',border:'1px solid rgba(99,179,237,0.2)',borderRadius:20,color:C.cyan,letterSpacing:'0.04em'}}>IA LOCALE</span>
        </div>

        {/* Messages ou Orbe voix */}
        <div style={{flex:1,overflowY:'auto',padding:'28px 18px 12px',display:'flex',flexDirection:'column',gap:18}}>
          {voiceMode ? (
            /* MODE VOIX — plein écran avec orbe */
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:40}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:700,color:C.text,textAlign:'center'}}>
                {speaking ? "Nova répond..." : listening ? "Je vous écoute..." : "Mode vocal actif"}
              </div>
              <VoiceOrb listening={listening} speaking={speaking} onClick={toggleVoiceMode}/>
              <div style={{fontSize:12,color:C.muted,textAlign:'center',marginTop:20}}>Appuyer sur l'orbe pour arrêter</div>
              {/* Dernière réponse */}
              {msgs.length > 0 && (
                <div style={{maxWidth:340,padding:'12px 16px',background:C.card,border:`1px solid ${C.border}`,borderRadius:16,fontSize:13,color:C.text,lineHeight:1.6,textAlign:'center'}}>
                  {msgs[msgs.length-1].content.slice(0,150)}{msgs[msgs.length-1].content.length>150?'...':''}
                </div>
              )}
            </div>
          ) : msgs.length===0 ? (
            <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:'40px 20px'}}>
              <NovaLogo size={72}/>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:26,fontWeight:800,background:`linear-gradient(135deg,${C.cyan},${C.purple})`,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',textAlign:'center'}}>Bonjour, je suis Nova</div>
              <div style={{fontSize:14,color:C.muted,textAlign:'center',lineHeight:1.6}}>Votre assistante IA personnelle.<br/>Comment puis-je vous aider ?</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',marginTop:12,maxWidth:340}}>
                {SUGGESTIONS.map(s=>(<button key={s} className="sugg" onClick={()=>sendMsg(s)} style={{padding:'7px 13px',background:'rgba(99,179,237,0.06)',border:'1px solid rgba(99,179,237,0.15)',borderRadius:20,color:C.muted,fontSize:12,transition:'all .15s',fontWeight:500}}>{s}</button>))}
              </div>
            </div>
          ) : msgs.map((m,i)=>(
            <div key={i} className="msg">
              {m.role==='user' ? (
                <div style={{display:'flex',justifyContent:'flex-end'}}>
                  <div style={{maxWidth:'78%',padding:'11px 15px',background:'rgba(99,179,237,0.1)',border:'1px solid rgba(99,179,237,0.2)',borderRadius:'18px 18px 4px 18px',fontSize:14,lineHeight:1.65}}>{m.content}</div>
                </div>
              ) : (
                <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                  <div style={{width:30,height:30,borderRadius:'50%',background:'rgba(99,179,237,0.08)',border:'1px solid rgba(99,179,237,0.22)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}><NovaLogo size={17}/></div>
                  <div style={{maxWidth:'82%',padding:'11px 15px',background:C.card,border:`1px solid ${C.border}`,borderRadius:'4px 18px 18px 18px',fontSize:14,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{m.content}</div>
                </div>
              )}
            </div>
          ))}
          {loading && !voiceMode && (
            <div className="msg" style={{display:'flex',alignItems:'flex-start',gap:10}}>
              <div style={{width:30,height:30,borderRadius:'50%',background:'rgba(99,179,237,0.08)',border:'1px solid rgba(99,179,237,0.22)',display:'flex',alignItems:'center',justifyContent:'center'}}><NovaLogo size={17}/></div>
              <div style={{padding:'14px 16px',background:C.card,border:`1px solid ${C.border}`,borderRadius:'4px 18px 18px 18px',display:'flex',gap:5,alignItems:'center'}}>
                {[1,2,3].map(n=><div key={n} className={`d${n}`} style={{width:7,height:7,borderRadius:'50%',background:C.cyan}}/>)}
              </div>
            </div>
          )}
          <div ref={endRef}/>
        </div>

        {/* Input bar */}
        {!voiceMode && (
          <div style={{padding:'12px 18px 28px',borderTop:`1px solid ${C.border}`,background:'rgba(7,9,15,0.92)',backdropFilter:'blur(24px)'}}>
            <div style={{display:'flex',alignItems:'flex-end',gap:10,background:C.card,border:`1px solid ${focused?C.borderActive:C.border}`,borderRadius:16,padding:'10px 12px',transition:'border-color .2s'}}>
              <textarea ref={taRef} value={input} onChange={onInput} onKeyDown={onKey} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} placeholder="Message à Nova…" rows={1} style={{flex:1,background:'transparent',border:'none',color:C.text,fontSize:14,lineHeight:1.55,maxHeight:130,padding:'2px 0',fontFamily:"'Plus Jakarta Sans',sans-serif"}}/>
              {/* Bouton orbe vocal */}
              <button onClick={toggleVoiceMode} style={{width:36,height:36,borderRadius:10,border:'none',flexShrink:0,background:'rgba(99,179,237,0.08)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:C.cyan}}>
                🎤
              </button>
              <button onClick={send} disabled={!canSend} style={{width:36,height:36,borderRadius:10,border:'none',flexShrink:0,background:canSend?`linear-gradient(135deg,${C.cyan},${C.purple})`:'rgba(99,179,237,0.08)',display:'flex',alignItems:'center',justifyContent:'center',opacity:canSend?1:0.45}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22 2L11 13" stroke={canSend?'#07090F':C.cyan} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={canSend?'#07090F':C.cyan} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div style={{textAlign:'center',fontSize:11,color:C.muted,marginTop:8}}>Nova · Home Assistant · Maison connectée</div>
          </div>
        )}
      </div>
    </div>
  );
}
