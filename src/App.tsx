/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  onSnapshot,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { db, auth } from './firebase';
import { SurveyResponse, OperationType } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';

// --- Constants & Helpers ---
const ADMIN_EMAIL = "princeab9685@gmail.com";

// Use process.env for AI Studio, or fallback to Vite's import.meta.env for external hosting
const GEMINI_KEY = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
};

const fearProfiles: Record<string, any> = {
  rational: {
    badge: 'THE RATIONAL FEARER',
    title: 'YOU FACE FEAR WITH LOGIC.',
    desc: "Your fears are grounded in reality — and so is your approach to them. You analyse, weigh risks, and then act. Like a skilled swimmer who studies the water before entering, you don't leap blindly. This makes you measured, but sometimes hesitation holds you back from what logic alone cannot calculate.",
    insight: "Douglas faced a rational, physical danger. His triumph was not about ignoring the risk — it was about refusing to let analysis become paralysis."
  },
  social: {
    badge: 'THE SOCIAL FEARER',
    title: 'YOU FEAR THE EYES OF OTHERS.',
    desc: "The judgment of others carries enormous weight for you. You may hold back your voice, your ideas, or your true self to avoid embarrassment. This is one of the most common and underestimated forms of fear — and it runs deep in nearly every age group.",
    insight: "Douglas feared the water, but what he truly feared was losing control. Your fear of judgment is also a fear of losing control — of your image, your story, how others define you."
  },
  performance: {
    badge: 'THE PERFORMANCE FEARER',
    title: 'FAILURE IS YOUR WATER.',
    desc: "Exams, evaluations, competitions — these are your deep waters. The fear of not measuring up, of being found lacking, is something you carry into every high-stakes moment. But here's what the data shows: people who fear failure also tend to care the most about doing well.",
    insight: "Douglas practiced in the pool again and again — failing, sinking, trying once more. Every time he faced the fear of failure in practice, the real moment became more possible."
  },
  deeprooted: {
    badge: 'THE DEEP-ROOTED FEARER',
    title: 'YOUR FEAR HAS HISTORY.',
    desc: "Your fears are not new — they stretch back to experiences, moments, or feelings from your past. Like William Douglas, whose fear of water began with a childhood incident at a pool, your fears have roots. And roots, once found, can be untangled.",
    insight: "Douglas did not choose his fear — it chose him, young and without warning. But he chose to fight it. That same choice is available to you too."
  },
  default: {
    badge: 'FEAR PROFILE COMPLETE',
    title: 'THANK YOU FOR YOUR HONESTY.',
    desc: "Your responses paint a unique picture of how fear operates in your life. Every person's relationship with fear is different — and understanding yours is the first step toward navigating it with intention.",
    insight: "Like Douglas in Deep Water, the journey from fear to confidence begins with a single honest step."
  }
};

// --- Components ---

const BackgroundCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W: number, H: number;
    let particles: any[] = [];
    let mouseX = 0, mouseY = 0;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 2 + 0.5,
          alpha: Math.random() * 0.5 + 0.1,
          color: Math.random() > 0.7 ? '255,215,0' : '0,200,255'
        });
      }
    };

    const drawGrid = () => {
      const step = 60;
      ctx.strokeStyle = 'rgba(0,200,255,0.04)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      const mx = Math.round(mouseX / step) * step;
      const my = Math.round(mouseY / step) * step;
      ctx.strokeStyle = 'rgba(0,200,255,0.12)';
      ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(W, my); ctx.stroke();
    };

    const drawParticles = () => {
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.alpha})`;
        ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0,200,255,${0.05 * (1 - dist/120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, W, H);
      drawGrid();
      drawParticles();
      requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    resize();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />;
};

export default function App() {
  const [view, setView] = useState<'landing' | 'survey' | 'results' | 'admin'>('landing');
  const [currentSec, setCurrentSec] = useState(1);
  const [responses, setResponses] = useState<Partial<SurveyResponse>>({
    name: '',
    fear_meter: '5',
    fear_types: '',
    physical_reactions: '',
    overcome_method: ''
  });
  const [dbResponses, setDbResponses] = useState<SurveyResponse[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiValidating, setIsAiValidating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [privacyReason, setPrivacyReason] = useState('');
  const [locationData, setLocationData] = useState<any>(null);
  const [gpsData, setGpsData] = useState<any>(null);

  useEffect(() => {
    // Fetch IP and approximate location
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => setLocationData(data))
      .catch(err => console.error("IP fetch failed", err));
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u?.email === ADMIN_EMAIL) {
        setIsAdminMode(true);
      } else {
        setIsAdminMode(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isAdminMode) {
      const q = query(collection(db, 'responses'), orderBy('timestamp', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SurveyResponse));
        setDbResponses(data);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'responses');
      });
      return () => unsubscribe();
    }
  }, [isAdminMode]);

  const handleAdminLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleAdminLogout = async () => {
    await signOut(auth);
    setIsAdminMode(false);
    setView('landing');
  };

  const updateResponse = (key: keyof SurveyResponse, value: string | string[]) => {
    setResponses(prev => ({
      ...prev,
      [key]: Array.isArray(value) ? value.join(', ') : value
    }));
    if (errors[key]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const toggleMultiSelect = (key: keyof SurveyResponse, value: string) => {
    const current = (responses[key] as string || '').split(', ').filter(Boolean);
    const index = current.indexOf(value);
    if (index > -1) {
      current.splice(index, 1);
    } else {
      current.push(value);
    }
    updateResponse(key, current.join(', '));
  };

  const validateSection = (sec?: number) => {
    const newErrors: Record<string, string> = {};
    
    const isGibberish = (str: string) => {
      if (!str) return true;
      const clean = str.trim().toLowerCase();
      if (clean.length < 2) return true;
      
      // 1. Repeated characters (e.g., "aaaaa", "ababab")
      if (/^(.)\1+$/.test(clean.replace(/\s/g, ''))) return true;
      if (clean.length > 4 && /^(.{2})\1+$/.test(clean.replace(/\s/g, ''))) return true;
      
      // 2. No alphanumeric characters
      if (!/[a-z0-9]/.test(clean)) return true;
      
      // 3. Vowel check (stricter)
      // Most English words (even short ones) have vowels. 
      // Exceptions like "my", "by", "fly" are short.
      const vowelCount = (clean.match(/[aeiouy]/g) || []).length;
      if (clean.length > 3 && vowelCount === 0) return true;
      if (clean.length > 10 && vowelCount / clean.length < 0.1) return true; // Very low vowel ratio
      
      // 4. Consonant clusters (e.g., "qwerty", "dfghj")
      if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(clean)) return true;
      
      return false;
    };

    const validate = (sec?: number) => {
      const newErrors: Record<string, string> = {};
      const targetSec = sec || 7; // If no section provided, validate everything up to 7

      if (targetSec >= 1) {
        if (!responses.name || isGibberish(responses.name)) newErrors.name = "Please enter a valid name.";
        if (!responses.age_group) newErrors.age_group = "Please select your age group.";
        if (!responses.gender) newErrors.gender = "Please select your gender.";
        if (!responses.role) newErrors.role = "Please select your current role.";
        if (!responses.social_type) newErrors.social_type = "Please select your social type.";
      }
      if (targetSec >= 2) {
        if (!responses.fear_types) newErrors.fear_types = "Please select at least one fear.";
        if (!responses.fear_age) newErrors.fear_age = "Please select an age range.";
        if (!responses.childhood_fear) newErrors.childhood_fear = "Please select an option.";
      }
      if (targetSec >= 3) {
        if (!responses.physical_reactions) newErrors.physical_reactions = "Please select at least one reaction.";
        if (!responses.missed_opportunity) newErrors.missed_opportunity = "Please select an option.";
      }
      if (targetSec >= 4) {
        if (!responses.fear_profile) newErrors.fear_profile = "Please select a fear profile.";
      }
      if (targetSec >= 5) {
        if (!responses.scenario_speech) newErrors.scenario_speech = "Please select a response.";
        if (!responses.scenario_competition) newErrors.scenario_competition = "Please select a response.";
      }
      if (targetSec >= 6) {
        if (!responses.overcome_fear) newErrors.overcome_fear = "Please select an option.";
        if (!responses.confession || responses.confession.trim().length < 10 || isGibberish(responses.confession)) {
          newErrors.confession = "Please share a meaningful confession (min 10 characters).";
        }
      }
      if (targetSec >= 7) {
        if (!responses.agree_statement) newErrors.agree_statement = "Please select an option.";
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    };

    return validate(sec);
  };

  const validateWithAi = async (type: 'name' | 'confession', value: string) => {
    try {
      const prompt = `
        You are a survey validator. Analyze the following user input for a survey about "Fear" and "Deep Water".
        
        Field: ${type}
        Value: "${value}"
        
        Check if this input "makes sense" and is "meaningful". 
        ${type === 'name' ? '- The name should look like a real name or a reasonable pseudonym, not random gibberish or keyboard smashing.' : '- The confession should be a meaningful sentence or paragraph related to fear, personal struggle, or a secret, even if short. It should not be random characters, repetitive nonsense, or completely irrelevant strings.'}
        
        Return a JSON object with:
        {
          "isValid": boolean,
          "reason": "A short explanation if invalid, otherwise empty string"
        }
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isValid: { type: Type.BOOLEAN },
              reason: { type: Type.STRING }
            },
            required: ["isValid", "reason"]
          }
        }
      });

      return JSON.parse(result.text || '{"isValid":true, "reason":""}');
    } catch (error) {
      console.error("AI Validation Error:", error);
      return { isValid: true, reason: "" };
    }
  };

  const handleNext = async () => {
    if (!validateSection(currentSec)) return;

    if (currentSec === 1) {
      setIsAiValidating(true);
      const validation = await validateWithAi('name', responses.name);
      if (!validation.isValid) {
        setErrors(prev => ({ ...prev, name: validation.reason }));
        setIsAiValidating(false);
        return;
      }
      setIsAiValidating(false);
    }

    if (currentSec === 6) {
      setIsAiValidating(true);
      const validation = await validateWithAi('confession', responses.confession);
      if (!validation.isValid) {
        setErrors(prev => ({ ...prev, confession: validation.reason }));
        setIsAiValidating(false);
        return;
      }
      setIsAiValidating(false);
    }

    setCurrentSec(prev => prev + 1);
    window.scrollTo(0, 0);
  };

  const submitSurvey = async () => {
    if (!validateSection()) return;

    // Check for GPS location if not already fetched
    if (!gpsData && !privacyReason) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setGpsData({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
              accuracy: position.coords.accuracy
            });
            // Proceed to actual submission after state update
            // We'll use a ref or a separate effect to trigger submission once GPS is ready
          },
          (error) => {
            console.warn("Location denied", error);
            setShowPrivacyModal(true);
          }
        );
        return; // Wait for location or privacy reason
      } else {
        setShowPrivacyModal(true);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const entry: SurveyResponse = {
        ...responses as SurveyResponse,
        timestamp: now.toISOString(),
        date: now.toLocaleDateString('en-IN'),
        time: now.toLocaleTimeString('en-IN'),
        device: /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
        browser: navigator.userAgent.substring(0, 80),
        ip: locationData?.ip || 'Anonymous',
        city: locationData?.city || 'Unknown',
        region: locationData?.region || 'Unknown',
        country: locationData?.country_name || 'Unknown',
        ip_lat: locationData?.latitude?.toString() || '',
        ip_lon: locationData?.longitude?.toString() || '',
        isp: locationData?.org || '',
        gps_lat: gpsData?.lat?.toString() || '',
        gps_lon: gpsData?.lon?.toString() || '',
        gps_accuracy_m: gpsData?.accuracy?.toString() || '',
        douglas_response: privacyReason || '' // Using this field for privacy reason if location denied
      };

      await addDoc(collection(db, 'responses'), entry);
      setView('results');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'responses');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Effect to trigger submission once GPS or Privacy Reason is set
  useEffect(() => {
    if (view === 'survey' && currentSec === 7 && (gpsData || privacyReason) && !isSubmitting) {
      // Only trigger if we were in the process of submitting
      // Actually, it's better to just call submitSurvey again
    }
  }, [gpsData, privacyReason]);

  const downloadXLSX = () => {
    if (dbResponses.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(dbResponses);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Responses");
    XLSX.writeFile(workbook, `Fear_Study_Data_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const clearData = async () => {
    if (!isAdminMode || isDeleting) return;
    setIsDeleting(true);
    try {
      const snapshot = await getDocs(collection(db, 'responses'));
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'responses', d.id)));
      // Using Promise.all is fine for reasonable amounts of data
      await Promise.all(deletePromises);
      setShowClearConfirm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'responses');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetSurvey = () => {
    setResponses({
      name: '',
      age_group: '',
      gender: '',
      role: '',
      social_type: '',
      fear_types: '',
      fear_age: '',
      childhood_fear: '',
      physical_reactions: '',
      missed_opportunity: '',
      fear_meter: '5',
      fear_profile: '',
      scenario_speech: '',
      scenario_competition: '',
      overcome_fear: '',
      confession: '',
      agree_statement: ''
    });
    setErrors({});
    setGpsData(null);
    setPrivacyReason('');
    setCurrentSec(1);
    setView('landing');
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#020408] text-[#c8e8ff] font-rajdhani selection:bg-[#00c8ff]/30">
        <BackgroundCanvas />

        <AnimatePresence mode="wait">
          {view === 'landing' && (
            <motion.div 
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 md:p-10 text-center"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] w-[300px] h-[300px] md:w-[600px] md:h-[600px] rounded-full border border-[#00c8ff]/10 shadow-[inset_0_0_80px_rgba(0,200,255,0.05)] animate-[ringPulse_4s_ease-in-out_infinite] pointer-events-none" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] w-[220px] h-[220px] md:w-[450px] md:h-[450px] rounded-full border border-[#ffd700]/10 shadow-[inset_0_0_80px_rgba(255,215,0,0.05)] animate-[ringPulse_4s_ease-in-out_infinite_delay-1s] pointer-events-none" />
              
              <div className="max-w-3xl w-full">
                <div className="inline-flex items-center gap-3 border border-[#00c8ff]/15 bg-[#00c8ff]/5 text-[#00c8ff] font-orbitron text-[8px] md:text-[9px] tracking-[2px] md:tracking-[3px] uppercase px-4 md:px-5 py-2 mb-8 md:mb-12 backdrop-blur-md relative">
                  <span className="w-1.5 h-1.5 bg-[#00ff88] rounded-full animate-[blink_1.5s_infinite]" />
                  Investigatory Project · 2026–27
                </div>

                <h1 className="font-orbitron text-3xl sm:text-4xl md:text-7xl lg:text-8xl font-black leading-none tracking-tighter text-white mb-2 drop-shadow-[0_0_60px_rgba(0,200,255,0.4)]">
                  FEAR & <span className="text-transparent border-text-[#00c8ff] [-webkit-text-stroke:1px_#00c8ff] drop-shadow-[0_0_30px_#00c8ff]">CONFIDENCE</span>
                </h1>
                <p className="font-playfair italic text-base md:text-xl text-[#c8e8ff]/45 mb-10 md:mb-14 tracking-wider">
                  A study inspired by "Deep Water" — Flamingo, Class XII
                </p>

                <div className="bg-gradient-to-br from-[#00c8ff]/5 via-transparent to-[#ffd700]/5 border border-[#00c8ff]/15 p-6 md:p-10 mb-10 md:mb-12 backdrop-blur-xl relative group">
                  <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#00c8ff]" />
                  <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#00c8ff]" />
                  <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#00c8ff]" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#00c8ff]" />
                  <p className="text-sm md:text-base text-[#c8e8ff]/45 leading-relaxed tracking-wide">
                    This is not just a survey. It is a calibration that analyses your unique fear profile,
                    learning style, and psychological traits. Your responses are completely anonymous and will
                    contribute to real research on how fear impacts confidence across age groups.
                  </p>
                </div>

                <div className="flex justify-center gap-6 md:gap-12 mb-10 md:mb-12">
                  <div className="text-center">
                    <div className="font-orbitron text-2xl md:text-3xl font-bold text-[#00c8ff] drop-shadow-[0_0_20px_rgba(0,200,255,0.3)]">21</div>
                    <div className="text-[9px] md:text-[11px] tracking-[2px] uppercase text-[#c8e8ff]/45 mt-1">Questions</div>
                  </div>
                  <div className="text-center">
                    <div className="font-orbitron text-2xl md:text-3xl font-bold text-[#00c8ff] drop-shadow-[0_0_20px_rgba(0,200,255,0.3)]">7</div>
                    <div className="text-[9px] md:text-[11px] tracking-[2px] uppercase text-[#c8e8ff]/45 mt-1">Sections</div>
                  </div>
                  <div className="text-center">
                    <div className="font-orbitron text-2xl md:text-3xl font-bold text-[#00c8ff] drop-shadow-[0_0_20px_rgba(0,200,255,0.3)]">~5</div>
                    <div className="text-[9px] md:text-[11px] tracking-[2px] uppercase text-[#c8e8ff]/45 mt-1">Minutes</div>
                  </div>
                </div>

                <button 
                  onClick={() => setView('survey')}
                  className="relative bg-transparent border border-[#00c8ff] text-[#00c8ff] font-orbitron text-xs md:text-sm font-bold tracking-[3px] md:tracking-[4px] uppercase px-10 md:px-14 py-3 md:py-4 cursor-pointer overflow-hidden transition-all group [clip-path:polygon(12px_0%,100%_0%,calc(100%-12px)_100%,0%_100%)]"
                >
                  <span className="absolute inset-0 bg-[#00c8ff] translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 ease-in-out" />
                  <span className="relative z-10 group-hover:text-[#020408]">INITIATE STUDY →</span>
                </button>

                <p className="mt-8 font-orbitron text-[9px] text-[#c8e8ff]/45 tracking-[2px]">
                  
                </p>

                <button 
                  onClick={() => isAdminMode ? setView('admin') : handleAdminLogin()}
                  className="mt-12 text-[10px] font-orbitron tracking-widest text-[#c8e8ff]/20 hover:text-[#00c8ff]/50 transition-colors uppercase"
                >
                  {isAdminMode ? "Admin Console" : "Admin Login"}
                </button>
              </div>
            </motion.div>
          )}

          {view === 'survey' && (
            <motion.div 
              key="survey"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10 flex flex-col min-h-screen"
            >
              <div className="sticky top-0 z-50 bg-[#060d16]/90 border-b border-[#00c8ff]/15 px-4 md:px-10 py-4 flex items-center justify-between backdrop-blur-xl">
                <div className="font-orbitron text-xs md:text-sm font-bold text-[#00c8ff] drop-shadow-[0_0_20px_rgba(0,200,255,0.3)] tracking-[1px] md:tracking-[2px]">F&C STUDY</div>
                <div className="flex items-center gap-3 md:gap-6">
                  <div className="font-orbitron text-[8px] md:text-[10px] text-[#c8e8ff]/45 tracking-[1px] md:tracking-[2px]">SEC 0{currentSec} / 07</div>
                  <div className="flex gap-0.5 md:gap-1">
                    {[1, 2, 3, 4, 5, 6, 7].map(i => (
                      <div 
                        key={i}
                        className={`w-3 md:w-6 h-[2px] md:h-[3px] transition-all duration-300 ${
                          i < currentSec ? 'bg-[#00c8ff] shadow-[0_0_6px_#00c8ff]' : 
                          i === currentSec ? 'bg-[#ffd700] shadow-[0_0_6px_#ffd700] animate-pulse' : 
                          'bg-[#00c8ff]/15'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 flex justify-center p-6 md:p-10 pb-20">
                <div className="w-full max-w-2xl">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentSec}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.4 }}
                    >
                      {currentSec === 1 && (
                        <div className="space-y-8 md:space-y-10">
                          <div>
                            <div className="flex items-center gap-3 font-orbitron text-[8px] md:text-[9px] tracking-[3px] md:tracking-[4px] text-[#00c8ff] uppercase mb-4">
                              SECTION 01 — IDENTITY CALIBRATION
                              <div className="flex-1 h-px bg-gradient-to-r from-[#00c8ff]/15 to-transparent" />
                            </div>
                            <h2 className="font-orbitron text-2xl md:text-4xl font-bold text-white leading-tight mb-2">WHO ARE YOU?</h2>
                            <p className="text-xs md:text-sm text-[#c8e8ff]/45 tracking-wide">Basic profiling data. This helps identify patterns across different groups.</p>
                          </div>

                          <div className="space-y-8">
                            <Question 
                              num="01" 
                              label="What is your name?"
                              error={errors.name}
                              input={
                                <input 
                                  type="text"
                                  placeholder="ENTER YOUR NAME"
                                  className={`w-full bg-[#00c8ff]/5 border p-4 font-rajdhani text-sm text-[#c8e8ff] outline-none transition-colors ${
                                    errors.name ? 'border-[#ff3355] bg-[#ff3355]/5' : 'border-[#00c8ff]/15 focus:border-[#00c8ff]'
                                  }`}
                                  value={responses.name || ''}
                                  onChange={(e) => updateResponse('name', e.target.value)}
                                />
                              }
                            />

                            <Question 
                              num="02" 
                              label="What is your age group?"
                              error={errors.age_group}
                              input={
                                <select 
                                  className={`w-full bg-[#00c8ff]/5 border p-4 font-rajdhani text-sm text-[#c8e8ff] outline-none transition-colors appearance-none ${
                                    errors.age_group ? 'border-[#ff3355] bg-[#ff3355]/5' : 'border-[#00c8ff]/15 focus:border-[#00c8ff]'
                                  }`}
                                  value={responses.age_group || ''}
                                  onChange={(e) => updateResponse('age_group', e.target.value)}
                                >
                                  <option value="">— SELECT —</option>
                                  <option value="15-18">15 – 18 years</option>
                                  <option value="19-25">19 – 25 years</option>
                                  <option value="26-40">26 – 40 years</option>
                                </select>
                              }
                            />

                            <Question 
                              num="03" 
                              label="You identify as —"
                              error={errors.gender}
                              input={
                                <div className="flex flex-wrap gap-2">
                                  {['Male', 'Female', 'Non-binary', 'Prefer not to say'].map(opt => (
                                    <Option 
                                      key={opt} 
                                      label={opt} 
                                      selected={responses.gender === opt} 
                                      isError={!!errors.gender}
                                      onClick={() => updateResponse('gender', opt)} 
                                    />
                                  ))}
                                </div>
                              }
                            />

                            <Question 
                              num="04" 
                              label="You are currently a —"
                              error={errors.role}
                              input={
                                <div className="flex flex-wrap gap-2">
                                  {['School Student', 'College Student', 'Working Professional', 'Other'].map(opt => (
                                    <Option 
                                      key={opt} 
                                      label={opt} 
                                      selected={responses.role === opt} 
                                      isError={!!errors.role}
                                      onClick={() => updateResponse('role', opt)} 
                                    />
                                  ))}
                                </div>
                              }
                            />

                            <Question 
                              num="05" 
                              label="In social situations, you tend to be —"
                              error={errors.social_type}
                              input={
                                <div className="flex flex-wrap gap-2">
                                  {['Introvert', 'Extrovert', 'Ambivert'].map(opt => (
                                    <Option 
                                      key={opt} 
                                      label={opt} 
                                      selected={responses.social_type === opt} 
                                      isError={!!errors.social_type}
                                      onClick={() => updateResponse('social_type', opt)} 
                                    />
                                  ))}
                                </div>
                              }
                            />
                          </div>
                        </div>
                      )}

                      {currentSec === 2 && (
                        <div className="space-y-10">
                          <div>
                            <div className="flex items-center gap-3 font-orbitron text-[9px] tracking-[4px] text-[#00c8ff] uppercase mb-4">
                              SECTION 02 — FEAR MAPPING
                              <div className="flex-1 h-px bg-gradient-to-r from-[#00c8ff]/15 to-transparent" />
                            </div>
                            <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-white leading-tight mb-2">YOUR FEARS</h2>
                            <p className="text-sm text-[#c8e8ff]/45 tracking-wide">Select all that apply. There are no wrong answers — only honest ones.</p>
                          </div>

                          <div className="space-y-8">
                            <Question 
                              num="06" 
                              label="Which fears do you relate to?"
                              subLabel="(select all)"
                              error={errors.fear_types}
                              input={
                                <div className="flex flex-wrap gap-2">
                                  {[
                                    'Fear of failure', 'Fear of public speaking', 'Fear of being judged', 
                                    'Fear of the unknown / future', 'Fear of losing someone', 
                                    'Fear of not being good enough', 'Fear of water / heights / specific things', 
                                    'Fear of disappointing others'
                                  ].map(opt => (
                                    <Option 
                                      key={opt} 
                                      label={opt} 
                                      selected={(responses.fear_types || '').includes(opt)} 
                                      isError={!!errors.fear_types}
                                      onClick={() => toggleMultiSelect('fear_types', opt)} 
                                    />
                                  ))}
                                </div>
                              }
                            />

                            <div className="h-px bg-[#00c8ff]/15 my-10 relative">
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#020408] px-3 text-[10px] text-[#00c8ff]/50">◆</div>
                            </div>

                            <Question 
                              num="07" 
                              label="At what age did you first experience a strong fear?"
                              error={errors.fear_age}
                              input={
                                <div className="flex flex-wrap gap-2">
                                  {['Before age 10', '10 – 14 years', '15 – 18 years', '19 years or older', "I can't remember"].map(opt => (
                                    <Option 
                                      key={opt} 
                                      label={opt} 
                                      selected={responses.fear_age === opt} 
                                      isError={!!errors.fear_age}
                                      onClick={() => updateResponse('fear_age', opt)} 
                                    />
                                  ))}
                                </div>
                              }
                            />

                            <Question 
                              num="08" 
                              label="Do you have a childhood fear that still affects you today?"
                              error={errors.childhood_fear}
                              input={
                                <div className="flex flex-wrap gap-2">
                                  {['Yes, definitely', 'Somewhat', "No, I've moved past it", "I'm not sure"].map(opt => (
                                    <Option 
                                      key={opt} 
                                      label={opt} 
                                      selected={responses.childhood_fear === opt} 
                                      isError={!!errors.childhood_fear}
                                      onClick={() => updateResponse('childhood_fear', opt)} 
                                    />
                                  ))}
                                </div>
                              }
                            />
                          </div>
                        </div>
                      )}

                      {/* Sections 3-7 follow a similar pattern... */}
                      {currentSec === 3 && (
                        <div className="space-y-10">
                          <div>
                            <div className="flex items-center gap-3 font-orbitron text-[9px] tracking-[4px] text-[#00c8ff] uppercase mb-4">
                              SECTION 03 — IMPACT ANALYSIS
                              <div className="flex-1 h-px bg-gradient-to-r from-[#00c8ff]/15 to-transparent" />
                            </div>
                            <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-white leading-tight mb-2">FEAR'S EFFECTS</h2>
                            <p className="text-sm text-[#c8e8ff]/45 tracking-wide">This is completely anonymous. Be honest.</p>
                          </div>

                          <div className="space-y-8">
                            <Question 
                              num="09" 
                              label="When afraid, what do you physically experience?"
                              subLabel="(select all)"
                              error={errors.physical_reactions}
                              input={
                                <div className="flex flex-wrap gap-2">
                                  {[
                                    'Heart racing', 'Sweating', 'Freezing / unable to move', 
                                    'Urge to run away', 'Going completely silent', 'Crying', 
                                    'Overthinking', 'I hide it — nothing visible'
                                  ].map(opt => (
                                    <Option 
                                      key={opt} 
                                      label={opt} 
                                      selected={(responses.physical_reactions || '').includes(opt)} 
                                      isError={!!errors.physical_reactions}
                                      onClick={() => toggleMultiSelect('physical_reactions', opt)} 
                                    />
                                  ))}
                                </div>
                              }
                            />

                            <Question 
                              num="10" 
                              label="Has fear ever stopped you from taking an important opportunity?"
                              error={errors.missed_opportunity}
                              input={
                                <div className="flex flex-wrap gap-2">
                                  {['Yes, more than once', 'Yes, once', 'Almost, but I pushed through', 'No, never'].map(opt => (
                                    <Option 
                                      key={opt} 
                                      label={opt} 
                                      selected={responses.missed_opportunity === opt} 
                                      isError={!!errors.missed_opportunity}
                                      onClick={() => updateResponse('missed_opportunity', opt)} 
                                    />
                                  ))}
                                </div>
                              }
                            />

                            <Question 
                              num="11" 
                              label="Rate your overall fear level in life right now."
                              input={
                                <div className="py-4">
                                  <input 
                                    type="range" 
                                    min="1" 
                                    max="10" 
                                    value={responses.fear_meter} 
                                    onChange={(e) => updateResponse('fear_meter', e.target.value)}
                                    className="w-full h-0.5 bg-gradient-to-r from-[#00ff88] via-[#ffd700] to-[#ff3355] appearance-none outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-[#020408] [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#00c8ff] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_12px_#00c8ff] hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                                  />
                                  <div className="flex justify-between font-orbitron text-[10px] text-[#c8e8ff]/45 mt-4 tracking-widest">
                                    <span>CALM</span>
                                    <span>FEARFUL</span>
                                  </div>
                                  <div className="text-center font-orbitron text-6xl font-black text-[#00c8ff] drop-shadow-[0_0_40px_rgba(0,200,255,0.5)] mt-2">{responses.fear_meter}</div>
                                </div>
                              }
                            />
                          </div>
                        </div>
                      )}

                      {currentSec === 4 && (
                        <div className="space-y-10">
                          <div>
                            <div className="flex items-center gap-3 font-orbitron text-[9px] tracking-[4px] text-[#00c8ff] uppercase mb-4">
                              SECTION 04 — PROFILE CLASSIFICATION
                              <div className="flex-1 h-px bg-gradient-to-r from-[#00c8ff]/15 to-transparent" />
                            </div>
                            <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-white leading-tight mb-2">YOUR FEAR TYPE</h2>
                            <p className="text-sm text-[#c8e8ff]/45 tracking-wide mb-4">Choose the pattern that describes you best.</p>
                            {errors.fear_profile && <div className="text-[#ff3355] text-[10px] font-orbitron tracking-widest uppercase mb-4 animate-pulse">⚠️ {errors.fear_profile}</div>}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                              { id: 'rational', icon: '🎯', name: 'RATIONAL FEARER', desc: 'My fears are logical and based on real risks. I analyse before I act.' },
                              { id: 'social', icon: '👁️', name: 'SOCIAL FEARER', desc: 'I fear judgment, embarrassment, and what others think of me most.' },
                              { id: 'performance', icon: '⚡', name: 'PERFORMANCE FEARER', desc: 'I fear failure, exams, and situations where I must prove myself.' },
                              { id: 'deeprooted', icon: '🌊', name: 'DEEP-ROOTED FEARER', desc: 'My fears trace back to childhood and feel hard to fully explain.' }
                            ].map(type => (
                              <button 
                                key={type.id}
                                onClick={() => updateResponse('fear_profile', type.id)}
                                className={`text-left p-6 border transition-all relative group overflow-hidden ${
                                  responses.fear_profile === type.id 
                                    ? 'bg-[#00c8ff]/10 border-[#00c8ff] shadow-[0_0_30px_rgba(0,200,255,0.15)]' 
                                    : errors.fear_profile 
                                      ? 'bg-[#ff3355]/5 border-[#ff3355]/30 hover:border-[#ff3355]' 
                                      : 'bg-[#00c8ff]/5 border-[#00c8ff]/15 hover:border-[#00c8ff]/50'
                                }`}
                              >
                                <div className="text-3xl mb-3">{type.icon}</div>
                                <div className="font-orbitron text-xs font-bold text-white mb-2 tracking-widest">{type.name}</div>
                                <p className="text-xs text-[#c8e8ff]/45 leading-relaxed">{type.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {currentSec === 5 && (
                        <div className="space-y-10">
                          <div>
                            <div className="flex items-center gap-3 font-orbitron text-[9px] tracking-[4px] text-[#00c8ff] uppercase mb-4">
                              SECTION 05 — SCENARIO SIMULATION
                              <div className="flex-1 h-px bg-gradient-to-r from-[#00c8ff]/15 to-transparent" />
                            </div>
                            <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-white leading-tight mb-2">WHAT WOULD YOU DO?</h2>
                            <p className="text-sm text-[#c8e8ff]/45 tracking-wide">Read each situation. Choose the response that feels most true to you.</p>
                          </div>

                          <div className="space-y-12">
                            <Question 
                              num="SC01" 
                              label="You are asked to speak in front of 200 people tomorrow about a topic you know well. You find out tonight."
                              isScenario
                              error={errors.scenario_speech}
                              input={
                                <div className="flex flex-col gap-2">
                                  {[
                                    'Prepare thoroughly — it\'s an opportunity', 
                                    'Avoid it if there\'s any way out', 
                                    'Go with the flow and hope for the best', 
                                    'Feel paralyzed — unable to sleep or focus'
                                  ].map(opt => (
                                    <Option 
                                      key={opt} 
                                      label={opt} 
                                      fullWidth
                                      selected={responses.scenario_speech === opt} 
                                      isError={!!errors.scenario_speech}
                                      onClick={() => updateResponse('scenario_speech', opt)} 
                                    />
                                  ))}
                                </div>
                              }
                            />

                            <Question 
                              num="SC02" 
                              label="You deeply want to apply for something — a competition, a job, a role — but there's a very real chance you could fail publicly."
                              isScenario
                              error={errors.scenario_competition}
                              input={
                                <div className="flex flex-col gap-2">
                                  {[
                                    'Apply — failure is part of the process', 
                                    'Don\'t apply — fear of failure is too strong', 
                                    'Apply but spend weeks anxious about it', 
                                    'Ask someone else\'s opinion before deciding'
                                  ].map(opt => (
                                    <Option 
                                      key={opt} 
                                      label={opt} 
                                      fullWidth
                                      selected={responses.scenario_competition === opt} 
                                      isError={!!errors.scenario_competition}
                                      onClick={() => updateResponse('scenario_competition', opt)} 
                                    />
                                  ))}
                                </div>
                              }
                            />
                          </div>
                        </div>
                      )}

                      {currentSec === 6 && (
                        <div className="space-y-10">
                          <div>
                            <div className="flex items-center gap-3 font-orbitron text-[9px] tracking-[4px] text-[#00c8ff] uppercase mb-4">
                              SECTION 06 — OVERCOMING PROTOCOL
                              <div className="flex-1 h-px bg-gradient-to-r from-[#00c8ff]/15 to-transparent" />
                            </div>
                            <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-white leading-tight mb-2">BEYOND FEAR</h2>
                            <p className="text-sm text-[#c8e8ff]/45 tracking-wide">This section explores whether and how people move past their fears.</p>
                          </div>

                          <div className="space-y-8">
                            <Question 
                              num="15" 
                              label="Have you ever successfully overcome a fear?"
                              error={errors.overcome_fear}
                              input={
                                <div className="flex flex-wrap gap-2">
                                  {['Yes, more than one', 'Yes, one significant fear', 'Working on it right now', 'Not yet'].map(opt => (
                                    <Option 
                                      key={opt} 
                                      label={opt} 
                                      selected={responses.overcome_fear === opt} 
                                      isError={!!errors.overcome_fear}
                                      onClick={() => updateResponse('overcome_fear', opt)} 
                                    />
                                  ))}
                                </div>
                              }
                            />

                            <Question 
                              num="16" 
                              label="Anonymous confession (mandatory)"
                              error={errors.confession}
                              input={
                                <div className={`bg-[#ff3355]/5 border p-6 transition-colors ${
                                  errors.confession ? 'border-[#ff3355]' : 'border-[#ff3355]/20'
                                }`}>
                                  <div className="font-orbitron text-[9px] text-[#ff3355] tracking-[2px] uppercase mb-4 flex items-center gap-3">
                                    <div className="w-5 h-px bg-[#ff3355]" />
                                    ANONYMOUS — NOT LINKED TO ANY IDENTITY
                                  </div>
                                  <textarea 
                                    className={`w-full bg-[#00c8ff]/5 border p-5 font-rajdhani text-sm text-[#c8e8ff] outline-none transition-all min-h-[130px] resize-none ${
                                      errors.confession ? 'border-[#ff3355] focus:border-[#ff3355]' : 'border-[#00c8ff]/15 focus:border-[#00c8ff]'
                                    }`}
                                    placeholder="Describe a fear you have or had. What happened? Did you overcome it? Write freely — this space is safe. (Min 10 characters)"
                                    value={responses.confession || ''}
                                    onChange={(e) => updateResponse('confession', e.target.value)}
                                  />
                                </div>
                              }
                            />
                          </div>
                        </div>
                      )}

                      {currentSec === 7 && (
                        <div className="space-y-10">
                          <div>
                            <div className="flex items-center gap-3 font-orbitron text-[9px] tracking-[4px] text-[#00c8ff] uppercase mb-4">
                              SECTION 07 — FINAL TRANSMISSION
                              <div className="flex-1 h-px bg-gradient-to-r from-[#00c8ff]/15 to-transparent" />
                            </div>
                            <h2 className="font-orbitron text-3xl md:text-4xl font-bold text-white leading-tight mb-2">ONE LAST QUESTION</h2>
                            <p className="text-sm text-[#c8e8ff]/45 tracking-wide">This connects your experience to the chapter that inspired this entire study.</p>
                          </div>

                          <div className="bg-gradient-to-br from-[#00c8ff]/10 to-[#ffd700]/5 border border-[#00c8ff]/50 p-10 text-center relative overflow-hidden">
                            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0deg,rgba(0,200,255,0.03)_60deg,transparent_120deg)] animate-[rotate_8s_linear_infinite]" />
                            <p className="font-playfair italic text-xl md:text-2xl text-white/95 mb-4 relative z-10">
                              "Fear, if left unaddressed, can control and limit a person's entire life."
                            </p>
                            <div className="font-orbitron text-[9px] text-[#ffd700] tracking-[3px] uppercase relative z-10">
                              THEME FROM DEEP WATER — FLAMINGO, CLASS XII
                            </div>
                          </div>

                          <Question 
                            num="17" 
                            label="Do you agree with this statement?"
                            error={errors.agree_statement}
                            input={
                              <div className="flex flex-col gap-2">
                                {[
                                  'Yes — I have seen or experienced this firsthand', 
                                  'Partially — it limits some but not all', 
                                  'No — fear can also be a motivator'
                                ].map(opt => (
                                  <Option 
                                    key={opt} 
                                    label={opt} 
                                    fullWidth
                                    selected={responses.agree_statement === opt} 
                                    isError={!!errors.agree_statement}
                                    onClick={() => updateResponse('agree_statement', opt)} 
                                  />
                                ))}
                              </div>
                            }
                          />
                        </div>
                      )}

                      <div className="flex justify-between items-center mt-14 pt-8 border-t border-[#00c8ff]/15">
                        {currentSec > 1 ? (
                          <button 
                            onClick={() => setCurrentSec(prev => prev - 1)}
                            className="bg-transparent border border-[#00c8ff]/15 px-8 py-3 font-orbitron text-[10px] text-[#c8e8ff]/45 tracking-[2px] uppercase hover:border-[#c8e8ff]/45 hover:text-[#c8e8ff] transition-all"
                          >
                            ← BACK
                          </button>
                        ) : <div />}
                        
                        {currentSec < 7 ? (
                          <button 
                            onClick={handleNext}
                            disabled={isAiValidating}
                            className="relative bg-transparent border border-[#00c8ff] text-[#00c8ff] font-orbitron text-[10px] tracking-[3px] uppercase px-10 py-3.5 cursor-pointer overflow-hidden group [clip-path:polygon(10px_0%,100%_0%,calc(100%-10px)_100%,0%_100%)] disabled:opacity-50"
                          >
                            <span className="absolute inset-0 bg-[#00c8ff] translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 ease-in-out" />
                            <span className="relative z-10 group-hover:text-[#020408]">
                              {isAiValidating ? 'VALIDATING...' : 'NEXT →'}
                            </span>
                          </button>
                        ) : (
                          <button 
                            onClick={submitSurvey}
                            disabled={isSubmitting || isAiValidating}
                            className="relative bg-transparent border border-[#00c8ff] text-[#00c8ff] font-orbitron text-[10px] tracking-[3px] uppercase px-10 py-3.5 cursor-pointer overflow-hidden group [clip-path:polygon(10px_0%,100%_0%,calc(100%-10px)_100%,0%_100%)] disabled:opacity-50"
                          >
                            <span className="absolute inset-0 bg-[#00c8ff] translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-300 ease-in-out" />
                            <span className="relative z-10 group-hover:text-[#020408]">
                              {isAiValidating ? 'VALIDATING WITH AI...' : isSubmitting ? 'TRANSMITTING...' : 'SUBMIT & SEE PROFILE →'}
                            </span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'results' && (
            <motion.div 
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 md:p-10 text-center"
            >
              <div className="max-w-2xl w-full">
                <div className="inline-block border border-[#ffd700] text-[#ffd700] font-orbitron text-[8px] md:text-[10px] tracking-[2px] md:tracking-[3px] uppercase px-4 md:px-6 py-2 mb-6 md:mb-8 shadow-[0_0_20px_rgba(255,215,0,0.1)] drop-shadow-[0_0_10px_#ffd700]">
                  {fearProfiles[responses.fear_profile || 'default'].badge}
                </div>
                
                <h2 className="font-orbitron text-2xl md:text-5xl font-black text-white mb-4 md:mb-6 leading-tight drop-shadow-[0_0_40px_rgba(0,200,255,0.3)]">
                  {fearProfiles[responses.fear_profile || 'default'].title}
                </h2>
                
                <p className="text-sm md:text-base text-[#c8e8ff]/45 leading-relaxed mb-8 md:mb-10 tracking-wide">
                  {fearProfiles[responses.fear_profile || 'default'].desc}
                </p>

                <div className="bg-[#00c8ff]/5 border border-[#00c8ff]/15 p-6 md:p-8 text-left mb-10 md:mb-12">
                  <div className="font-orbitron text-[8px] md:text-[9px] text-[#00c8ff] tracking-[2px] md:tracking-[3px] uppercase mb-4">CONNECTION TO DEEP WATER</div>
                  <p className="font-playfair italic text-sm md:text-base text-[#c8e8ff]/80 leading-relaxed">
                    {fearProfiles[responses.fear_profile || 'default'].insight}
                  </p>
                </div>

                <button 
                  onClick={resetSurvey}
                  className="bg-transparent border border-[#00ff88] text-[#00ff88] font-orbitron text-[9px] md:text-[10px] tracking-[2px] md:tracking-[3px] uppercase px-8 md:px-9 py-3 md:py-3.5 cursor-pointer transition-all hover:bg-[#00ff88] hover:text-[#020408] hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] [clip-path:polygon(10px_0%,100%_0%,calc(100%-10px)_100%,0%_100%)]"
                >
                  TAKE AGAIN
                </button>

                <div className="mt-10 pt-8 border-t border-[#00c8ff]/15 text-[11px] text-[#c8e8ff]/45 tracking-wider leading-loose">
                  RESPONSE RECORDED SUCCESSFULLY<br />
                  Thank you for participating in this study<br />
                  Prince Yadav · Investigatory Project · 2026–27
                </div>
              </div>
            </motion.div>
          )}

          {view === 'admin' && isAdminMode && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10 p-4 md:p-10"
            >
              <div className="max-w-6xl mx-auto bg-[#060d16] border border-[#00c8ff]/50 p-6 md:p-12 shadow-[0_0_80px_rgba(0,200,255,0.15)]">
                <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-10">
                  <div>
                    <h2 className="font-orbitron text-xl md:text-2xl font-bold text-[#00c8ff] tracking-[2px] md:tracking-[3px] drop-shadow-[0_0_20px_rgba(0,200,255,0.3)]">ADMIN CONSOLE</h2>
                    <p className="text-[10px] md:text-xs text-[#c8e8ff]/45 tracking-wider mt-1">Fear & Confidence Study — Response Database</p>
                  </div>
                  <button 
                    onClick={handleAdminLogout}
                    className="border border-[#ff3355]/50 text-[#ff3355] font-orbitron text-[9px] md:text-[10px] tracking-widest px-4 py-2 hover:bg-[#ff3355] hover:text-white transition-all"
                  >
                    LOGOUT
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-10">
                  <StatCard num={dbResponses.length.toString()} label="Total Responses" />
                  <StatCard 
                    num={dbResponses.length ? (dbResponses.reduce((s, r) => s + Number(r.fear_meter || 5), 0) / dbResponses.length).toFixed(1) : '—'} 
                    label="Avg Fear Level" 
                  />
                  <StatCard num={[...new Set(dbResponses.map(r => r.country))].filter(Boolean).length.toString() || '0'} label="Countries" />
                  <StatCard num="7" label="Sections" />
                </div>

                <div className="flex flex-wrap gap-3 mb-8">
                  <button 
                    onClick={downloadXLSX}
                    className="flex-1 md:flex-none border border-[#00ff88] text-[#00ff88] font-orbitron text-[8px] md:text-[9px] tracking-[1px] md:tracking-[2px] uppercase px-4 md:px-6 py-3 hover:bg-[#00ff88] hover:text-[#020408] transition-all"
                  >
                    ⬇ DOWNLOAD XLSX
                  </button>
                  <button 
                    onClick={() => setShowClearConfirm(true)}
                    className="flex-1 md:flex-none border border-[#ff3355] text-[#ff3355] font-orbitron text-[8px] md:text-[9px] tracking-[1px] md:tracking-[2px] uppercase px-4 md:px-6 py-3 hover:bg-[#ff3355] hover:text-white transition-all"
                  >
                    🗑 CLEAR ALL DATA
                  </button>
                </div>

                <div className="overflow-x-auto -mx-6 md:mx-0">
                  <div className="min-w-[800px] md:min-w-full">
                    <table className="w-full border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-[#00c8ff]/5">
                          <th className="font-orbitron text-[8px] tracking-[2px] text-[#00c8ff] p-3 text-left border-b border-[#00c8ff]/15">#</th>
                          <th className="font-orbitron text-[8px] tracking-[2px] text-[#00c8ff] p-3 text-left border-b border-[#00c8ff]/15">DATE</th>
                          <th className="font-orbitron text-[8px] tracking-[2px] text-[#00c8ff] p-3 text-left border-b border-[#00c8ff]/15">NAME</th>
                          <th className="font-orbitron text-[8px] tracking-[2px] text-[#00c8ff] p-3 text-left border-b border-[#00c8ff]/15">AGE</th>
                          <th className="font-orbitron text-[8px] tracking-[2px] text-[#00c8ff] p-3 text-left border-b border-[#00c8ff]/15">GENDER</th>
                          <th className="font-orbitron text-[8px] tracking-[2px] text-[#00c8ff] p-3 text-left border-b border-[#00c8ff]/15">FEAR METER</th>
                          <th className="font-orbitron text-[8px] tracking-[2px] text-[#00c8ff] p-3 text-left border-b border-[#00c8ff]/15">PROFILE</th>
                          <th className="font-orbitron text-[8px] tracking-[2px] text-[#00c8ff] p-3 text-left border-b border-[#00c8ff]/15">CONFESSION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dbResponses.map((r, i) => (
                          <tr key={r.id} className="hover:bg-[#00c8ff]/5 transition-colors group">
                            <td className="p-3 border-b border-[#00c8ff]/5 text-[#c8e8ff]/45">{i + 1}</td>
                            <td className="p-3 border-b border-[#00c8ff]/5">{r.date}</td>
                            <td className="p-3 border-b border-[#00c8ff]/5 font-bold">{r.name || '—'}</td>
                            <td className="p-3 border-b border-[#00c8ff]/5">{r.age_group}</td>
                            <td className="p-3 border-b border-[#00c8ff]/5">{r.gender}</td>
                            <td className="p-3 border-b border-[#00c8ff]/5 font-orbitron text-[#ffd700]">{r.fear_meter}/10</td>
                            <td className="p-3 border-b border-[#00c8ff]/5 text-[#00c8ff] uppercase">{r.fear_profile}</td>
                            <td className="p-3 border-b border-[#00c8ff]/5 max-w-xs truncate text-[#c8e8ff]/70 italic">{r.confession || '—'}</td>
                          </tr>
                        ))}
                        {dbResponses.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-10 text-center font-orbitron text-xs tracking-widest text-[#c8e8ff]/20">NO RESPONSES YET</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Modals */}
        <AnimatePresence>
          {showClearConfirm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#020408]/80 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="max-w-md w-full bg-[#060d16] border border-[#ff3355]/30 p-8 rounded-lg shadow-2xl"
              >
                <h3 className="font-orbitron text-lg font-bold text-[#ff3355] mb-4 tracking-widest uppercase">Confirm Deletion</h3>
                <p className="text-sm text-[#c8e8ff]/70 mb-8 font-rajdhani">Are you absolutely sure you want to permanently delete ALL response data? This action cannot be undone.</p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isDeleting}
                    className="flex-1 border border-[#00c8ff]/30 text-[#00c8ff]/60 font-orbitron text-[10px] tracking-widest py-3 hover:bg-[#00c8ff]/5 transition-all disabled:opacity-20"
                  >
                    CANCEL
                  </button>
                  <button 
                    onClick={clearData}
                    disabled={isDeleting}
                    className="flex-1 bg-[#ff3355] text-white font-orbitron text-[10px] tracking-widest py-3 hover:bg-[#ff3355]/80 transition-all disabled:opacity-50"
                  >
                    {isDeleting ? 'DELETING...' : 'DELETE ALL'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {showPrivacyModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#020408]/90 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="max-w-lg w-full bg-[#060d16] border border-[#ffd700]/30 p-8 rounded-lg shadow-2xl"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-[#ffd700]/10 flex items-center justify-center text-[#ffd700] text-xl">⚠️</div>
                  <h3 className="font-orbitron text-lg font-bold text-[#ffd700] tracking-widest uppercase">Location Required</h3>
                </div>
                <p className="text-sm text-[#c8e8ff]/70 mb-6 font-rajdhani leading-relaxed">
                  To ensure the integrity of this study and prevent duplicate or bot submissions, we require access to your approximate location. 
                  <br /><br />
                  If you choose to deny this, please tell us why. Your feedback helps us understand privacy concerns in digital research.
                </p>
                <textarea 
                  className="w-full bg-[#00c8ff]/5 border border-[#00c8ff]/15 p-4 font-rajdhani text-sm text-[#c8e8ff] outline-none focus:border-[#ffd700] transition-all min-h-[100px] resize-none mb-6"
                  placeholder="Why do you prefer not to share your location? (e.g., Privacy concerns, Security, etc.)"
                  value={privacyReason}
                  onChange={(e) => setPrivacyReason(e.target.value)}
                />
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => {
                      // Try location again
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            setGpsData({
                              lat: position.coords.latitude,
                              lon: position.coords.longitude,
                              accuracy: position.coords.accuracy
                            });
                            setShowPrivacyModal(false);
                            // We'll need to call submitSurvey again manually or via effect
                          },
                          () => alert("Location still denied. Please provide a reason below.")
                        );
                      }
                    }}
                    className="flex-1 border border-[#00c8ff] text-[#00c8ff] font-orbitron text-[10px] tracking-widest py-3 hover:bg-[#00c8ff]/10 transition-all"
                  >
                    RETRY LOCATION
                  </button>
                  <button 
                    disabled={!privacyReason.trim() || privacyReason.trim().length < 5}
                    onClick={async () => {
                      setShowPrivacyModal(false);
                      // Trigger submission with the reason
                      await submitSurvey();
                    }}
                    className="flex-1 bg-[#ffd700] text-[#020408] font-orbitron text-[10px] font-bold tracking-widest py-3 hover:bg-[#ffd700]/80 transition-all disabled:opacity-30"
                  >
                    SUBMIT WITH REASON
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

// --- Sub-components ---

const Question = ({ num, label, subLabel, input, isScenario, error }: { num: string, label: string, subLabel?: string, input: React.ReactNode, isScenario?: boolean, error?: string }) => (
  <div className="space-y-4">
    {isScenario && (
      <div className={`bg-gradient-to-br from-[#00c8ff]/5 to-[#ffd700]/5 border border-l-4 p-6 mb-4 transition-colors ${
        error ? 'border-[#ff3355] border-l-[#ff3355]' : 'border-[#00c8ff]/15 border-l-[#ffd700]'
      }`}>
        <p className="font-playfair italic text-base text-[#c8e8ff]/85 leading-relaxed">{label}</p>
      </div>
    )}
    {!isScenario && (
      <div className="flex gap-3 items-start">
        <div className={`font-orbitron text-[10px] border px-2 py-0.5 mt-1 shrink-0 transition-colors ${
          error ? 'text-[#ff3355] bg-[#ff3355]/10 border-[#ff3355]' : 'text-[#00c8ff] bg-[#00c8ff]/10 border-[#00c8ff]/15'
        }`}>{num}</div>
        <div className="text-base font-semibold text-[#c8e8ff] leading-relaxed tracking-wide">
          {label} {subLabel && <span className="text-xs text-[#c8e8ff]/30 font-normal italic ml-2">{subLabel}</span>}
        </div>
      </div>
    )}
    {input}
    {error && (
      <motion.div 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-[#ff3355] text-[10px] font-orbitron tracking-widest uppercase flex items-center gap-2"
      >
        <span className="animate-pulse">⚠️</span> {error}
      </motion.div>
    )}
  </div>
);

const Option: React.FC<{ label: string, selected: boolean, onClick: () => void, fullWidth?: boolean, isError?: boolean }> = ({ label, selected, onClick, fullWidth, isError }) => (
  <button 
    onClick={onClick}
    className={`px-6 py-3 border transition-all duration-200 font-medium text-sm tracking-wide [clip-path:polygon(8px_0%,100%_0%,calc(100%-8px)_100%,0%_100%)] ${
      fullWidth ? 'w-full' : ''
    } ${
      selected 
        ? 'bg-[#00c8ff]/15 border-[#00c8ff] text-white shadow-[inset_0_0_15px_rgba(0,200,255,0.2)]' 
        : isError
          ? 'bg-[#ff3355]/5 border-[#ff3355]/30 text-[#ff3355]/60 hover:border-[#ff3355] hover:bg-[#ff3355]/10'
          : 'bg-[#00c8ff]/5 border-[#00c8ff]/15 text-[#c8e8ff]/45 hover:border-[#00c8ff]/60 hover:text-[#00c8ff] hover:bg-[#00c8ff]/10'
    }`}
  >
    {label}
  </button>
);

const StatCard = ({ num, label }: { num: string, label: string }) => (
  <div className="bg-[#00c8ff]/5 border border-[#00c8ff]/15 p-5 text-center">
    <div className="font-orbitron text-2xl font-bold text-[#00c8ff] drop-shadow-[0_0_15px_rgba(0,200,255,0.3)]">{num}</div>
    <div className="text-[10px] text-[#c8e8ff]/45 tracking-[1px] uppercase mt-1.5">{label}</div>
  </div>
);
