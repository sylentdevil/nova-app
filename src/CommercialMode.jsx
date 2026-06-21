import { useState, useRef, useEffect, useCallback } from "react";

const TUNNEL = "https://mls-collecting-bills-bears.trycloudflare.com";

// Supprime les séquences de 1-3 mots répétées consécutivement en début de texte.
// Ex: "un un peu un peu trop cher" → "un peu trop cher"
// Artefact Web Speech API Android : chevauchement audio au redémarrage après onend.
function deduplicateStart(text) {
  const words = text.trim().split(/\s+/);
  const n = words.length;
  for (let len = Math.min(8, Math.floor(n / 2)); len >= 1; len--) {
    const a = words.slice(0, len).map(w => w.toLowerCase());
    const b = words.slice(len, len * 2).map(w => w.toLowerCase());
    if (a.join(" ") === b.join(" ")) {
      return deduplicateStart(words.slice(len).join(" "));
    }
  }
  return text;
}

const C = {
  bg:'#07090F', surface:'#0C1018', card:'#111827',
  border:'rgba(99,179,237,0.1)', borderActive:'rgba(99,179,237,0.28)',
  cyan:'#63B3ED', text:'#E2E8F0', muted:'#4B5563', purple:'#A78BFA',
  green:'#34D399', orange:'#FBBF24', red:'#F87171',
};

const OBJECTION_LABELS = {
  prix:        { label:"Prix",        color:C.red,    icon:"💰" },
  confiance:   { label:"Confiance",   color:C.orange, icon:"🤝" },
  délai:       { label:"Délai",       color:C.orange, icon:"⏱️"  },
  aides:       { label:"Aides",       color:C.cyan,   icon:"🏛️"  },
  financement: { label:"Financement", color:C.purple, icon:"🏦"  },
  concurrence: { label:"Concurrence", color:C.orange, icon:"⚔️"  },
  réflexion:   { label:"Réflexion",   color:C.cyan,   icon:"🤔"  },
  technique:   { label:"Technique",   color:C.purple, icon:"⚙️"  },
  erreur:      { label:"Erreur",      color:C.red,    icon:"⚠️"  },
};

function getObjMeta(key) {
  const k = (key || "").toLowerCase();
  return OBJECTION_LABELS[k] || { label: key || "—", color: C.muted, icon:"❓" };
}

export default function CommercialMode({ onBack }) {
  const [listening, setListening]         = useState(false);
  const [transcript, setTranscript]       = useState("");
  const [pendingText, setPendingText]     = useState("");
  const [loading, setLoading]             = useState(false);
  const [result, setResult]               = useState(null);  // {objection, reponse}
  const [manualInput, setManualInput]     = useState("");
  const [speechAvail, setSpeechAvail]     = useState(false);
  const [history, setHistory]             = useState([]);

  const recRef      = useRef(null);
  const debounceRef = useRef(null);
  const activeRef   = useRef(false);
  const interimRef  = useRef("");   // interim courant (affichage seulement)
  const accumulatedRef = useRef(""); // finaux accumulés depuis le dernier envoi

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechAvail(!!SR);
  }, []);

  const sendToRouter = useCallback(async (text) => {
    const msg = text.trim();
    if (!msg || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${TUNNEL}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "nova",
          messages: [{ role: "user", content: msg }],
          stream: false,
          mode: "commercial_live",
        }),
      });
      const data = await res.json();
      const raw = data.choices?.[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw);
      setResult(parsed);
      setHistory(h => [{ transcript: msg, ...parsed }, ...h].slice(0, 10));
    } catch (e) {
      setResult({ objection: "erreur", reponse: `Erreur réseau : ${e.message}` });
    }
    setLoading(false);
  }, [loading]);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !activeRef.current) return;

    const r = new SR();
    r.lang = "fr-FR";
    r.continuous = true;
    r.interimResults = true;

    r.onstart = () => setListening(true);
    r.onend = () => {
      setListening(false);
      // relance auto si toujours actif
      if (activeRef.current) setTimeout(() => startListening(), 300);
    };
    r.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        console.warn("Speech error:", e.error);
      }
      setListening(false);
    };

    r.onresult = (e) => {
      let interim = "";
      let final   = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }

      if (final) {
        // Accumule tous les segments finaux — ne remplace pas
        accumulatedRef.current = (accumulatedRef.current + " " + final).trim();
        interimRef.current = "";
        setTranscript(accumulatedRef.current);
        setPendingText(accumulatedRef.current);

        // Repart le debounce à chaque nouveau final ; envoie après 1.2s de silence
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const toSend = deduplicateStart(accumulatedRef.current);
          accumulatedRef.current = "";
          interimRef.current = "";
          setTranscript("");
          setPendingText("");
          sendToRouter(toSend);
        }, 1200);
      } else if (interim) {
        interimRef.current = interim;
        // Affiche les finaux accumulés + l'interim en cours
        setTranscript((accumulatedRef.current + " " + interim).trim());
      }
    };

    recRef.current = r;
    try { r.start(); } catch {}
  }, [sendToRouter]);

  const handleStart = () => {
    activeRef.current = true;
    interimRef.current = "";
    accumulatedRef.current = "";
    setTranscript("");
    setPendingText("");
    setResult(null);
    startListening();
  };

  const handleStop = () => {
    activeRef.current = false;
    clearTimeout(debounceRef.current);
    recRef.current?.stop();
    setListening(false);
    setTranscript("");
    interimRef.current = "";
    accumulatedRef.current = "";
  };

  const handleClear = () => {
    handleStop();
    setResult(null);
    setTranscript("");
    setPendingText("");
    setManualInput("");
    setHistory([]);
  };

  const handleManualSend = () => {
    if (manualInput.trim()) {
      sendToRouter(manualInput.trim());
      setManualInput("");
    }
  };

  useEffect(() => () => { handleStop(); }, []);

  const objMeta = result ? getObjMeta(result.objection) : null;

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden',
                  background:C.bg, fontFamily:"'Plus Jakarta Sans',sans-serif", color:C.text }}>

      {/* Header */}
      <div style={{ padding:'13px 18px', borderBottom:`1px solid ${C.border}`,
                    display:'flex', alignItems:'center', gap:12,
                    background:'rgba(7,9,15,0.9)', backdropFilter:'blur(24px)' }}>
        <button onClick={onBack}
          style={{ width:34, height:34, background:'rgba(99,179,237,0.07)',
                   border:`1px solid ${C.border}`, borderRadius:8, color:C.cyan,
                   display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
          ←
        </button>
        <span style={{ fontSize:20 }}>💼</span>
        <span style={{ fontFamily:"'Syne',sans-serif", fontSize:17, fontWeight:700, flex:1 }}>
          Assistant commercial
        </span>
        <span style={{ fontSize:10, padding:'3px 9px', fontWeight:600,
                       background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.2)',
                       borderRadius:20, color:C.green, letterSpacing:'0.04em' }}>
          PHOTOVOLTAÏQUE
        </span>
      </div>

      {/* Contenu scrollable */}
      <div style={{ flex:1, overflowY:'auto', padding:'20px 18px', display:'flex', flexDirection:'column', gap:16 }}>

        {/* Boutons contrôle */}
        <div style={{ display:'flex', gap:10 }}>
          {speechAvail ? (
            <>
              <button onClick={handleStart} disabled={listening || loading}
                style={{ flex:1, padding:'12px', borderRadius:12, border:'none', fontWeight:600, fontSize:14,
                         background: (listening || loading) ? 'rgba(52,211,153,0.08)' : 'rgba(52,211,153,0.15)',
                         color: (listening || loading) ? C.muted : C.green,
                         cursor: (listening || loading) ? 'not-allowed' : 'pointer', transition:'all .15s' }}>
                {listening ? '🎙️ En écoute…' : '▶ Démarrer écoute'}
              </button>
              <button onClick={handleStop} disabled={!listening && !loading}
                style={{ flex:1, padding:'12px', borderRadius:12, border:'none', fontWeight:600, fontSize:14,
                         background: (listening || loading) ? 'rgba(251,191,36,0.15)' : 'rgba(251,191,36,0.05)',
                         color: (listening || loading) ? C.orange : C.muted,
                         cursor: (listening || loading) ? 'pointer' : 'not-allowed', transition:'all .15s' }}>
                ⏹ Stop
              </button>
            </>
          ) : (
            <div style={{ flex:1, padding:'10px 14px', borderRadius:12,
                          background:'rgba(251,191,36,0.08)', border:`1px solid rgba(251,191,36,0.2)`,
                          color:C.orange, fontSize:13, textAlign:'center' }}>
              ⚠️ Web Speech API non disponible — utilisez la saisie manuelle
            </div>
          )}
          <button onClick={handleClear}
            style={{ padding:'12px 16px', borderRadius:12, border:'none', fontWeight:600, fontSize:14,
                     background:'rgba(248,113,113,0.1)', color:C.red, cursor:'pointer' }}>
            🗑
          </button>
        </div>

        {/* Transcription en cours */}
        {transcript && (
          <div style={{ padding:'14px 16px', background:'rgba(99,179,237,0.06)',
                        border:`1px solid rgba(99,179,237,0.2)`, borderRadius:14 }}>
            <div style={{ fontSize:11, color:C.cyan, fontWeight:600,
                          textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>
              🎤 Client dit…
            </div>
            <div style={{ fontSize:14, color:C.text, lineHeight:1.6, fontStyle:'italic' }}>
              {transcript}
            </div>
          </div>
        )}

        {/* Résultat analyse */}
        {loading && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px',
                        background:C.card, border:`1px solid ${C.border}`, borderRadius:14 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:C.cyan,
                          animation:'dot 1.3s infinite' }}/>
            <div style={{ width:8, height:8, borderRadius:'50%', background:C.cyan,
                          animation:'dot 1.3s .18s infinite' }}/>
            <div style={{ width:8, height:8, borderRadius:'50%', background:C.cyan,
                          animation:'dot 1.3s .36s infinite' }}/>
            <span style={{ fontSize:13, color:C.muted, marginLeft:6 }}>Analyse en cours…</span>
          </div>
        )}

        {result && !loading && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {/* Objection détectée */}
            <div style={{ padding:'12px 16px', background:C.card,
                          border:`1px solid ${objMeta.color}44`, borderRadius:14,
                          display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:22 }}>{objMeta.icon}</span>
              <div>
                <div style={{ fontSize:10, color:C.muted, fontWeight:600,
                               textTransform:'uppercase', letterSpacing:'0.06em' }}>
                  Objection détectée
                </div>
                <div style={{ fontSize:15, fontWeight:700, color:objMeta.color, marginTop:2 }}>
                  {objMeta.label}
                </div>
              </div>
            </div>

            {/* Réponse conseillée */}
            <div style={{ padding:'16px', background:`${objMeta.color}0D`,
                          border:`1px solid ${objMeta.color}33`, borderRadius:14 }}>
              <div style={{ fontSize:10, color:objMeta.color, fontWeight:600,
                             textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
                💬 À dire au client
              </div>
              <div style={{ fontSize:15, color:C.text, lineHeight:1.7, fontWeight:500 }}>
                {result.reponse}
              </div>
            </div>
          </div>
        )}

        {/* Saisie manuelle */}
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:11, color:C.muted, fontWeight:600,
                         textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
            ✏️ Saisie manuelle
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <textarea
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleManualSend(); } }}
              placeholder="Coller ou taper ce que dit le client…"
              rows={2}
              style={{ flex:1, padding:'10px 12px', background:C.card,
                       border:`1px solid ${C.border}`, borderRadius:12, color:C.text,
                       fontSize:14, lineHeight:1.5, resize:'none', fontFamily:'inherit' }}
            />
            <button onClick={handleManualSend} disabled={!manualInput.trim() || loading}
              style={{ padding:'0 16px', borderRadius:12, border:'none', fontWeight:600,
                       background: manualInput.trim() && !loading
                         ? `linear-gradient(135deg,${C.cyan},${C.purple})`
                         : 'rgba(99,179,237,0.08)',
                       color: manualInput.trim() && !loading ? '#07090F' : C.muted,
                       cursor: manualInput.trim() && !loading ? 'pointer' : 'not-allowed',
                       fontSize:18, transition:'all .15s' }}>
              →
            </button>
          </div>
        </div>

        {/* Historique session */}
        {history.length > 0 && (
          <div style={{ marginTop:4 }}>
            <div style={{ fontSize:11, color:C.muted, fontWeight:600,
                           textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
              Historique session
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {history.map((h, i) => {
                const m = getObjMeta(h.objection);
                return (
                  <div key={i} style={{ padding:'12px 14px', background:C.surface,
                                         border:`1px solid ${C.border}`, borderRadius:12 }}>
                    <div style={{ fontSize:12, color:C.muted, marginBottom:4,
                                   whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      🗣 {h.transcript}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:12, padding:'2px 8px', borderRadius:20,
                                      background:`${m.color}15`, color:m.color, fontWeight:600 }}>
                        {m.icon} {m.label}
                      </span>
                      <span style={{ fontSize:12, color:C.text, lineHeight:1.5 }}>{h.reponse}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
