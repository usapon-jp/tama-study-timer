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
  Shirt,
  SlidersHorizontal,
  ShoppingBag,
  Sprout,
  Trash2,
  Trophy,
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "tama-study-timer-state-v1";
const MAX_STORED_SESSIONS = 365;
const FOCUS_PRESETS = [5, 20, 40, 60];
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
  { id: "free", label: "フリー", icon: "quest-free.png", color: "#9aa897" },
];
const DEFAULT_CHART_COLORS = {
  math: "#7f985e",
  english: "#7aa6bd",
  science: "#d8b85a",
  social: "#c98766",
  japanese: "#d78b9f",
  free: "#9aa897",
};
const DEFAULT_DAILY_GOAL_MINUTES = 240;
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
const BASIC_SUBJECT_COLORS = DEFAULT_SUBJECTS.map((subject) => subject.color);
const SUBJECT_ICON_OPTIONS = [
  { icon: "quest-math.png", label: "数学" },
  { icon: "quest-english.png", label: "英語" },
  { icon: "quest-science.png", label: "理科" },
  { icon: "quest-social.png", label: "社会" },
  { icon: "quest-japanese.png", label: "国語" },
  { icon: "quest-free.png", label: "フリー" },
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
const SUBJECT_ICON_VERSION = "20260525-subject-icons";

function studyImageFor(outfitId) {
  return STUDY_IMAGES[outfitId] || STUDY_IMAGES["outfit-n-1"];
}

function asset(path) {
  if (!path) return "";
  const clean = path.startsWith("/assets/") ? path.slice(1) : `assets/${path}`;
  return `${import.meta.env.BASE_URL}${clean}`;
}

function subjectIconSrc(icon) {
  return `${asset(`crops/${icon}`)}?v=${SUBJECT_ICON_VERSION}`;
}

function todayKey() {
  return dateKeyFor(new Date());
}

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function defaultState() {
  return {
    appName: "たまの勉強タイマー",
    points: 0,
    timerOffset: { x: 0, y: 0 },
    characterOffset: { x: 0, y: 0 },
    totalMinutes: 0,
    todayMinutes: 0,
    dailyGoalMinutes: DEFAULT_DAILY_GOAL_MINUTES,
    today: todayKey(),
    streak: 0,
    selectedSubject: "math",
    subjects: DEFAULT_SUBJECTS,
    selectedOutfitId: DEFAULT_OUTFIT_ID,
    unlockedOutfits: [DEFAULT_OUTFIT_ID],
    sessions: [],
    timer: {
      mode: "focus",
      focusMinutes: 20,
      running: false,
      startedAt: null,
      elapsedBeforeStart: 0,
      lastDisplaySeconds: 20 * 60,
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
      const rawIcon = typeof subject?.icon === "string" && subject.icon.trim()
        ? subject.icon
        : defaultSubject?.icon || "nav-quest.png";
      const icon = defaultSubject && subject.id === defaultSubject.id && rawIcon === "nav-quest.png"
        ? defaultSubject.icon
        : rawIcon;
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
    appName: typeof raw.appName === "string" && raw.appName.trim() ? raw.appName.trim().slice(0, 30) : base.appName,
    timerOffset: raw.timerOffset && typeof raw.timerOffset.x === "number" && typeof raw.timerOffset.y === "number" ? raw.timerOffset : { x: 0, y: 0 },
    characterOffset: raw.characterOffset && typeof raw.characterOffset.x === "number" && typeof raw.characterOffset.y === "number" ? raw.characterOffset : { x: 0, y: 0 },
    today,
    todayMinutes: sameDay ? Number(raw.todayMinutes || 0) : 0,
    dailyGoalMinutes: normalizeGoalMinutes(raw.dailyGoalMinutes),
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

function normalizeGoalMinutes(value) {
  const minutes = Math.round(Number(value || DEFAULT_DAILY_GOAL_MINUTES));
  return Number.isFinite(minutes) ? Math.min(720, Math.max(15, minutes)) : DEFAULT_DAILY_GOAL_MINUTES;
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

function formatChartAxis(totalMinutes) {
  const safe = Math.max(0, Math.round(totalMinutes || 0));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (!hours) return `${minutes}m`;
  if (!minutes) return `${hours}h`;
  return `${hours}h${minutes}`;
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
  return Math.max(0, Number(timer.focusMinutes || 20) * 60 - elapsed);
}

function elapsedSeconds(timer, nowTick) {
  const elapsedRunning = timer.running && timer.startedAt ? Math.floor((nowTick - timer.startedAt) / 1000) : 0;
  return Math.max(0, Number(timer.elapsedBeforeStart || 0) + elapsedRunning);
}

function rewardFor(minutes) {
  return Math.max(0, Math.round(Number(minutes || 0)));
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
  const bgmPreviewTimeoutRef = useRef(null);
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
  const dailyGoalProgress = Math.min(1, (state.todayMinutes || 0) / Math.max(1, state.dailyGoalMinutes || DEFAULT_DAILY_GOAL_MINUTES));

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

  function playBgmPreview() {
    ensureAudioContext();
    const audio = ensureBgmAudio();
    if (bgmPreviewTimeoutRef.current) {
      window.clearTimeout(bgmPreviewTimeoutRef.current);
      bgmPreviewTimeoutRef.current = null;
    }
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Mobile browsers require a user gesture before audio can start.
    });
    if (!(state.sound?.bgm && state.timer.running && tab === "timer")) {
      bgmPreviewTimeoutRef.current = window.setTimeout(() => {
        audio.pause();
        bgmPreviewTimeoutRef.current = null;
      }, 8000);
    }
  }

  function stopBgm() {
    const audio = bgmAudioRef.current;
    if (bgmPreviewTimeoutRef.current) {
      window.clearTimeout(bgmPreviewTimeoutRef.current);
      bgmPreviewTimeoutRef.current = null;
    }
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
      const reward = rewardFor(minutes);
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

  function updateDailyGoal(minutes) {
    setState((current) => ({
      ...current,
      dailyGoalMinutes: normalizeGoalMinutes(minutes),
    }));
  }

  function updateSessionSubject(sessionId, subjectId) {
    setState((current) => {
      if (!current.subjects.some((subject) => subject.id === subjectId)) return current;
      return {
        ...current,
        sessions: current.sessions.map((session) => (
          session.id === sessionId ? { ...session, subject: subjectId } : session
        )),
      };
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
        icon: "quest-free.png",
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

  function updateAppName(name) {
    setState((current) => ({
      ...current,
      appName: name,
    }));
  }

  function updateLayoutOffsets(timerOffset, characterOffset) {
    setState((current) => ({
      ...current,
      timerOffset,
      characterOffset,
    }));
  }

  return (
    <main className="stage">
      <div className="showcase" aria-label={state.appName || "たまの勉強タイマー"}>
        <PhoneFrame className={tab === "timer" ? "timer-phone" : ""}>
          {tab === "home" && (
            <HomeScreen
              state={state}
              subjects={subjects}
              outfit={activeOutfit}
              subject={selectedSubject}
              progress={dailyGoalProgress}
              setTab={setTab}
              startTimer={startTimer}
              setSubject={(id) => setState((current) => ({ ...current, selectedSubject: id }))}
              onTitleChange={updateAppName}
              updateDailyGoal={updateDailyGoal}
            />
          )}
          {tab === "timer" && (
            <TimerScreen
              state={state}
              subjects={subjects}
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
              setSubject={(id) => setState((current) => ({ ...current, selectedSubject: id }))}
              setTab={setTab}
              sound={state.sound}
              soundPanelOpen={soundPanelOpen}
              toggleSoundPanel={toggleSoundPanel}
              updateSound={updateSound}
              playBgmPreview={playBgmPreview}
              playAlarm={playAlarm}
              updateLayoutOffsets={updateLayoutOffsets}
            />
          )}
          {tab === "records" && (
            <RecordsScreen
              state={state}
              subjects={subjects}
              setTab={setTab}
              updateChartSettings={updateChartSettings}
              updateSessionSubject={updateSessionSubject}
            />
          )}
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
          {tab === "closet" && (
            <ClosetScreen
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

function TopBar({ title, points, onBack, rightIcon = "music", avatarSrc, onSoundClick, soundEnabled, onTitleChange }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  function handleSave() {
    setIsEditing(false);
    const cleaned = editValue.trim();
    if (cleaned && cleaned !== title && onTitleChange) {
      onTitleChange(cleaned);
    }
  }

  return (
    <header className="topbar">
      {onBack ? (
        <button className="icon-button" type="button" onClick={onBack} aria-label="戻る">
          <ChevronLeft size={20} />
        </button>
      ) : (
        <span className="mini-avatar" style={{ backgroundImage: `url(${avatarSrc || asset("crops/protagonist.png")})` }} aria-hidden="true" />
      )}
      {isEditing && onTitleChange ? (
        <input
          className="topbar-edit-input"
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setIsEditing(false);
              setEditValue(title);
            }
          }}
          autoFocus
          maxLength={18}
          aria-label="見出しを編集"
        />
      ) : onTitleChange ? (
        <strong
          className="editable-title"
          onClick={() => setIsEditing(true)}
          style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
          title="クリックして編集"
        >
          {title}
          <Pencil size={11} className="edit-icon" style={{ opacity: 0.6 }} />
        </strong>
      ) : (
        <strong>{title}</strong>
      )}
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

function HomeScreen({ state, subjects, outfit, subject, progress, setTab, startTimer, setSubject, onTitleChange, updateDailyGoal }) {
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalHours, setGoalHours] = useState(String(Math.floor((state.dailyGoalMinutes || DEFAULT_DAILY_GOAL_MINUTES) / 60)));
  const [goalMinutes, setGoalMinutes] = useState(String((state.dailyGoalMinutes || DEFAULT_DAILY_GOAL_MINUTES) % 60));
  const plantScale = 0.72 + progress * 0.42;

  function openGoalEditor() {
    const goal = state.dailyGoalMinutes || DEFAULT_DAILY_GOAL_MINUTES;
    setGoalHours(String(Math.floor(goal / 60)));
    setGoalMinutes(String(goal % 60));
    setGoalOpen(true);
  }

  function saveGoal() {
    const hours = Math.max(0, Math.min(12, Math.round(Number(goalHours || 0))));
    const minutes = Math.max(0, Math.min(59, Math.round(Number(goalMinutes || 0))));
    updateDailyGoal(hours * 60 + minutes);
    setGoalOpen(false);
  }

  return (
    <div className="screen home-screen">
      <TopBar
        title={state.appName || "たまの勉強タイマー"}
        points={state.points}
        avatarSrc={asset(`avatar/full/${outfit.id}.png`)}
        onTitleChange={onTitleChange}
      />
      <section className="hero-card" style={{ "--hero-room-bg": `url(${asset("crops/home-bg.png")})` }}>
        <div className="hero-copy">
          <span>今日の勉強時間</span>
          <strong>{formatHours(state.todayMinutes)}</strong>
          <button className="goal-edit-button" type="button" onClick={openGoalEditor}>
            目標 {formatHours(state.dailyGoalMinutes || DEFAULT_DAILY_GOAL_MINUTES)}
          </button>
        </div>
        <div className="ring" style={{ "--progress": `${Math.round(progress * 360)}deg` }}>
          <span className={progress >= 1 ? "ring-plant bloom" : "ring-plant"} style={{ "--plant-scale": plantScale }}>
            {progress >= 1 ? "✿" : <Sprout size={30} />}
          </span>
        </div>
        <img className="home-character" src={asset(`avatar/full/${outfit.id}.png`)} alt="たま" />
      </section>
      {goalOpen && (
        <div className="goal-editor-overlay" role="dialog" aria-modal="true" aria-label="目標時間の編集">
          <button className="settings-scrim" type="button" aria-label="閉じる" onClick={() => setGoalOpen(false)} />
          <section className="goal-editor-sheet">
            <div className="sheet-head">
              <div>
                <span><Clock3 size={16} />目標時間</span>
                <small>今日の目標と記録グラフの上限に使います</small>
              </div>
              <button className="icon-button" type="button" onClick={() => setGoalOpen(false)} aria-label="閉じる">×</button>
            </div>
            <div className="goal-input-row">
              <label>
                <span>時間</span>
                <input type="number" min="0" max="12" inputMode="numeric" value={goalHours} onChange={(event) => setGoalHours(event.target.value)} />
              </label>
              <label>
                <span>分</span>
                <input type="number" min="0" max="59" inputMode="numeric" value={goalMinutes} onChange={(event) => setGoalMinutes(event.target.value)} />
              </label>
            </div>
            <div className="goal-presets">
              {[60, 120, 180, 240, 300, 360].map((minutes) => (
                <button key={minutes} type="button" onClick={() => {
                  setGoalHours(String(Math.floor(minutes / 60)));
                  setGoalMinutes(String(minutes % 60));
                }}>
                  {formatChartTotal(minutes)}
                </button>
              ))}
            </div>
            <div className="sheet-actions">
              <button type="button" onClick={() => setGoalOpen(false)}>キャンセル</button>
              <button className="primary" type="button" onClick={saveGoal}>保存</button>
            </div>
          </section>
        </div>
      )}
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
              <img src={subjectIconSrc(item.icon)} alt="" />
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
        <QuickTile icon={<Shirt size={24} />} label="衣装" onClick={() => setTab("closet")} />
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
  subjects,
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
  setSubject,
  setTab,
  sound,
  soundPanelOpen,
  toggleSoundPanel,
  updateSound,
  playBgmPreview,
  playAlarm,
  updateLayoutOffsets,
}) {
  const isRunning = state.timer.running;
  const [customFocusOpen, setCustomFocusOpen] = useState(false);
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [customFocusMinutes, setCustomFocusMinutes] = useState(String(state.timer.focusMinutes || 20));
  const isCustomFocus = !FOCUS_PRESETS.includes(Number(state.timer.focusMinutes));

  // Layout dragging states
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, initialX: 0, initialY: 0 });
  const [tempTimerOffset, setTempTimerOffset] = useState({ x: 0, y: 0 });
  const [tempCharOffset, setTempCharOffset] = useState({ x: 0, y: 0 });
  const lastTapRef = useRef(0);

  useEffect(() => {
    setTempTimerOffset(state.timerOffset || { x: 0, y: 0 });
    setTempCharOffset(state.characterOffset || { x: 0, y: 0 });
  }, [state.timerOffset, state.characterOffset, isAdjusting]);

  function handleScenePointerDown(e) {
    if (isAdjusting) return;
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      setIsAdjusting(true);
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }

  function handleElementPointerDown(e, type) {
    if (!isAdjusting) return;
    e.stopPropagation();
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    setActiveDrag(type);
    
    const initialX = type === "timer" ? tempTimerOffset.x : tempCharOffset.x;
    const initialY = type === "timer" ? tempTimerOffset.y : tempCharOffset.y;
    
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      initialX,
      initialY,
    });
  }

  function handleElementPointerMove(e) {
    if (!activeDrag) return;
    e.stopPropagation();
    e.preventDefault();
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    if (activeDrag === "timer") {
      setTempTimerOffset({
        x: dragStart.initialX + dx,
        y: dragStart.initialY + dy,
      });
    } else {
      setTempCharOffset({
        x: dragStart.initialX + dx,
        y: dragStart.initialY + dy,
      });
    }
  }

  function handleElementPointerUp(e) {
    if (!activeDrag) return;
    e.stopPropagation();
    e.preventDefault();
    try {
      e.target.releasePointerCapture(e.pointerId);
    } catch (err) {}
    setActiveDrag(null);
  }

  function saveOffsets() {
    setIsAdjusting(false);
    if (updateLayoutOffsets) {
      updateLayoutOffsets(tempTimerOffset, tempCharOffset);
    }
  }

  function resetOffsets() {
    setTempTimerOffset({ x: 0, y: 0 });
    setTempCharOffset({ x: 0, y: 0 });
    if (updateLayoutOffsets) {
      updateLayoutOffsets({ x: 0, y: 0 }, { x: 0, y: 0 });
    }
    setIsAdjusting(false);
  }

  const currentTimerOffset = isAdjusting ? tempTimerOffset : (state.timerOffset || { x: 0, y: 0 });
  const currentCharOffset = isAdjusting ? tempCharOffset : (state.characterOffset || { x: 0, y: 0 });

  function openCustomFocus() {
    setCustomFocusMinutes(String(state.timer.focusMinutes || 20));
    setCustomFocusOpen((open) => !open);
  }

  function applyCustomFocus() {
    const parsedMinutes = Number(customFocusMinutes);
    const minutes = Number.isFinite(parsedMinutes) ? Math.min(180, Math.max(1, Math.round(parsedMinutes))) : 20;
    setFocusMinutes(minutes);
    setCustomFocusMinutes(String(minutes));
    setCustomFocusOpen(false);
  }

  return (
    <div className="screen timer-screen">
      <header className="timer-header">
        <button className="icon-button" type="button" onClick={() => setTab("home")} aria-label="戻る">
          <ChevronLeft size={20} />
        </button>
        <button className="task-pill top-task-pill" type="button" onClick={() => setSubjectPickerOpen(true)}>
          <img src={subjectIconSrc(subject.icon)} alt="" />
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
          <button type="button" onClick={playBgmPreview}>試す</button>
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
      {subjectPickerOpen && (
        <div className="subject-picker-overlay" role="dialog" aria-modal="true" aria-label="教科を選ぶ">
          <button className="settings-scrim" type="button" aria-label="閉じる" onClick={() => setSubjectPickerOpen(false)} />
          <section className="subject-picker-sheet">
            <div className="sheet-head">
              <div>
                <span><BookOpen size={16} />教科を選ぶ</span>
                <small>このタイマーで記録する項目です</small>
              </div>
              <button className="icon-button" type="button" onClick={() => setSubjectPickerOpen(false)} aria-label="閉じる">×</button>
            </div>
            <div className="subject-picker-grid">
              {subjects.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={state.selectedSubject === item.id ? "active" : ""}
                  style={{ "--subject-color": item.color }}
                  onClick={() => {
                    setSubject(item.id);
                    setSubjectPickerOpen(false);
                  }}
                >
                  <img src={subjectIconSrc(item.icon)} alt="" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      <div className="mode-switch">
        <button type="button" className={state.timer.mode === "focus" ? "active" : ""} onClick={() => changeMode("focus")}>集中</button>
        <button type="button" className={state.timer.mode === "free" ? "active" : ""} onClick={() => changeMode("free")}>自由計測</button>
      </div>
      {state.timer.mode === "focus" && (
        <>
          <div className="preset-row">
            {FOCUS_PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className={state.timer.focusMinutes === minutes ? "active" : ""}
                onClick={() => {
                  setFocusMinutes(minutes);
                  setCustomFocusOpen(false);
                }}
              >
                {minutes}
              </button>
            ))}
            <button
              type="button"
              className={isCustomFocus ? "active" : ""}
              onClick={openCustomFocus}
              aria-label="カスタム時間"
            >
              <Plus size={16} />
            </button>
          </div>
          {customFocusOpen && (
            <div className="custom-focus-panel">
              <label>
                <span>カスタム</span>
                <input
                  type="number"
                  min="1"
                  max="180"
                  inputMode="numeric"
                  value={customFocusMinutes}
                  onChange={(event) => setCustomFocusMinutes(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyCustomFocus();
                  }}
                  aria-label="カスタム時間 分"
                />
                <small>分</small>
              </label>
              <button type="button" onClick={applyCustomFocus}>設定</button>
            </div>
          )}
        </>
      )}
      <section
        className="focus-scene"
        onPointerDown={handleScenePointerDown}
        style={{ userSelect: "none" }}
      >
        <div
          className={`timer-wreath ${isAdjusting ? "adjusting" : ""}`}
          style={{
            "--progress": `${Math.round(progress * 360)}deg`,
            transform: `translate(calc(-50% + ${currentTimerOffset.x}px), ${currentTimerOffset.y}px)`,
            touchAction: isAdjusting ? "none" : "auto",
          }}
          onPointerDown={(e) => handleElementPointerDown(e, "timer")}
          onPointerMove={handleElementPointerMove}
          onPointerUp={handleElementPointerUp}
          onPointerCancel={handleElementPointerUp}
        >
          <span>{formatTime(displayValue)}</span>
          <small>{state.timer.mode === "focus" ? "残り時間" : "経過時間"}</small>
        </div>
        <img className="desk-bg" src={asset("crops/home-bg.png")} alt="" draggable="false" onDragStart={(e) => e.preventDefault()} />
        <img
          className={`study-character ${isAdjusting ? "adjusting" : ""}`}
          src={asset(studyImageFor(outfit.id))}
          alt={`${outfit.name}で勉強するたま`}
          draggable="false"
          onDragStart={(e) => e.preventDefault()}
          style={{
            transform: `translateX(-50%) translate(${currentCharOffset.x}px, ${currentCharOffset.y}px)`,
            touchAction: isAdjusting ? "none" : "auto",
          }}
          onPointerDown={(e) => handleElementPointerDown(e, "character")}
          onPointerMove={handleElementPointerMove}
          onPointerUp={handleElementPointerUp}
          onPointerCancel={handleElementPointerUp}
        />
        {isAdjusting && (
          <div className="layout-adjust-overlay">
            <div className="adjust-badge">位置の調整中</div>
            <div className="adjust-tip">
              タイマーやキャラクターを
              <br />
              ドラッグして移動できます
            </div>
            <div className="adjust-actions">
              <button type="button" className="adjust-btn save" onClick={saveOffsets}>保存</button>
              <button type="button" className="adjust-btn reset" onClick={resetOffsets}>リセット</button>
              <button type="button" className="adjust-btn cancel" onClick={() => setIsAdjusting(false)}>キャンセル</button>
            </div>
          </div>
        )}
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
        <span><Sprout size={17} />獲得ポイント</span>
        <b>+{rewardFor(Math.max(1, Math.round(spentSeconds / 60)))} pt</b>
        <progress value={Math.min(100, Math.round(progress * 100))} max="100" />
      </div>
    </div>
  );
}

function SubjectEditScreen({ state, subjects, setTab, updateSubject, addSubject, deleteSubject }) {
  const [colorSubjectId, setColorSubjectId] = useState(null);
  const [iconSubjectId, setIconSubjectId] = useState(null);
  const colorSubject = subjects.find((subject) => subject.id === colorSubjectId);
  const iconSubject = subjects.find((subject) => subject.id === iconSubjectId);

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
              <button
                className="subject-icon-button"
                type="button"
                onClick={() => setIconSubjectId(subject.id)}
                aria-label={`${subject.label}のアイコンを選ぶ`}
              >
                <img src={subjectIconSrc(subject.icon)} alt="" />
              </button>
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
              <div className="subject-color-field" style={{ "--subject-color": subject.color }}>
                <span>色</span>
                <button
                  className="subject-color-swatch"
                  type="button"
                  onClick={() => setColorSubjectId(subject.id)}
                  aria-label={`${subject.label}の色を選ぶ`}
                />
              </div>
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
      {colorSubject && (
        <div className="chart-settings-overlay" role="dialog" aria-modal="true" aria-label={`${colorSubject.label}の色を選ぶ`}>
          <button className="settings-scrim" type="button" aria-label="閉じる" onClick={() => setColorSubjectId(null)} />
          <section className="chart-settings-sheet compact-picker-sheet">
            <div className="sheet-head">
              <div>
                <span><Palette size={16} />色を選ぶ</span>
                <small>{colorSubject.label}の表示色を変更します</small>
              </div>
              <button className="icon-button" type="button" onClick={() => setColorSubjectId(null)} aria-label="閉じる">×</button>
            </div>
            <label className="large-color-picker" style={{ "--subject-color": colorSubject.color }}>
              <span>自由に調整</span>
              <input
                type="color"
                value={colorSubject.color}
                onChange={(event) => updateSubject(colorSubject.id, { color: event.target.value })}
                aria-label={`${colorSubject.label}の色`}
              />
            </label>
            <div className="basic-color-grid" aria-label="基本色">
              {BASIC_SUBJECT_COLORS.map((color) => (
                <button
                  key={color}
                  className={colorSubject.color.toLowerCase() === color.toLowerCase() ? "active" : ""}
                  type="button"
                  style={{ "--swatch-color": color }}
                  onClick={() => updateSubject(colorSubject.id, { color })}
                  aria-label={`${color}を選ぶ`}
                />
              ))}
            </div>
            <div className="sheet-actions single">
              <button className="primary" type="button" onClick={() => setColorSubjectId(null)}>完了</button>
            </div>
          </section>
        </div>
      )}
      {iconSubject && (
        <div className="chart-settings-overlay" role="dialog" aria-modal="true" aria-label={`${iconSubject.label}のアイコンを選ぶ`}>
          <button className="settings-scrim" type="button" aria-label="閉じる" onClick={() => setIconSubjectId(null)} />
          <section className="chart-settings-sheet compact-picker-sheet">
            <div className="sheet-head">
              <div>
                <span><BookOpen size={16} />アイコンを選ぶ</span>
                <small>{iconSubject.label}のアイコンを変更します</small>
              </div>
              <button className="icon-button" type="button" onClick={() => setIconSubjectId(null)} aria-label="閉じる">×</button>
            </div>
            <div className="icon-choice-grid">
              {SUBJECT_ICON_OPTIONS.map((option) => (
                <button
                  key={option.icon}
                  className={iconSubject.icon === option.icon ? "active" : ""}
                  type="button"
                  onClick={() => updateSubject(iconSubject.id, { icon: option.icon })}
                >
                  <img src={subjectIconSrc(option.icon)} alt="" />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
            <div className="sheet-actions single">
              <button className="primary" type="button" onClick={() => setIconSubjectId(null)}>完了</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function RecordsScreen({ state, subjects, setTab, updateChartSettings, updateSessionSubject }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [visibleWeekStart, setVisibleWeekStart] = useState(() => startOfWeek(new Date()));
  const totalToday = state.sessions.filter((session) => session.date === todayKey()).reduce((sum, session) => sum + session.minutes, 0);
  const currentWeekStart = startOfWeek(new Date());
  const isCurrentWeek = sameDateKey(visibleWeekStart, currentWeekStart);
  const weekDays = buildWeeklyChart(state.sessions, subjects, visibleWeekStart);
  const visibleSubjects = subjects.filter((subject) => state.chartSettings.visibleSubjects.includes(subject.id));
  const visibleTotals = weekDays.map((day) => visibleSubjects.reduce((sum, subject) => sum + day.subjects[subject.id], 0));
  const chartMaxMinutes = Math.max(60, normalizeGoalMinutes(state.dailyGoalMinutes), ...visibleTotals);
  const weekTotal = visibleTotals.reduce((sum, minutes) => sum + minutes, 0);
  const editingSession = state.sessions.find((session) => session.id === editingSessionId);

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
            <span>{formatChartAxis(chartMaxMinutes)}</span>
            <span>{formatChartAxis(chartMaxMinutes / 2)}</span>
            <span>0</span>
          </div>
          <div className="chart-bars">
            {weekDays.map((day) => {
              const dayTotal = visibleSubjects.reduce((sum, subject) => sum + day.subjects[subject.id], 0);
              return (
                <div className="chart-day" key={day.date}>
                  <div className="chart-bar-track">
                    <div className="chart-stack" style={{ height: `${Math.max(dayTotal ? 8 : 0, (dayTotal / chartMaxMinutes) * 100)}%` }}>
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
                    <img src={subjectIconSrc(subject.icon)} alt="" />
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
          const subject = subjects.find((item) => item.id === session.subject) || { label: "削除済み", icon: "quest-free.png" };
          return (
            <article className="history-card" key={session.id}>
              <img src={subjectIconSrc(subject.icon)} alt="" />
              <div>
                <strong>{subject.label}</strong>
                <span>{session.mode === "focus" ? "集中タイマー" : "自由計測"} / {session.minutes}分</span>
              </div>
              <button type="button" onClick={() => setEditingSessionId(session.id)} aria-label="項目を変更">
                変更
              </button>
              <b>+{session.reward} pt</b>
            </article>
          );
        })}
      </div>
      {editingSession && (
        <div className="chart-settings-overlay" role="dialog" aria-modal="true" aria-label="記録の項目変更">
          <button className="settings-scrim" type="button" aria-label="閉じる" onClick={() => setEditingSessionId(null)} />
          <section className="chart-settings-sheet compact-picker-sheet">
            <div className="sheet-head">
              <div>
                <span><BookOpen size={16} />項目を変更</span>
                <small>記録後でも教科を直せます</small>
              </div>
              <button className="icon-button" type="button" onClick={() => setEditingSessionId(null)} aria-label="閉じる">×</button>
            </div>
            <div className="subject-picker-grid">
              {subjects.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={editingSession.subject === item.id ? "active" : ""}
                  style={{ "--subject-color": item.color }}
                  onClick={() => {
                    updateSessionSubject(editingSession.id, item.id);
                    setEditingSessionId(null);
                  }}
                >
                  <img src={subjectIconSrc(item.icon)} alt="" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
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
      <TopBar title="ショップ" points={state.points} onBack={() => setTab("home")} />
      <div className="shop-tabs">
        <button className="active" type="button">おようふく</button>
        <button type="button">家具</button>
      </div>
      <div className="outfit-grid">
        {outfits.map((outfit) => {
          const unlocked = state.unlockedOutfits.includes(outfit.id);
          const selected = state.selectedOutfitId === outfit.id;
          return (
            <article
              className={`outfit-card ${selected ? "selected" : ""} ${!unlocked ? "locked" : ""}`}
              key={outfit.id}
            >
              <button
                className="zoom"
                type="button"
                aria-label={`${outfit.name}を大きく表示`}
                onClick={() => setPreviewOutfit(outfit)}
              >
                ⌕
              </button>
              <img src={asset(`crops/${outfit.id}.png`)} alt="" />
              <strong>{outfit.name}</strong>
              <button
                className="outfit-action"
                type="button"
                onClick={() => handleOutfitTap(outfit)}
                disabled={selected}
              >
                {unlocked ? (selected ? "着用中" : "着る") : `${outfit.cost.toLocaleString()} pt`}
              </button>
            </article>
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

function ClosetScreen({ state, outfits, unlockOrSelect, setTab }) {
  const [previewOutfit, setPreviewOutfit] = useState(null);
  const unlockedOutfits = outfits.filter((outfit) => state.unlockedOutfits.includes(outfit.id));

  return (
    <div className="screen wardrobe-screen closet-screen">
      <TopBar title="クローゼット" points={state.points} onBack={() => setTab("home")} />
      <div className="closet-toolbar">
        <span><Shirt size={16} />購入済み</span>
        <button type="button" onClick={() => setTab("wardrobe")}>
          <ShoppingBag size={15} />
          ショップ
        </button>
      </div>
      <div className="outfit-grid">
        {unlockedOutfits.map((outfit) => {
          const selected = state.selectedOutfitId === outfit.id;
          return (
            <article className={`outfit-card ${selected ? "selected" : ""}`} key={outfit.id}>
              <button
                className="zoom"
                type="button"
                aria-label={`${outfit.name}を大きく表示`}
                onClick={() => setPreviewOutfit(outfit)}
              >
                ⌕
              </button>
              <img src={asset(`crops/${outfit.id}.png`)} alt="" />
              <strong>{outfit.name}</strong>
              <button
                className="outfit-action"
                type="button"
                onClick={() => unlockOrSelect(outfit)}
                disabled={selected}
              >
                {selected ? "着用中" : "着る"}
              </button>
            </article>
          );
        })}
      </div>
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
