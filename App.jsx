import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { Trophy, Upload, Vote, BarChart3, Users, Palette, Trash2, Crown, Star, Award, Image as ImageIcon, Link as LinkIcon, Sparkles, PartyPopper, Lock, Unlock, X, CheckCircle2, Share2, Settings, AlertCircle, Edit3, Save, ArrowRight } from 'lucide-react';

// --- Firebase Configuration ---
// הערה: כשמעלים לאוויר, יש לוודא שה-firebaseConfig מוגדר כראוי בסביבה
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : {
      apiKey: "",
      authDomain: "",
      projectId: "",
      storageBucket: "",
      messagingSenderId: "",
      appId: ""
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// פונקציה לקבלת שם התחרות מהקישור בצורה בטוחה
const getRoomFromURL = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || 'תחרות-מרכזית';
  } catch (e) {
    return 'תחרות-מרכזית';
  }
};

const appId = typeof __app_id !== 'undefined' ? __app_id : 'purim-contest-final-v4';

const STAGES = {
  UPLOAD: 'upload',
  VOTING: 'voting',
  RESULTS: 'results'
};

const ADMIN_PASSWORD = "2025"; 

const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap');
    
    :root {
      --circus-red: #e11d48;
      --circus-yellow: #facc15;
      --circus-blue: #2563eb;
      --circus-bg: #fff7ed;
      --text-main: #1e293b;
    }

    body {
      font-family: 'Rubik', sans-serif;
      background-color: var(--circus-bg);
      color: var(--text-main);
      background-image: 
        radial-gradient(var(--circus-yellow) 0.5px, transparent 0.5px),
        radial-gradient(var(--circus-yellow) 0.5px, var(--circus-bg) 0.5px);
      background-size: 20px 20px;
      background-position: 0 0, 10px 10px;
      line-height: 1.6;
    }

    .circus-header {
      background: var(--circus-red);
      background-image: repeating-linear-gradient(45deg, var(--circus-red), var(--circus-red) 20px, #be123c 20px, #be123c 40px);
      border-bottom: 8px solid var(--circus-yellow);
      box-shadow: 0 10px 30px rgba(225, 29, 72, 0.3);
    }

    .circus-card {
      background: white;
      border: 4px solid var(--circus-yellow);
      border-radius: 32px;
      box-shadow: 8px 8px 0px rgba(250, 204, 21, 0.1);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .circus-title {
      font-weight: 700;
      text-shadow: 2px 2px 0px rgba(0,0,0,0.1);
    }

    .admin-overlay {
      background: rgba(15, 23, 42, 0.96);
      backdrop-filter: blur(15px);
    }

    .btn-primary-circus {
      background-color: #e11d48 !important;
      color: #ffffff !important;
      font-weight: 700 !important;
      padding: 1.25rem !important;
      border-radius: 1.5rem !important;
      width: 100% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 0.5rem !important;
      box-shadow: 0 10px 20px rgba(225, 29, 72, 0.4) !important;
      border: 2px solid rgba(255, 255, 255, 0.2) !important;
      font-size: 1.25rem !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
    }

    .input-circus-admin {
      background-color: #f8fafc !important;
      border: 2px solid #e2e8f0 !important;
      color: #1e293b !important;
      font-weight: 600 !important;
      text-align: center !important;
    }

    .stage-btn-inactive {
      color: #475569 !important;
      font-weight: 600 !important;
      background: rgba(255, 255, 255, 0.8) !important;
      border: 1px solid #e2e8f0 !important;
    }

    .stage-btn-active {
      background-color: #e11d48 !important;
      color: #ffffff !important;
      font-weight: 700 !important;
      box-shadow: 0 4px 12px rgba(225, 29, 72, 0.3) !important;
    }

    .icon-circle {
      background: white !important;
      border: 3px solid var(--circus-yellow);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
    }

    .share-toast {
      background: #1e293b;
      color: white;
      padding: 12px 24px;
      border-radius: 9999px;
      position: fixed;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from { transform: translate(-50%, 100%); }
      to { transform: translate(-50%, 0); }
    }
  `}</style>
);

const App = () => {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState(getRoomFromURL());
  const [stage, setStage] = useState(STAGES.UPLOAD);
  const [contestTitle, setContestTitle] = useState('קרנבל התחפושות');
  const [allParticipants, setAllParticipants] = useState([]);
  const [allVotes, setAllVotes] = useState([]);
  const [myVote, setMyVote] = useState({ first: null, second: null, third: null });
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [adminRoomInput, setAdminRoomInput] = useState('');
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editDisplayTitle, setEditDisplayTitle] = useState('');

  useEffect(() => {
    const savedAdminStatus = sessionStorage.getItem(`admin_${appId}_${roomId}`);
    if (savedAdminStatus === 'true') {
      setIsAdmin(true);
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { console.error("Auth error:", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    if (!user) return;
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    const unsubConfig = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStage(data.stage || STAGES.UPLOAD);
        setContestTitle(data.displayTitle || 'קרנבל התחפושות');
        setEditDisplayTitle(data.displayTitle || 'קרנבל התחפושות');
      } else {
        setDoc(configRef, { 
          stage: STAGES.UPLOAD, 
          displayTitle: 'קרנבל התחפושות',
          createdAt: new Date().toISOString() 
        });
      }
    });

    const participantsCol = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
    const unsubParticipants = onSnapshot(participantsCol, (snapshot) => {
      setAllParticipants(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const votesCol = collection(db, 'artifacts', appId, 'public', 'data', 'votes');
    const unsubVotes = onSnapshot(votesCol, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setAllVotes(list);
      const userVote = list.find(v => v.userId === user.uid && v.roomId === roomId);
      if (userVote) setMyVote(userVote.choices);
      else setMyVote({ first: null, second: null, third: null });
    });

    return () => { unsubConfig(); unsubParticipants(); unsubVotes(); };
  }, [user, roomId]);

  const roomParticipants = useMemo(() => 
    allParticipants.filter(p => p.roomId === roomId), 
  [allParticipants, roomId]);

  const roomVotes = useMemo(() => 
    allVotes.filter(v => v.roomId === roomId), 
  [allVotes, roomId]);

  const handleAdminToggle = () => {
    if (!isAdmin) {
      setAdminRoomInput(''); 
      setShowAdminLogin(true);
    } else if (window.confirm("לצאת ממצב ניהול?")) {
      setIsAdmin(false);
      sessionStorage.removeItem(`admin_${appId}_${roomId}`);
    }
  };

  const verifyAdmin = () => {
    if (adminPassInput === ADMIN_PASSWORD) {
      setLoginSuccess(true);
      setTimeout(() => {
        const targetRoom = adminRoomInput.trim() || roomId || 'תחרות-מרכזית';
        if (targetRoom !== roomId) {
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('room', targetRoom);
            window.history.pushState({}, '', url.toString());
          } catch (e) {
            console.log("Safe redirect in restricted environment");
          }
          setRoomId(targetRoom);
        }
        
        setIsAdmin(true);
        sessionStorage.setItem(`admin_${appId}_${targetRoom}`, 'true');
        setShowAdminLogin(false);
        setLoginSuccess(false);
        setAdminPassInput('');
      }, 800);
    } else {
      alert("קוד שגוי!");
      setAdminPassInput('');
    }
  };

  const copyShareLink = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', roomId);
      const input = document.createElement('input');
      input.value = url.toString();
      document.body.appendChild(input);
      input.select();
      const success = document.execCommand('copy');
      document.body.removeChild(input);
      if (success) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      }
    } catch (e) {
      alert("לא ניתן להעתיק כרגע.");
    }
  };

  const changeStage = async (newStage) => {
    if (!user) return;
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    await updateDoc(configRef, { stage: newStage });
  };

  const updateContestTitle = async () => {
    if (!editDisplayTitle.trim() || !user) return;
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'rooms', roomId);
    await updateDoc(configRef, { displayTitle: editDisplayTitle.trim() });
    alert("שם התחרות עודכן!");
  };

  const addParticipant = async (fullName, costumeName, imageUrl) => {
    if (!user) return;
    const participantsCol = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
    await addDoc(participantsCol, { 
      name: fullName, costume: costumeName, imageUrl, userId: user.uid, roomId: roomId, createdAt: new Date().toISOString() 
    });
  };

  const castVote = async (choices) => {
    if (!user) return;
    const voteId = `${roomId}_${user.uid}`;
    const voteRef = doc(db, 'artifacts', appId, 'public', 'data', 'votes', voteId);
    await setDoc(voteRef, { userId: user.uid, roomId: roomId, choices, updatedAt: new Date().toISOString() });
  };

  const deleteParticipant = async (id) => {
    if (!user) return;
    if (window.confirm("למחוק את המתמודד?")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'participants', id));
    }
  };

  const results = useMemo(() => {
    const scores = {};
    roomParticipants.forEach(p => scores[p.id] = { ...p, score: 0 });
    roomVotes.forEach(v => {
      if (v.choices.first && scores[v.choices.first]) scores[v.choices.first].score += 3;
      if (v.choices.second && scores[v.choices.second]) scores[v.choices.second].score += 2;
      if (v.choices.third && scores[v.choices.third]) scores[v.choices.third].score += 1;
    });
    return Object.values(scores).sort((a, b) => b.score - a.score);
  }, [roomParticipants, roomVotes]);

  if (loading) return null;

  return (
    <div className="min-h-screen pb-40" dir="rtl">
      <GlobalStyles />
      
      {showToast && <div className="share-toast font-bold shadow-2xl">הקישור לתחרות הועתק! 🎊</div>}

      {showAdminLogin && (
        <div className="fixed inset-0 z-[100] admin-overlay flex items-center justify-center p-6" onClick={() => setShowAdminLogin(false)}>
          <div className="bg-white rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl border-4 border-circus-yellow relative animate-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowAdminLogin(false)} className="absolute top-6 left-6 text-slate-400 hover:text-circus-red transition-colors"><X size={28} /></button>
            <div className="flex justify-center mb-8">
              <div className={`${loginSuccess ? 'bg-green-500' : 'bg-circus-red'} w-20 h-20 rounded-full shadow-xl flex items-center justify-center`}>
                {loginSuccess ? <CheckCircle2 className="text-white w-10 h-10" /> : <Lock className="text-white w-10 h-10" />}
              </div>
            </div>
            
            <h3 className="text-3xl font-bold text-center mb-2 text-slate-800">כניסת מנהל</h3>
            <p className="text-center text-slate-500 mb-8 text-sm font-medium">הזינו קוד ומזהה תחרות</p>
            
            {!loginSuccess ? (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="text-right px-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">ססמת מנהל</label>
                    <input 
                      type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} placeholder="••••"
                      className="w-full p-4 input-circus-admin rounded-2xl text-2xl tracking-[0.5em] outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="text-right px-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">מזהה תחרות (באנגלית)</label>
                    <input 
                      type="text" value={adminRoomInput} onChange={(e) => setAdminRoomInput(e.target.value)} placeholder="ContestID"
                      className="w-full p-4 input-circus-admin rounded-2xl text-lg outline-none"
                      dir="ltr"
                      onKeyDown={(e) => e.key === 'Enter' && verifyAdmin()}
                    />
                  </div>
                </div>
                
                <button onClick={verifyAdmin} className="btn-primary-circus">
                  התחברות לניהול <ArrowRight size={20} />
                </button>
              </div>
            ) : <div className="text-center py-8 font-bold text-green-600 animate-pulse text-xl">נכנסים...</div>}
          </div>
        </div>
      )}

      <header className="circus-header px-6 py-8 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex justify-between items-center text-right">
          <div className="flex items-center gap-4 md:gap-6 text-right">
            <div className="icon-circle w-14 h-14 md:w-16 md:h-16 shrink-0 shadow-lg border-2 border-white">
              <PartyPopper className="text-circus-red w-7 h-7 md:w-8 md:h-8" />
            </div>
            <div className="text-right">
              <h1 className="text-2xl md:text-4xl font-bold text-white circus-title leading-tight">{contestTitle}</h1>
              <p className="text-circus-yellow text-lg md:text-xl font-semibold mt-0.5 opacity-90">חוגגים יחד עם תחפושות מטריפות</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={copyShareLink} className="p-3 bg-white/20 text-white rounded-2xl border border-white/30 hover:bg-white/40 transition-all shadow-md" title="שיתוף תחרות"><Share2 size={20}/></button>
            <button onClick={handleAdminToggle} className={`text-[13px] font-bold tracking-widest uppercase px-5 py-3 rounded-2xl transition-all border-2 flex items-center gap-2 ${isAdmin ? 'bg-white text-circus-red border-white shadow-xl scale-105' : 'bg-white/10 text-white border-white/30 hover:bg-white/30'}`}>
              {isAdmin ? <><Unlock size={16}/> מנהל</> : <><Lock size={16}/> ניהול</>}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto pt-14 px-6 text-center">
        <div className="flex justify-around items-center relative mb-20">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-circus-red/10 -z-10 rounded-full"></div>
          <Step active={stage === STAGES.UPLOAD} label="הרשמה" num="1" />
          <Step active={stage === STAGES.VOTING} label="הצבעה" num="2" />
          <Step active={stage === STAGES.RESULTS} label="תוצאות" num="3" />
        </div>

        {isAdmin && (
          <div className="space-y-8 mb-16 text-right animate-in fade-in slide-in-from-top-4">
            <div className="flex flex-wrap bg-slate-900/10 p-2.5 rounded-[2.5rem] gap-2.5 border-2 border-slate-300/50 shadow-xl">
              <button onClick={() => changeStage(STAGES.UPLOAD)} className={`flex-1 py-4 text-sm font-bold rounded-2xl transition-all ${stage === STAGES.UPLOAD ? 'stage-btn-active' : 'stage-btn-inactive'}`}>1. שלב ההעלאה</button>
              <button onClick={() => changeStage(STAGES.VOTING)} className={`flex-1 py-4 text-sm font-bold rounded-2xl transition-all ${stage === STAGES.VOTING ? 'stage-btn-active' : 'stage-btn-inactive'}`}>2. שלב ההצבעה</button>
              <button onClick={() => changeStage(STAGES.RESULTS)} className={`flex-1 py-4 text-sm font-bold rounded-2xl transition-all ${stage === STAGES.RESULTS ? 'stage-btn-active' : 'stage-btn-inactive'}`}>3. חשיפת תוצאות</button>
            </div>

            <div className="circus-card p-6 bg-white border-circus-red/10 shadow-lg">
              <h4 className="font-bold text-slate-700 mb-4 flex items-center gap-2"><Edit3 size={18} className="text-circus-red"/> עריכת כותרת התחרות הנוכחית</h4>
              <div className="flex gap-2">
                <input value={editDisplayTitle} onChange={e => setEditDisplayTitle(e.target.value)} className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg outline-none focus:border-circus-red text-slate-800 shadow-inner" />
                <button onClick={updateContestTitle} className="bg-circus-red text-white px-6 rounded-2xl shadow-lg hover:brightness-110 active:scale-95 transition-all"><Save size={24}/></button>
              </div>
            </div>
          </div>
        )}

        <main className="text-right">
          {stage === STAGES.UPLOAD && <UploadPhase participants={roomParticipants} onAdd={addParticipant} onDelete={isAdmin ? deleteParticipant : null} myId={user?.uid} />}
          {stage === STAGES.VOTING && <VotingPhase participants={roomParticipants} myVote={myVote} onVote={castVote} />}
          {stage === STAGES.RESULTS && <ResultsPhase results={results} totalVotes={roomVotes.length} />}
        </main>
      </div>
    </div>
  );
};

const Step = ({ active, label, num }) => (
  <div className="flex flex-col items-center gap-3">
    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-xl md:text-2xl font-bold transition-all duration-500 shadow-lg border-4 ${active ? 'step-active text-circus-red' : 'bg-white text-slate-300 border-slate-100'}`}>
      {num}
    </div>
    <span className={`text-sm md:text-lg font-semibold transition-colors ${active ? 'text-circus-red' : 'text-slate-500'}`}>{label}</span>
  </div>
);

const UploadPhase = ({ participants, onAdd, onDelete, myId }) => {
  const [fullName, setFullName] = useState('');
  const [costumeName, setCostumeName] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const hasJoined = participants.some(p => p.userId === myId);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file && file.size < 800000) {
      const r = new FileReader();
      r.onloadend = () => setImgUrl(r.result);
      r.readAsDataURL(file);
    } else if (file) alert("התמונה כבדה מדי!");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const cleanName = fullName.trim();
    if (!cleanName || !costumeName || !imgUrl) return;
    if (participants.some(p => p.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      setError(`השם "${cleanName}" כבר רשום בתחרות.`);
      return;
    }
    setIsSubmitting(true);
    await onAdd(cleanName, costumeName, imgUrl);
    setIsSubmitting(false);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-5 duration-700">
      {!hasJoined ? (
        <div className="circus-card p-12 mb-20 bg-white shadow-xl">
          <div className="flex items-center gap-4 mb-10 text-right">
            <Sparkles className="text-circus-yellow w-10 h-10" />
            <h2 className="text-3xl font-bold text-circus-red leading-tight">הצטרפו לתחרות!</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-10 text-right">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-right">
              <div className="text-right">
                <label className="text-sm font-semibold text-slate-500 uppercase block mb-4 text-slate-800">שם פרטי ומשפחה</label>
                <input value={fullName} onChange={e => { setFullName(e.target.value); setError(''); }} placeholder="ישראל ישראלי" className={`w-full p-5 bg-slate-50 border-2 rounded-3xl outline-none focus:border-circus-yellow text-xl font-medium transition-all shadow-inner text-right text-slate-800 ${error ? 'border-red-400' : 'border-slate-100'}`} />
                {error && <div className="flex items-center gap-2 text-red-500 mt-3 font-bold text-sm"><AlertCircle size={16} />{error}</div>}
              </div>
              <div className="text-right">
                <label className="text-sm font-semibold text-slate-500 uppercase block mb-4 text-slate-800">למה התחפשת?</label>
                <input value={costumeName} onChange={e => setCostumeName(e.target.value)} placeholder="פיראט מהעתיד" className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:border-circus-yellow text-xl font-medium transition-all shadow-inner text-right text-slate-800" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
              <label className="group block cursor-pointer">
                <div className="border-4 border-dashed border-circus-yellow/40 group-hover:border-circus-yellow rounded-[40px] h-72 flex items-center justify-center transition-all overflow-hidden relative bg-slate-50/50 shadow-inner">
                   {imgUrl ? <img src={imgUrl} className="w-full h-full object-cover" alt="Preview" /> : <div className="text-center p-8"><ImageIcon className="mx-auto text-circus-yellow/60 w-14 h-14 mb-3" /><span className="text-circus-red font-semibold text-xl">לחץ להעלאת תמונה</span></div>}
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleFile} />
              </label>
              <div className="flex flex-col gap-8 pt-4">
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 shadow-inner">
                   <p className="text-[12px] font-bold text-slate-500 mb-3 flex items-center gap-1.5"><LinkIcon size={14}/> או הדבקת קישור לתמונה:</p>
                   <input value={imgUrl.startsWith('data') ? '' : imgUrl} onChange={e => setImgUrl(e.target.value)} placeholder="https://..." className="w-full bg-transparent outline-none text-sm font-medium text-circus-blue text-left text-slate-800" dir="ltr" />
                </div>
                <button type="submit" disabled={isSubmitting || !imgUrl || !fullName || !costumeName} className="btn-primary-circus py-6 text-2xl shadow-xl">אני בפנים! 🔥</button>
              </div>
            </div>
          </form>
        </div>
      ) : <div className="circus-card bg-circus-blue text-white p-12 rounded-[40px] text-center font-semibold text-3xl shadow-2xl mb-20 animate-pulse border-none">התחפושת נקלטה! מחכים להצבעה ✨</div>}

      <div className="flex items-center gap-4 mb-10 text-right"><Users className="text-circus-red w-10 h-10" /><h3 className="text-2xl font-bold text-slate-800 tracking-tight">המתמודדים בתחרות ({participants.length})</h3></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10 text-right">
        {participants.map(p => (
          <div key={p.id} className="circus-card group relative overflow-hidden bg-white shadow-lg border-2 border-slate-100 text-right">
            <div className="aspect-[3/4] overflow-hidden border-b-4 border-slate-50"><img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={p.name} /></div>
            <div className="p-6 text-right">
              <span className="font-semibold text-xl text-slate-700 truncate block">{p.name}</span>
              <span className="text-circus-red font-bold text-md mt-1 block">בתור: {p.costume}</span>
            </div>
            {onDelete && <button onClick={() => onDelete(p.id)} className="absolute top-4 right-4 bg-red-500 text-white p-3 rounded-2xl shadow-lg opacity-0 group-hover:opacity-100 transition-all scale-90 hover:scale-100"><Trash2 size={18} /></button>}
          </div>
        ))}
      </div>
    </div>
  );
};

const VotingPhase = ({ participants, myVote, onVote }) => {
  const update = (id, rank) => {
    const next = { ...myVote };
    if (next.first === id) next.first = null;
    if (next.second === id) next.second = null;
    if (next.third === id) next.third = null;
    next[rank] = id;
    onVote(next);
  };
  return (
    <div className="space-y-16 animate-in zoom-in-98 duration-500">
      <div className="grid grid-cols-3 gap-6">
         <VoteSlot label="מקום 1" p={participants.find(x => x.id === myVote.first)} color="border-[#facc15]" rank="🥇" />
         <VoteSlot label="מקום 2" p={participants.find(x => x.id === myVote.second)} color="border-slate-300" rank="🥈" />
         <VoteSlot label="מקום 3" p={participants.find(x => x.id === myVote.third)} color="border-orange-400" rank="🥉" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10 text-right">
        {participants.map(p => {
          const rankNum = myVote.first === p.id ? 1 : myVote.second === p.id ? 2 : myVote.third === p.id ? 3 : null;
          return (
            <div key={p.id} className={`circus-card relative group overflow-hidden border-4 transition-all ${rankNum ? 'border-circus-blue bg-circus-blue/5 scale-95 shadow-xl' : 'border-white'} text-right`}>
              <img src={p.imageUrl} className="aspect-[4/5] object-cover w-full" alt={p.name} />
              <div className="absolute inset-0 bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-all flex flex-col justify-center p-8 gap-5 text-right">
                <button onClick={() => update(p.id, 'first')} className="py-4 rounded-2xl bg-circus-yellow text-circus-red font-bold text-lg shadow-lg border-2 border-white/20">🥇 מקום 1</button>
                <button onClick={() => update(p.id, 'second')} className="py-4 rounded-2xl bg-white text-slate-800 font-bold text-lg shadow-lg border-2 border-slate-100 text-slate-800">🥈 מקום 2</button>
                <button onClick={() => update(p.id, 'third')} className="py-4 rounded-2xl bg-white text-slate-800 font-bold text-lg shadow-lg border-2 border-slate-100 text-slate-800">🥉 מקום 3</button>
              </div>
              <div className="p-4 text-right bg-white border-t border-slate-100">
                <span className="font-semibold text-lg text-slate-600 truncate block text-right">{p.name}</span>
                <span className="text-circus-red font-bold text-sm block text-right">בתור: {p.costume}</span>
              </div>
              {rankNum && <div className="absolute top-5 left-5 bg-circus-yellow text-circus-red w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-xl border-2 border-white">{rankNum}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const VoteSlot = ({ label, p, color, rank }) => (
  <div className={`flex flex-col items-center gap-4 p-6 circus-card border-b-8 ${color} bg-white shadow-lg`}>
    <div className="w-20 h-20 md:w-32 md:h-32 rounded-3xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center overflow-hidden shadow-inner relative">
      {p ? <img src={p.imageUrl} className="w-full h-full object-cover" /> : <span className="text-slate-200 text-5xl font-bold">?</span>}
      {p && <div className="absolute top-1 right-1 text-base">{rank}</div>}
    </div>
    <span className="text-base font-bold text-slate-500 uppercase tracking-widest">{label}</span>
    {p && <span className="text-[10px] font-bold text-slate-700 truncate max-w-full px-2 text-slate-800">{p.name}</span>}
  </div>
);

const ResultsPhase = ({ results, totalVotes }) => (
  <div className="space-y-24 animate-in fade-in duration-700 pb-24 text-center">
    <div className="flex justify-center items-end gap-5 md:gap-12 pt-20 px-4 text-center">
      {results[1] && <Podium p={results[1]} h="h-60" r="2" color="bg-slate-200" />}
      {results[0] && <Podium p={results[0]} h="h-80" r="1" main />}
      {results[2] && <Podium p={results[2]} h="h-44" r="3" color="bg-orange-200" />}
    </div>
    <div className="max-w-2xl mx-auto space-y-8 text-right px-4">
      <div className="flex items-center justify-center gap-4 mb-12 text-right"><Award className="text-circus-red w-12 h-12 text-right" /><h3 className="text-4xl font-bold text-slate-800 tracking-tight text-right">הדירוג הסופי</h3></div>
      {results.slice(3).map((r, i) => (
        <div key={r.id} className="flex justify-between items-center p-8 circus-card border-slate-100 bg-white shadow-lg text-right">
          <div className="flex items-center gap-8 text-right">
            <span className="text-slate-400 font-bold text-3xl w-12">#{i+4}</span>
            <img src={r.imageUrl} className="w-20 h-20 rounded-3xl object-cover border-2 border-slate-100 shadow-md" alt="" />
            <div className="flex flex-col text-right">
              <span className="font-semibold text-2xl text-slate-700 text-right">{r.name}</span>
              <span className="text-circus-red font-bold text-lg text-right">בתור: {r.costume}</span>
            </div>
          </div>
          <div className="bg-circus-red text-white px-6 py-3 rounded-3xl font-bold text-2xl border-2 border-white/20 shadow-lg">{r.score} נק'</div>
        </div>
      ))}
      <div className="text-center pt-20"><p className="text-slate-500 font-semibold text-lg tracking-wide bg-white/70 inline-block px-8 py-3 rounded-full border border-slate-200">סה"כ {totalVotes} מצביעים השתתפו בחגיגה</p></div>
    </div>
  </div>
);

const Podium = ({ p, h, r, main }) => (
  <div className={`flex flex-col items-center ${main ? 'w-64' : 'w-44'} text-center`}>
    {main && <Crown className="text-circus-yellow mb-5 animate-bounce drop-shadow-xl" size={72} />}
    <div className={`relative mb-10 ${main ? 'w-56 h-56' : 'w-40 h-40'}`}>
      <img src={p.imageUrl} className={`w-full h-full rounded-[60px] border-8 border-white shadow-2xl object-cover ${main ? 'ring-16 ring-circus-yellow/30' : ''}`} alt="" />
      <div className={`absolute -bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl font-bold text-4xl border-4 border-white ${main ? 'bg-circus-yellow text-circus-red' : 'bg-white text-slate-800'}`}>{r}</div>
    </div>
    <div className={`w-full ${h} podium-stand rounded-t-[60px] flex flex-col items-center pt-12 px-6 shadow-2xl text-center`}>
      <span className="font-bold text-white text-2xl md:text-3xl truncate w-full text-center z-10 block text-center">{p.name}</span>
      <span className="text-circus-yellow font-bold text-sm md:text-md truncate w-full text-center z-10 opacity-90 mt-1 block text-center">בתור: {p.costume}</span>
      <div className="bg-white/20 backdrop-blur px-6 py-2 rounded-2xl mt-4 z-10 border-2 border-white/20 shadow-lg inline-block text-center">
        <span className="text-white font-bold text-xl text-center">{p.score} נק'</span>
      </div>
    </div>
  </div>
);

export default App;