import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  Check,
  ChevronLeft,
  CirclePause,
  CirclePlay,
  Clock3,
  Home,
  Music2,
  Pencil,
  RotateCcw,
  Settings,
  ShoppingBag,
  Sprout,
  Trophy,
  X,
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "tama-study-timer-state-v1";
const FOCUS_PRESETS = [5, 15, 25, 45, 60];
const SUBJECTS = [
  { id: "math", label: "数学", icon: "quest-math.png" },
  { id: "english", label: "英語", icon: "quest-english.png" },
  { id: "science", label: "理科", icon: "quest-science.png" },
  { id: "social", label: "社会", icon: "quest-social.png" },
  { id: "japanese", label: "国語", icon: "quest-japanese.png" },
  { id: "free", label: "フリー", icon: "nav-quest.png" },
];
const OUTFITS = [
  { id: "outfit-n-1", name: "若葉の通学ワンピ", cost: 0 },
  { id: "outfit-n-2", name: "花色カーデコーデ", cost: 120 },
  { id: "outfit-n-3", name: "小さな庭仕事服", cost: 180 },
  { id: "outfit-r-1", name: "青空リボンドレス", cost: 260 },
  { id: "outfit-r-2", name: "星待ちラベンダー", cost: 360 },
  { id: "outfit-r-3", name: "夜色の魔法使い", cost: 460 },
  { id: "outfit-sr-1", name: "森の祝福ドレス", cost: 620 },
  { id: "outfit-sr-2", name: "水色星花ドレス", cost: 760 },
  { id: "outfit-sr-3", name: "春霞の花冠ドレス", cost: 900 },
];

function asset(path) {
  if (!path) return "";
  const clean = path.startsWith("/assets/") ? path.slice(1) : `assets/${path}`;
  return `${import.meta.env.BASE_URL}${clean}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function defaultState() {
  return {
    points: 0,
    totalMinutes: 0,
    todayMinutes: 0,
    today: todayKey(),
    streak: 0,
    selectedSubject: "math",
    selectedOutfitId: "outfit-n-1",
    unlockedOutfits: ["outfit-n-1"],
    sessions: [],
    timer: {
      mode: "focus",
      focusMinutes: 25,
      running: false,
      startedAt: null,
      elapsedBeforeStart: 0,
      lastDisplaySeconds: 25 * 60,
    },
  };
}

function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const today = todayKey();
  const sameDay = raw.today === today;
  const unlocked = Array.isArray(raw.unlockedOutfits) && raw.unlockedOutfits.length ? raw.unlockedOutfits : base.unlockedOutfits;
  const selectedOutfitId = unlocked.includes(raw.selectedOutfitId) ? raw.selectedOutfitId : unlocked[0] || "outfit-n-1";
  return {
    ...base,
    ...raw,
    today,
    todayMinutes: sameDay ? Number(raw.todayMinutes || 0) : 0,
    points: Math.max(0, Number(raw.points || 0)),
    totalMinutes: Math.max(0, Number(raw.totalMinutes || 0)),
    streak: Number(raw.streak || 0),
    selectedSubject: SUBJECTS.some((item) => item.id === raw.selectedSubject) ? raw.selectedSubject : "math",
    selectedOutfitId,
    unlockedOutfits: unlocked,
    sessions: Array.isArray(raw.sessions) ? raw.sessions.slice(0, 40) : [],
    timer: { ...base.timer, ...(raw.timer || {}) },
  };
}

function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return defaultState();
  }
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function displaySeconds(timer, nowTick) {
  const elapsedRunning = timer.running && timer.startedAt ? Math.floor((nowTick - timer.startedAt) / 1000) : 0;
  const elapsed = Math.max(0, Number(timer.elapsedBeforeStart || 0) + elapsedRunning);
  if (timer.mode === "free") return elapsed;
  return Math.max(0, Number(timer.focusMinutes || 25) * 60 - elapsed);
}

function elapsedSeconds(timer, nowTick) {
  const elapsedRunning = timer.running && timer.startedAt ? Math.floor((nowTick - timer.startedAt) / 1000) : 0;
  return Math.max(0, Number(timer.elapsedBeforeStart || 0) + elapsedRunning);
}

function rewardFor(minutes, mode) {
  const base = minutes * 2;
  const bonus = mode === "focus" && minutes >= 25 ? 10 : 0;
  return base + bonus;
}

function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState("home");
  const [nowTick, setNowTick] = useState(Date.now());
  const activeOutfit = OUTFITS.find((item) => item.id === state.selectedOutfitId) || OUTFITS[0];
  const selectedSubject = SUBJECTS.find((item) => item.id === state.selectedSubject) || SUBJECTS[0];
  const remainingOrElapsed = displaySeconds(state.timer, nowTick);
  const spentSeconds = elapsedSeconds(state.timer, nowTick);
  const progress = state.timer.mode === "focus"
    ? 1 - remainingOrElapsed / Math.max(1, state.timer.focusMinutes * 60)
    : Math.min(1, spentSeconds / (25 * 60));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (state.timer.mode === "focus" && state.timer.running && remainingOrElapsed <= 0) {
      completeSession();
    }
  }, [remainingOrElapsed, state.timer.mode, state.timer.running]);

  function updateTimer(nextTimer) {
    setState((current) => ({ ...current, timer: { ...current.timer, ...nextTimer } }));
  }

  function changeMode(mode) {
    setState((current) => ({
      ...current,
      timer: {
        ...current.timer,
        mode,
        running: false,
        startedAt: null,
        elapsedBeforeStart: 0,
        lastDisplaySeconds: mode === "focus" ? current.timer.focusMinutes * 60 : 0,
      },
    }));
  }

  function setFocusMinutes(minutes) {
    setState((current) => ({
      ...current,
      timer: {
        ...current.timer,
        focusMinutes: minutes,
        running: false,
        startedAt: null,
        elapsedBeforeStart: 0,
        lastDisplaySeconds: minutes * 60,
      },
    }));
  }

  function startTimer() {
    setState((current) => ({
      ...current,
      timer: {
        ...current.timer,
        running: true,
        startedAt: Date.now(),
      },
    }));
    setTab("timer");
  }

  function pauseTimer() {
    setState((current) => ({
      ...current,
      timer: {
        ...current.timer,
        running: false,
        elapsedBeforeStart: elapsedSeconds(current.timer, Date.now()),
        startedAt: null,
      },
    }));
  }

  function resetTimer() {
    setState((current) => ({
      ...current,
      timer: {
        ...current.timer,
        running: false,
        startedAt: null,
        elapsedBeforeStart: 0,
        lastDisplaySeconds: current.timer.mode === "focus" ? current.timer.focusMinutes * 60 : 0,
      },
    }));
  }

  function completeSession() {
    setState((current) => {
      if (!current.timer.running && elapsedSeconds(current.timer, Date.now()) === 0) return current;
      const seconds = elapsedSeconds(current.timer, Date.now());
      const minutes = Math.max(1, Math.round(seconds / 60));
      const reward = rewardFor(minutes, current.timer.mode);
      const session = {
        id: `${Date.now()}`,
        date: todayKey(),
        subject: current.selectedSubject,
        mode: current.timer.mode,
        minutes,
        reward,
        completedAt: new Date().toISOString(),
      };
      return {
        ...current,
        points: current.points + reward,
        todayMinutes: current.todayMinutes + minutes,
        totalMinutes: current.totalMinutes + minutes,
        streak: current.todayMinutes ? current.streak || 1 : Math.max(1, current.streak || 0),
        sessions: [session, ...current.sessions].slice(0, 40),
        timer: {
          ...current.timer,
          running: false,
          startedAt: null,
          elapsedBeforeStart: 0,
          lastDisplaySeconds: current.timer.mode === "focus" ? current.timer.focusMinutes * 60 : 0,
        },
      };
    });
    setTab("home");
  }

  function unlockOrSelect(outfit) {
    setState((current) => {
      const isUnlocked = current.unlockedOutfits.includes(outfit.id);
      if (isUnlocked) return { ...current, selectedOutfitId: outfit.id };
      if (current.points < outfit.cost) return current;
      return {
        ...current,
        points: current.points - outfit.cost,
        unlockedOutfits: [...current.unlockedOutfits, outfit.id],
        selectedOutfitId: outfit.id,
      };
    });
  }

  return (
    <main className="stage">
      <div className="showcase" aria-label="たまの勉強タイマー">
        <PhoneFrame className={tab === "timer" ? "timer-phone" : ""}>
          {tab === "home" && (
            <HomeScreen
              state={state}
              outfit={activeOutfit}
              subject={selectedSubject}
              progress={progress}
              setTab={setTab}
              startTimer={startTimer}
              setSubject={(id) => setState((current) => ({ ...current, selectedSubject: id }))}
            />
          )}
          {tab === "timer" && (
            <TimerScreen
              state={state}
              subject={selectedSubject}
              outfit={activeOutfit}
              displayValue={remainingOrElapsed}
              spentSeconds={spentSeconds}
              progress={progress}
              changeMode={changeMode}
              setFocusMinutes={setFocusMinutes}
              startTimer={startTimer}
              pauseTimer={pauseTimer}
              resetTimer={resetTimer}
              completeSession={completeSession}
              setTab={setTab}
            />
          )}
          {tab === "records" && <RecordsScreen state={state} setTab={setTab} />}
          {tab === "wardrobe" && (
            <WardrobeScreen
              state={state}
              outfits={OUTFITS}
              unlockOrSelect={unlockOrSelect}
              setTab={setTab}
            />
          )}
          <BottomNav active={tab} setTab={setTab} />
        </PhoneFrame>
      </div>
    </main>
  );
}

function PhoneFrame({ children, className = "" }) {
  return (
    <section className={`phone-frame ${className}`}>
      <Vines />
      {children}
    </section>
  );
}

function Vines() {
  return (
    <>
      <div className="vine vine-left" />
      <div className="vine vine-right" />
      <div className="flower flower-a">✤</div>
      <div className="flower flower-b">✿</div>
    </>
  );
}

function TopBar({ title, points, streak, onBack, rightIcon = "music", avatarSrc }) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="icon-button" type="button" onClick={onBack} aria-label="戻る">
          <ChevronLeft size={20} />
        </button>
      ) : (
        <span className="mini-avatar" style={{ backgroundImage: `url(${avatarSrc || asset("crops/protagonist.png")})` }} aria-hidden="true" />
      )}
      <strong>{title}</strong>
      <div className="top-pills">
        {typeof points === "number" && <span><Sprout size={15} />{points.toLocaleString()} pt</span>}
        {typeof streak === "number" && <span>💧 {streak || 0}</span>}
        {rightIcon === "music" && <button className="icon-button" type="button" aria-label="音"><Music2 size={18} /></button>}
      </div>
    </header>
  );
}

function HomeScreen({ state, outfit, subject, progress, setTab, startTimer, setSubject }) {
  return (
    <div className="screen home-screen">
      <TopBar title="たまの勉強タイマー" points={state.points} streak={state.streak} avatarSrc={asset("crops/protagonist.png")} />
      <section className="hero-card">
        <div className="hero-copy">
          <span>今日の勉強時間</span>
          <strong>{formatHours(state.todayMinutes)}</strong>
          <small>目標 04:00:00</small>
        </div>
        <div className="ring" style={{ "--progress": `${Math.round(progress * 360)}deg` }}>
          <Sprout size={30} />
        </div>
        <img className="home-character" src={asset(`avatar/full/${outfit.id}.png`)} alt="たま" />
      </section>
      <section className="subject-card">
        <div className="section-head">
          <b>今日やること</b>
          <button type="button" onClick={() => setTab("timer")}><Pencil size={15} />タイマー調整</button>
        </div>
        <div className="subject-row">
          {SUBJECTS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={state.selectedSubject === item.id ? "active" : ""}
              onClick={() => setSubject(item.id)}
            >
              <img src={asset(`crops/${item.icon}`)} alt="" />
              {item.label}
            </button>
          ))}
        </div>
      </section>
      <button className="start-button" type="button" onClick={startTimer}>
        <Clock3 size={22} />
        勉強をはじめる
      </button>
      <div className="quick-grid">
        <QuickTile icon={<BookOpen size={24} />} label="記録" onClick={() => setTab("records")} />
        <QuickTile icon={<Trophy size={24} />} label="ごほうび" onClick={() => setTab("wardrobe")} />
        <QuickTile icon={<ShoppingBag size={24} />} label="衣装" onClick={() => setTab("wardrobe")} />
        <QuickTile icon={<Settings size={24} />} label="設定" onClick={() => resetLocal()} />
      </div>
      <p className="soft-line">{subject.label}を少しだけ進めよう。完了するとポイントがもらえるよ。</p>
    </div>
  );
}

function QuickTile({ icon, label, onClick }) {
  return (
    <button className="quick-tile" type="button" onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function TimerScreen({
  state,
  subject,
  outfit,
  displayValue,
  spentSeconds,
  progress,
  changeMode,
  setFocusMinutes,
  startTimer,
  pauseTimer,
  resetTimer,
  completeSession,
  setTab,
}) {
  const isRunning = state.timer.running;
  return (
    <div className="screen timer-screen">
      <TopBar title="勉強中..." onBack={() => setTab("home")} rightIcon="music" />
      <div className="mode-switch">
        <button type="button" className={state.timer.mode === "focus" ? "active" : ""} onClick={() => changeMode("focus")}>集中</button>
        <button type="button" className={state.timer.mode === "free" ? "active" : ""} onClick={() => changeMode("free")}>自由計測</button>
      </div>
      {state.timer.mode === "focus" && (
        <div className="preset-row">
          {FOCUS_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={state.timer.focusMinutes === minutes ? "active" : ""}
              onClick={() => setFocusMinutes(minutes)}
            >
              {minutes}
            </button>
          ))}
        </div>
      )}
      <div className="task-pill">
        <img src={asset(`crops/${subject.icon}`)} alt="" />
        <span>{subject.label}の勉強をする</span>
        <Pencil size={16} />
      </div>
      <section className="focus-scene">
        <div className="timer-wreath" style={{ "--progress": `${Math.round(progress * 360)}deg` }}>
          <span>{formatTime(displayValue)}</span>
          <small>{state.timer.mode === "focus" ? "残り時間" : "経過時間"}</small>
        </div>
        <img className="desk-bg" src={asset("crops/home-bg.png")} alt="" />
        <img className="study-character" src={asset(`avatar/full/${outfit.id}.png`)} alt="勉強中のたま" />
      </section>
      <div className="timer-actions">
        {!isRunning ? (
          <button className="pill-action primary" type="button" onClick={startTimer}><CirclePlay size={19} />開始</button>
        ) : (
          <button className="pill-action primary" type="button" onClick={pauseTimer}><CirclePause size={19} />一時停止</button>
        )}
        <button className="pill-action" type="button" onClick={completeSession} disabled={spentSeconds < 10}><Check size={18} />完了</button>
        <button className="round-action" type="button" onClick={resetTimer} aria-label="リセット"><RotateCcw size={18} /></button>
      </div>
      <div className="bonus-card">
        <span><Sprout size={17} />集中ボーナス</span>
        <b>+{rewardFor(Math.max(1, Math.round(spentSeconds / 60)), state.timer.mode)} pt</b>
        <progress value={Math.min(100, Math.round(progress * 100))} max="100" />
      </div>
    </div>
  );
}

function RecordsScreen({ state, setTab }) {
  const totalToday = state.sessions.filter((session) => session.date === todayKey()).reduce((sum, session) => sum + session.minutes, 0);
  return (
    <div className="screen record-screen">
      <TopBar title="記録" points={state.points} onBack={() => setTab("home")} />
      <section className="record-summary">
        <div><span>今日</span><b>{totalToday}<small>分</small></b></div>
        <div><span>累計</span><b>{state.totalMinutes}<small>分</small></b></div>
        <div><span>ポイント</span><b>{state.points}<small>pt</small></b></div>
      </section>
      <div className="history-list">
        {state.sessions.length === 0 ? (
          <p className="empty">まだ記録はありません。最初の1回を気軽にはじめよう。</p>
        ) : state.sessions.map((session) => {
          const subject = SUBJECTS.find((item) => item.id === session.subject) || SUBJECTS[0];
          return (
            <article className="history-card" key={session.id}>
              <img src={asset(`crops/${subject.icon}`)} alt="" />
              <div>
                <strong>{subject.label}</strong>
                <span>{session.mode === "focus" ? "集中タイマー" : "自由計測"} / {session.minutes}分</span>
              </div>
              <b>+{session.reward} pt</b>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function WardrobeScreen({ state, outfits, unlockOrSelect, setTab }) {
  return (
    <div className="screen wardrobe-screen">
      <TopBar title="ごほうび" points={state.points} onBack={() => setTab("home")} />
      <div className="shop-tabs">
        <button className="active" type="button">おようふく</button>
        <button type="button">家具</button>
      </div>
      <div className="outfit-grid">
        {outfits.map((outfit) => {
          const unlocked = state.unlockedOutfits.includes(outfit.id);
          const selected = state.selectedOutfitId === outfit.id;
          const canBuy = state.points >= outfit.cost;
          return (
            <button
              className={`outfit-card ${selected ? "selected" : ""} ${!unlocked ? "locked" : ""}`}
              type="button"
              key={outfit.id}
              onClick={() => unlockOrSelect(outfit)}
            >
              <span className="zoom">⌕</span>
              <img src={asset(`crops/${outfit.id}.png`)} alt="" />
              <strong>{outfit.name}</strong>
              <small>{unlocked ? (selected ? "着用中" : "着る") : canBuy ? "解放する" : `${outfit.cost} pt`}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BottomNav({ active, setTab }) {
  const items = [
    { id: "home", label: "ホーム", icon: <Home size={20} /> },
    { id: "records", label: "記録", icon: <BookOpen size={20} /> },
    { id: "timer", label: "タイマー", icon: <Clock3 size={20} /> },
    { id: "wardrobe", label: "ショップ", icon: <ShoppingBag size={20} /> },
  ];
  return (
    <nav className="bottom-nav">
      {items.map((item) => (
        <button key={item.id} className={active === item.id ? "active" : ""} type="button" onClick={() => setTab(item.id)}>
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function formatHours(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

function resetLocal() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

createRoot(document.getElementById("root")).render(<App />);
