import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { registerServiceWorker } from "./registerServiceWorker";
import {
  BookOpen,
  Check,
  ChevronLeft,
  CirclePause,
  CirclePlay,
  Clock3,
  Home,
  Music2,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  ShoppingBag,
  Sprout,
  Trash2,
  Trophy,
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "tama-study-timer-state-v1";
const MAX_STORED_SESSIONS = 365;
const FOCUS_PRESETS = [5, 15, 25, 45, 60];
const STUDY_BGM_TRACKS = [
  "audio/study-bgm-1.mp3",
  "audio/study-bgm-2.mp3",
  "audio/study-bgm-3.mp3",
  "audio/study-bgm-4.mp3",
].map(asset);
const DEFAULT_SUBJECTS = [
  { id: "math", label: "数学", icon: "quest-math.png", color: "#7f985e" },
  { id: "english", label: "英語", icon: "quest-english.png", color: "#7aa6bd" },
  { id: "science", label: "理科", icon: "quest-science.png", color: "#d8b85a" },
  { id: "social", label: "社会", icon: "quest-social.png", color: "#c98766" },
  { id: "japanese", label: "国語", icon: "quest-japanese.png", color: "#d78b9f" },
  { id: "free", label: "フリー", icon: "nav-quest.png", color: "#9aa897" },
];
const DEFAULT_CHART_COLORS = {
  math: "#7f985e",
  english: "#7aa6bd",
  science: "#d8b85a",
  social: "#c98766",
  japanese: "#d78b9f",
  free: "#9aa897",
};
const CHART_COLOR_SWATCHES = [
  "#7f985e",
  "#7aa6bd",
  "#d8b85a",
  "#c98766",
  "#d78b9f",
  "#9aa897",
  "#b49bd4",
  "#8f7b67",
];
const OUTFITS = [
  { id: "outfit-n-1", name: "森の勉強服", cost: 0 },
  { id: "outfit-n-2", name: "やさしいカーデ", cost: 400 },
  { id: "outfit-n-3", name: "リボンワンピース", cost: 600 },
  { id: "outfit-r-1", name: "ナチュラルワンピ", cost: 450 },
];
const DEFAULT_OUTFIT_ID = "outfit-n-1";
const OUTFIT_IDS = new Set(OUTFITS.map((outfit) => outfit.id));
const STUDY_IMAGES = {
  "outfit-n-1": "study/full/outfit-n-1.png",
  "outfit-n-2": "study/full/outfit-n-2.png",
  "outfit-n-3": "study/full/outfit-n-3.png",
  "outfit-r-1": "study/full/outfit-r-1.png",
};

function studyImageFor(outfitId) {
  return STUDY_IMAGES[outfitId] || STUDY_IMAGES["outfit-n-1"];
}

function asset(path) {
  if (!path) return "";
  const clean = path.startsWith("/assets/") ? path.slice(1) : `assets/${path}`;
  return `${import.meta.env.BASE_URL}${clean}`;
}

function todayKey() {
  return dateKeyFor(new Date());
}

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function defaultState() {
  return {
    points: 0,
    totalMinutes: 0,
    todayMinutes: 0,
    today: todayKey(),
    streak: 0,
    selectedSubject: "math",
    subjects: DEFAULT_SUBJECTS,
    selectedOutfitId: DEFAULT_OUTFIT_ID,
    unlockedOutfits: [DEFAULT_OUTFIT_ID],
    sessions: [],
    timer: {
      mode: "focus",
      focusMinutes: 25,
      running: false,
      startedAt: null,
      elapsedBeforeStart: 0,
      lastDisplaySeconds: 25 * 60,
    },
    sound: {
      bgm: false,
      alarm: true,
    },
    chartSettings: {
      visibleSubjects: DEFAULT_SUBJECTS.map((subject) => subject.id),
      colors: DEFAULT_CHART_COLORS,
    },
  };
}

function normalizeSubjects(rawSubjects) {
  if (!Array.isArray(rawSubjects) || rawSubjects.length === 0) {
    return DEFAULT_SUBJECTS;
  }
  const seen = new Set();
  const subjects = rawSubjects
    .map((subject, index) => {
      const defaultSubject = DEFAULT_SUBJECTS.find((item) => item.id === subject?.id);
      const id = typeof subject?.id === "string" && subject.id.trim()
        ? subject.id.trim().replace(/[^a-zA-Z0-9_-]/g, "-")
        : `custom-${Date.now()}-${index}`;
      if (seen.has(id)) return null;
      seen.add(id);
      const label = typeof subject?.label === "string" && subject.label.trim()
        ? subject.label.trim().slice(0, 12)
        : defaultSubject?.label || `項目${index + 1}`;
      const icon = typeof subject?.icon === "string" && subject.icon.trim()
        ? subject.icon
        : defaultSubject?.icon || "nav-quest.png";
      const color = isHexColor(subject?.color)
        ? subject.color
        : defaultSubject?.color || CHART_COLOR_SWATCHES[index % CHART_COLOR_SWATCHES.length];
      return { id, label, icon, color };
    })
    .filter(Boolean)
    .slice(0, 12);
  return subjects.length ? subjects : DEFAULT_SUBJECTS;
}

function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const today = todayKey();
  const sameDay = raw.today === today;
  const subjects = normalizeSubjects(raw.subjects);
  const rawUnlocked = Array.isArray(raw.unlockedOutfits) && raw.unlockedOutfits.length ? raw.unlockedOutfits : base.unlockedOutfits;
  const unlocked = rawUnlocked.filter((id) => OUTFIT_IDS.has(id));
  if (!unlocked.includes(DEFAULT_OUTFIT_ID)) unlocked.unshift(DEFAULT_OUTFIT_ID);
  const selectedOutfitId = unlocked.includes(raw.selectedOutfitId) ? raw.selectedOutfitId : unlocked[0] || DEFAULT_OUTFIT_ID;
  return {
    ...base,
    ...raw,
    today,
    todayMinutes: sameDay ? Number(raw.todayMinutes || 0) : 0,
    points: Math.max(0, Number(raw.points || 0)),
    totalMinutes: Math.max(0, Number(raw.totalMinutes || 0)),
    streak: Number(raw.streak || 0),
    subjects,
    selectedSubject: subjects.some((item) => item.id === raw.selectedSubject) ? raw.selectedSubject : subjects[0].id,
    selectedOutfitId,
    unlockedOutfits: unlocked,
    sessions: Array.isArray(raw.sessions) ? raw.sessions.slice(0, MAX_STORED_SESSIONS) : [],
    timer: { ...base.timer, ...(raw.timer || {}) },
    sound: { ...base.sound, ...(raw.sound || {}) },
    chartSettings: normalizeChartSettings(raw.chartSettings, subjects, base.chartSettings),
  };
}

function normalizeChartSettings(settings, subjects = DEFAULT_SUBJECTS, baseSettings = defaultState().chartSettings) {
  const visible = Array.isArray(settings?.visibleSubjects)
    ? settings.visibleSubjects.filter((id) => subjects.some((subject) => subject.id === id))
    : baseSettings.visibleSubjects.filter((id) => subjects.some((subject) => subject.id === id));
  const colors = Object.fromEntries(subjects.map((subject) => [subject.id, subject.color]));
  if (settings?.colors && typeof settings.colors === "object") {
    subjects.forEach((subject) => {
      const color = settings.colors[subject.id];
      if (isHexColor(color)) {
        colors[subject.id] = color;
      }
    });
  }
  return {
    visibleSubjects: visible.length ? visible : [subjects[0].id],
    colors,
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

function formatHours(totalMinutes) {
  const safe = Math.max(0, Math.round(totalMinutes || 0));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
}

function formatChartTotal(totalMinutes) {
  const safe = Math.max(0, Math.round(totalMinutes || 0));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (!hours) return `${minutes}分`;
  if (!minutes) return `${hours}時間`;
  return `${hours}時間${minutes}分`;
}

function dateKeyFor(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function startOfWeek(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

function addWeeks(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount * 7);
  next.setHours(0, 0, 0, 0);
  return next;
}

function sameDateKey(left, right) {
  return dateKeyFor(left) === dateKeyFor(right);
}

function formatWeekRange(weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return `${formatMonthDay(weekStart)} - ${formatMonthDay(weekEnd)}`;
}

function buildWeeklyChart(sessions, subjects, weekStart) {
  const start = startOfWeek(weekStart);
  const labels = ["月", "火", "水", "木", "金", "土", "日"];
  const days = labels.map((label, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      label,
      date: dateKeyFor(date),
      dateLabel: formatMonthDay(date),
      total: 0,
      subjects: Object.fromEntries(subjects.map((subject) => [subject.id, 0])),
    };
  });
  sessions.forEach((session) => {
    const day = days.find((item) => item.date === session.date);
    if (!day || !Object.prototype.hasOwnProperty.call(day.subjects, session.subject)) return;
    const minutes = Math.max(0, Number(session.minutes || 0));
    day.subjects[session.subject] += minutes;
    day.total += minutes;
  });
  return days;
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

function createAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState("home");
  const [nowTick, setNowTick] = useState(Date.now());
  const [soundPanelOpen, setSoundPanelOpen] = useState(false);
  const audioContextRef = useRef(null);
  const bgmAudioRef = useRef(null);
  const bgmTrackIndexRef = useRef(0);
  const wakeLockRef = useRef(null);
  const previousSessionCountRef = useRef(state.sessions.length);
  const activeOutfit = OUTFITS.find((item) => item.id === state.selectedOutfitId) || OUTFITS[0];
  const subjects = state.subjects?.length ? state.subjects : DEFAULT_SUBJECTS;
  const selectedSubject = subjects.find((item) => item.id === state.selectedSubject) || subjects[0];
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

  useEffect(() => {
    if (state.sound?.bgm && state.timer.running && tab === "timer") {
      startBgm();
    } else {
      stopBgm();
    }
  }, [state.sound?.bgm, state.timer.running, tab]);

  useEffect(() => {
    if (state.sessions.length > previousSessionCountRef.current && state.sound?.alarm) {
      playAlarm();
    }
    previousSessionCountRef.current = state.sessions.length;
  }, [state.sessions.length, state.sound?.alarm]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && state.sound?.bgm && state.timer.running && tab === "timer") {
        startBgm();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [state.sound?.bgm, state.timer.running, tab]);

  useEffect(() => () => {
    stopBgm();
    releaseWakeLock();
  }, []);

  function ensureAudioContext() {
    if (!audioContextRef.current) {
      audioContextRef.current = createAudioContext();
    }
    if (audioContextRef.current?.state === "suspended") {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }

  function ensureBgmAudio() {
    if (!bgmAudioRef.current) {
      const audio = new Audio(STUDY_BGM_TRACKS[bgmTrackIndexRef.current]);
      audio.loop = false;
      audio.volume = 0.28;
      audio.preload = "auto";
      audio.addEventListener("ended", () => {
        bgmTrackIndexRef.current = (bgmTrackIndexRef.current + 1) % STUDY_BGM_TRACKS.length;
        audio.src = STUDY_BGM_TRACKS[bgmTrackIndexRef.current];
        audio.play().catch(() => {
          // Mobile browsers can pause background media until the page is active again.
        });
      });
      bgmAudioRef.current = audio;
    }
    return bgmAudioRef.current;
  }

  function startBgm() {
    ensureAudioContext();
    const audio = ensureBgmAudio();
    requestWakeLock();
    audio.play().catch(() => {
      // Mobile browsers require a user gesture before audio can start.
    });
  }

  function stopBgm() {
    const audio = bgmAudioRef.current;
    if (audio) audio.pause();
    releaseWakeLock();
  }

  async function requestWakeLock() {
    if (!("wakeLock" in navigator) || wakeLockRef.current || document.visibilityState !== "visible") return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      wakeLockRef.current.addEventListener("release", () => {
        wakeLockRef.current = null;
      });
    } catch {
      wakeLockRef.current = null;
    }
  }

  function releaseWakeLock() {
    const lock = wakeLockRef.current;
    wakeLockRef.current = null;
    lock?.release?.().catch(() => {});
  }

  function playAlarm() {
    const context = ensureAudioContext();
    if (!context) return;
    [0, 0.16, 0.34].forEach((offset, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = [784, 988, 1318][index];
      gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(context.currentTime + offset);
      oscillator.stop(context.currentTime + offset + 0.24);
    });
  }

  function updateSound(nextSound) {
    setState((current) => ({ ...current, sound: { ...current.sound, ...nextSound } }));
  }

  function toggleSoundPanel() {
    ensureAudioContext();
    setSoundPanelOpen((open) => !open);
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
        sessions: [session, ...current.sessions].slice(0, MAX_STORED_SESSIONS),
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

  function updateChartSettings(nextSettings) {
    setState((current) => ({
      ...current,
      chartSettings: normalizeChartSettings({
        ...current.chartSettings,
        ...nextSettings,
        colors: { ...current.chartSettings?.colors, ...nextSettings.colors },
      }, current.subjects || DEFAULT_SUBJECTS),
    }));
  }

  function updateSubject(subjectId, changes) {
    setState((current) => {
      const subjects = normalizeSubjects(current.subjects).map((subject) => (
        subject.id === subjectId ? { ...subject, ...changes } : subject
      ));
      const chartSettings = normalizeChartSettings({
        ...current.chartSettings,
        colors: {
          ...current.chartSettings?.colors,
          ...(changes.color ? { [subjectId]: changes.color } : {}),
        },
      }, subjects);
      return { ...current, subjects, chartSettings };
    });
  }

  function addSubject() {
    setState((current) => {
      const subjects = normalizeSubjects(current.subjects);
      if (subjects.length >= 12) return current;
      const nextIndex = subjects.length + 1;
      const color = CHART_COLOR_SWATCHES[subjects.length % CHART_COLOR_SWATCHES.length];
      const subject = {
        id: `custom-${Date.now()}`,
        label: `項目${nextIndex}`,
        icon: "nav-quest.png",
        color,
      };
      const nextSubjects = [...subjects, subject];
      return {
        ...current,
        subjects: nextSubjects,
        selectedSubject: subject.id,
        chartSettings: normalizeChartSettings({
          ...current.chartSettings,
          visibleSubjects: [...(current.chartSettings?.visibleSubjects || []), subject.id],
          colors: { ...current.chartSettings?.colors, [subject.id]: color },
        }, nextSubjects),
      };
    });
  }

  function deleteSubject(subjectId) {
    setState((current) => {
      const subjects = normalizeSubjects(current.subjects);
      if (subjects.length <= 1) return current;
      const nextSubjects = subjects.filter((subject) => subject.id !== subjectId);
      if (nextSubjects.length === subjects.length) return current;
      const selectedSubject = current.selectedSubject === subjectId ? nextSubjects[0].id : current.selectedSubject;
      return {
        ...current,
        subjects: nextSubjects,
        selectedSubject,
        chartSettings: normalizeChartSettings({
          ...current.chartSettings,
          visibleSubjects: (current.chartSettings?.visibleSubjects || []).filter((id) => id !== subjectId),
        }, nextSubjects),
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
              subjects={subjects}
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
              sound={state.sound}
              soundPanelOpen={soundPanelOpen}
              toggleSoundPanel={toggleSoundPanel}
              updateSound={updateSound}
              playAlarm={playAlarm}
            />
          )}
          {tab === "records" && <RecordsScreen state={state} subjects={subjects} setTab={setTab} updateChartSettings={updateChartSettings} />}
          {tab === "subjects" && (
            <SubjectEditScreen
              state={state}
              subjects={subjects}
              setTab={setTab}
              updateSubject={updateSubject}
              addSubject={addSubject}
              deleteSubject={deleteSubject}
            />
          )}
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

function TopBar({ title, points, onBack, rightIcon = "music", avatarSrc, onSoundClick, soundEnabled }) {
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
        {rightIcon === "music" && onSoundClick && (
          <button className={`icon-button ${soundEnabled ? "active" : ""}`} type="button" aria-label="音" onClick={onSoundClick}>
            <Music2 size={18} />
          </button>
        )}
      </div>
    </header>
  );
}

function HomeScreen({ state, subjects, outfit, subject, progress, setTab, startTimer, setSubject }) {
  return (
    <div className="screen home-screen">
      <TopBar title="たまの勉強タイマー" points={state.points} avatarSrc={asset(`avatar/full/${outfit.id}.png`)} />
      <section className="hero-card" style={{ "--hero-room-bg": `url(${asset("crops/home-bg.png")})` }}>
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
          <button type="button" onClick={() => setTab("subjects")}><Pencil size={15} />項目編集</button>
        </div>
        <div className="subject-row">
          {subjects.map((item) => (
            <button
              key={item.id}
              type="button"
              className={state.selectedSubject === item.id ? "active" : ""}
              style={{ "--subject-color": item.color }}
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
  sound,
  soundPanelOpen,
  toggleSoundPanel,
  updateSound,
  playAlarm,
}) {
  const isRunning = state.timer.running;
  return (
    <div className="screen timer-screen">
      <header className="timer-header">
        <button className="icon-button" type="button" onClick={() => setTab("home")} aria-label="戻る">
          <ChevronLeft size={20} />
        </button>
        <button className="task-pill top-task-pill" type="button">
          <img src={asset(`crops/${subject.icon}`)} alt="" />
          <span>{subject.label}の勉強をする</span>
          <Pencil size={16} />
        </button>
        <button className={`icon-button ${sound?.bgm || sound?.alarm ? "active" : ""}`} type="button" aria-label="音" onClick={toggleSoundPanel}>
          <Music2 size={18} />
        </button>
      </header>
      {soundPanelOpen && (
        <section className="sound-panel">
          <label>
            <input
              type="checkbox"
              checked={Boolean(sound?.bgm)}
              onChange={(event) => updateSound({ bgm: event.target.checked })}
            />
            勉強用BGM
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(sound?.alarm)}
              onChange={(event) => updateSound({ alarm: event.target.checked })}
            />
            完了アラーム
          </label>
          <button type="button" onClick={playAlarm}>試す</button>
        </section>
      )}
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
      <section className="focus-scene">
        <div className="timer-wreath" style={{ "--progress": `${Math.round(progress * 360)}deg` }}>
          <span>{formatTime(displayValue)}</span>
          <small>{state.timer.mode === "focus" ? "残り時間" : "経過時間"}</small>
        </div>
        <img className="desk-bg" src={asset("crops/home-bg.png")} alt="" />
        <img className="study-character" src={asset(studyImageFor(outfit.id))} alt={`${outfit.name}で勉強するたま`} />
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

function SubjectEditScreen({ state, subjects, setTab, updateSubject, addSubject, deleteSubject }) {
  return (
    <div className="screen subject-edit-screen">
      <TopBar title="項目編集" points={state.points} onBack={() => setTab("home")} />
      <section className="subject-editor-card">
        <div className="editor-head">
          <div>
            <b>今日やること</b>
            <small>名前と色を変えられます</small>
          </div>
          <button type="button" onClick={addSubject} disabled={subjects.length >= 12}>
            <Plus size={16} />
            追加
          </button>
        </div>
        <div className="subject-edit-list">
          {subjects.map((subject) => (
            <article className="subject-edit-row" key={subject.id}>
              <img src={asset(`crops/${subject.icon}`)} alt="" />
              <label>
                <span>項目名</span>
                <input
                  type="text"
                  value={subject.label}
                  maxLength={12}
                  onChange={(event) => updateSubject(subject.id, { label: event.target.value })}
                  aria-label={`${subject.label}の名前`}
                />
              </label>
              <label className="subject-color-field" style={{ "--subject-color": subject.color }}>
                <span>色</span>
                <input
                  type="color"
                  value={subject.color}
                  onChange={(event) => updateSubject(subject.id, { color: event.target.value })}
                  aria-label={`${subject.label}の色`}
                />
              </label>
              <button
                className="delete-subject-button"
                type="button"
                onClick={() => deleteSubject(subject.id)}
                disabled={subjects.length <= 1}
                aria-label={`${subject.label}を削除`}
              >
                <Trash2 size={17} />
              </button>
            </article>
          ))}
        </div>
      </section>
      <button className="start-button compact" type="button" onClick={() => setTab("home")}>
        <Check size={20} />
        完了
      </button>
    </div>
  );
}

function RecordsScreen({ state, subjects, setTab, updateChartSettings }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [visibleWeekStart, setVisibleWeekStart] = useState(() => startOfWeek(new Date()));
  const totalToday = state.sessions.filter((session) => session.date === todayKey()).reduce((sum, session) => sum + session.minutes, 0);
  const currentWeekStart = startOfWeek(new Date());
  const isCurrentWeek = sameDateKey(visibleWeekStart, currentWeekStart);
  const weekDays = buildWeeklyChart(state.sessions, subjects, visibleWeekStart);
  const visibleSubjects = subjects.filter((subject) => state.chartSettings.visibleSubjects.includes(subject.id));
  const visibleTotals = weekDays.map((day) => visibleSubjects.reduce((sum, subject) => sum + day.subjects[subject.id], 0));
  const maxDayTotal = Math.max(60, ...visibleTotals);
  const weekTotal = visibleTotals.reduce((sum, minutes) => sum + minutes, 0);

  function toggleChartSubject(subjectId) {
    const current = state.chartSettings.visibleSubjects;
    const next = current.includes(subjectId)
      ? current.filter((id) => id !== subjectId)
      : [...current, subjectId];
    updateChartSettings({ visibleSubjects: next.length ? next : [subjectId] });
  }

  function resetChartSettings() {
    updateChartSettings({
      visibleSubjects: subjects.map((subject) => subject.id),
    });
  }

  function moveWeek(amount) {
    setVisibleWeekStart((current) => {
      const next = addWeeks(current, amount);
      return next > currentWeekStart ? currentWeekStart : next;
    });
  }

  return (
    <div className="screen record-screen">
      <TopBar title="記録" points={state.points} onBack={() => setTab("home")} />
      <section className="record-summary">
        <div><span>今日</span><b>{totalToday}<small>分</small></b></div>
        <div><span>累計</span><b>{state.totalMinutes}<small>分</small></b></div>
        <div><span>ポイント</span><b>{state.points}<small>pt</small></b></div>
      </section>
      <section className="weekly-chart-card">
        <div className="chart-head">
          <div>
            <span><BookOpen size={16} />今週の勉強時間</span>
            <small>{formatWeekRange(visibleWeekStart)}</small>
            <b>{formatChartTotal(weekTotal)}</b>
          </div>
          <button className="chart-settings-button" type="button" onClick={() => setSettingsOpen(true)}>
            <SlidersHorizontal size={15} />
            表示設定
          </button>
        </div>
        <div className="week-nav" aria-label="表示する週">
          <button type="button" onClick={() => moveWeek(-1)}>前の週</button>
          <button type="button" onClick={() => setVisibleWeekStart(currentWeekStart)} disabled={isCurrentWeek}>今週</button>
          <button type="button" onClick={() => moveWeek(1)} disabled={isCurrentWeek}>次の週</button>
        </div>
        <div className="weekly-chart" aria-label="1週間分の勉強時間">
          <div className="chart-grid-lines" aria-hidden="true">
            <span>2h</span>
            <span>1h</span>
            <span>0</span>
          </div>
          <div className="chart-bars">
            {weekDays.map((day) => {
              const dayTotal = visibleSubjects.reduce((sum, subject) => sum + day.subjects[subject.id], 0);
              return (
                <div className="chart-day" key={day.date}>
                  <div className="chart-bar-track">
                    <div className="chart-stack" style={{ height: `${Math.max(dayTotal ? 8 : 0, (dayTotal / maxDayTotal) * 100)}%` }}>
                      {visibleSubjects.map((subject) => {
                        const minutes = day.subjects[subject.id];
                        if (!minutes) return null;
                        return (
                          <span
                            key={subject.id}
                            className="chart-segment"
                            style={{
                              "--segment-color": state.chartSettings.colors[subject.id],
                              flexGrow: minutes,
                            }}
                            title={`${subject.label} ${minutes}分`}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <span className="chart-day-label">
                    <b>{day.label}</b>
                    <small>{day.dateLabel}</small>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="chart-legend">
          {visibleSubjects.map((subject) => (
            <span key={subject.id}>
              <i style={{ background: state.chartSettings.colors[subject.id] }} />
              {subject.label}
            </span>
          ))}
        </div>
      </section>
      {settingsOpen && (
        <div className="chart-settings-overlay" role="dialog" aria-modal="true" aria-label="表示設定">
          <button className="settings-scrim" type="button" aria-label="閉じる" onClick={() => setSettingsOpen(false)} />
          <section className="chart-settings-sheet">
            <div className="sheet-head">
              <div>
                <span><Palette size={16} />表示設定</span>
                <small>グラフに表示する教科を選べます</small>
              </div>
              <button className="icon-button" type="button" onClick={() => setSettingsOpen(false)} aria-label="閉じる">
                <Check size={18} />
              </button>
            </div>
            <div className="subject-settings-list">
              {subjects.map((subject) => {
                const checked = state.chartSettings.visibleSubjects.includes(subject.id);
                return (
                  <button
                    className={checked ? "subject-setting-row active" : "subject-setting-row"}
                    type="button"
                    key={subject.id}
                    onClick={() => toggleChartSubject(subject.id)}
                  >
                    <span className={`setting-check ${checked ? "checked" : ""}`}>
                      {checked && <Check size={13} />}
                    </span>
                    <img src={asset(`crops/${subject.icon}`)} alt="" />
                    <strong>{subject.label}</strong>
                    <span className="color-chip" style={{ background: state.chartSettings.colors[subject.id] }} />
                  </button>
                );
              })}
            </div>
            <div className="sheet-actions">
              <button type="button" onClick={resetChartSettings}>すべて表示</button>
              <button className="primary" type="button" onClick={() => setSettingsOpen(false)}>保存</button>
            </div>
          </section>
        </div>
      )}
      <div className="history-list">
        {state.sessions.length === 0 ? (
          <p className="empty">まだ記録はありません。最初の1回を気軽にはじめよう。</p>
        ) : state.sessions.map((session) => {
          const subject = subjects.find((item) => item.id === session.subject) || { label: "削除済み", icon: "nav-quest.png" };
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
  const [purchaseOutfit, setPurchaseOutfit] = useState(null);
  const [previewOutfit, setPreviewOutfit] = useState(null);
  const purchaseUnlocked = purchaseOutfit ? state.unlockedOutfits.includes(purchaseOutfit.id) : false;
  const purchaseCanBuy = purchaseOutfit ? state.points >= purchaseOutfit.cost : false;

  function handleOutfitTap(outfit) {
    if (state.unlockedOutfits.includes(outfit.id)) {
      unlockOrSelect(outfit);
      return;
    }
    setPurchaseOutfit(outfit);
  }

  function confirmPurchase() {
    if (!purchaseOutfit || !purchaseCanBuy || purchaseUnlocked) return;
    unlockOrSelect(purchaseOutfit);
    setPurchaseOutfit(null);
  }

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
              onClick={() => handleOutfitTap(outfit)}
            >
              <span
                className="zoom"
                role="button"
                tabIndex={0}
                aria-label={`${outfit.name}を大きく表示`}
                onClick={(event) => {
                  event.stopPropagation();
                  setPreviewOutfit(outfit);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    setPreviewOutfit(outfit);
                  }
                }}
              >
                ⌕
              </span>
              <img src={asset(`crops/${outfit.id}.png`)} alt="" />
              <strong>{outfit.name}</strong>
              <small>
                {unlocked ? (selected ? "着用中" : "着る") : canBuy ? "購入する" : `${outfit.cost} pt`}
              </small>
            </button>
          );
        })}
      </div>
      {purchaseOutfit && (
        <div className="purchase-overlay" role="dialog" aria-modal="true" aria-label="購入確認">
          <button className="purchase-scrim" type="button" aria-label="閉じる" onClick={() => setPurchaseOutfit(null)} />
          <section className="purchase-dialog">
            <img src={asset(`crops/${purchaseOutfit.id}.png`)} alt="" />
            <div>
              <span>{purchaseOutfit.name}</span>
              <strong>{purchaseOutfit.cost.toLocaleString()}ptで購入しますか？</strong>
              {!purchaseCanBuy && <small>ポイントが足りません</small>}
            </div>
            <div className="purchase-actions">
              <button type="button" onClick={() => setPurchaseOutfit(null)}>キャンセル</button>
              <button className="primary" type="button" onClick={confirmPurchase} disabled={!purchaseCanBuy}>
                購入する
              </button>
            </div>
          </section>
        </div>
      )}
      {previewOutfit && (
        <div className="outfit-preview-overlay" role="dialog" aria-modal="true" aria-label={`${previewOutfit.name}の拡大表示`}>
          <button className="preview-scrim" type="button" aria-label="閉じる" onClick={() => setPreviewOutfit(null)} />
          <section className="outfit-preview-dialog">
            <button className="icon-button preview-close" type="button" aria-label="閉じる" onClick={() => setPreviewOutfit(null)}>
              ×
            </button>
            <img src={asset(`crops/${previewOutfit.id}.png`)} alt={previewOutfit.name} />
            <strong>{previewOutfit.name}</strong>
          </section>
        </div>
      )}
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

function resetLocal() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}

createRoot(document.getElementById("root")).render(<App />);
registerServiceWorker();
