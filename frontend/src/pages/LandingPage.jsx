import React from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  Sparkles,
  ChefHat,
  ArrowRight,
  ScanLine,
  CheckCircle2,
  Sliders,
  ShieldCheck,
  Cpu,
  Layers,
} from "lucide-react";

export default function LandingPage() {
  const workflowSteps = [
    {
      step: "01",
      title: "Upload Fridge or Ingredient Photos",
      description:
        "Snap a single wide photo of your open refrigerator or upload multiple separate photos of individual ingredients (JPG, PNG, WEBP).",
      icon: Camera,
      color: "bg-emerald-100 text-emerald-700",
    },
    {
      step: "02",
      title: "YOLO11s Computer Vision Detection",
      description:
        "Our local fine-tuned 26-class YOLO11s model (fridge_to_plate_yolo11s.pt) detects food items with bounding boxes and confidence scores.",
      icon: ScanLine,
      color: "bg-blue-100 text-blue-700",
    },
    {
      step: "03",
      title: "Review, Edit & Confirm Your List",
      description:
        "Add extra items, adjust quantities, or refine detections. Your confirmed ingredient list becomes the single source of truth.",
      icon: Sliders,
      color: "bg-amber-100 text-amber-700",
    },
    {
      step: "04",
      title: "Two-Stage Gemini Culinary Assistant",
      description:
        "Explore 5–8 tailored recipe cards first, then unlock full step-by-step interactive cooking instructions only for the dish you choose.",
      icon: ChefHat,
      color: "bg-purple-100 text-purple-700",
    },
  ];

  const sampleBoundingBoxes = [
    {
      label: "Roma Tomato 96.4%",
      pos: "top-6 left-6 w-36 h-28",
      border: "border-emerald-400 bg-emerald-500/15",
      badge: "bg-emerald-600",
    },
    {
      label: "Red Onion 92.1%",
      pos: "top-12 right-8 w-32 h-28",
      border: "border-amber-400 bg-amber-500/15",
      badge: "bg-amber-600",
    },
    {
      label: "Bell Pepper 89.8%",
      pos: "bottom-8 left-12 w-36 h-28",
      border: "border-blue-400 bg-blue-500/15",
      badge: "bg-blue-600",
    },
    {
      label: "Fresh Garlic 94.2%",
      pos: "bottom-10 right-10 w-28 h-24",
      border: "border-pink-400 bg-pink-500/15",
      badge: "bg-pink-600",
    },
  ];

  return (
    <div className="space-y-16 sm:space-y-24 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-10 sm:pt-16 lg:pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Hero Copy */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Fine-Tuned YOLO11s Vision + Two-Stage Gemini AI</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
                Turn Your Ingredients Into{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
                  Something Delicious.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                Fridge2Food recognizes fresh ingredients directly from your kitchen or fridge photos using a custom-trained 26-class{" "}
                <code className="px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-800 text-sm font-mono">
                  YOLO11s
                </code>{" "}
                object detection model, lets you fine-tune your pantry list, and crafts personalized recipes with interactive step-by-step guidance powered by Gemini.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/detect"
                  className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/25 transition-all hover:-translate-y-0.5"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-base font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 shadow-sm transition-colors"
                >
                  <span>How It Works</span>
                </a>
              </div>

              {/* Feature Pills */}
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
                <div className="flex items-center gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-sm">
                  <Cpu className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Local 640&times;640 YOLO11s</span>
                </div>
                <div className="flex items-center gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-sm">
                  <Layers className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Multi-Photo &amp; Fridge Modes</span>
                </div>
                <div className="flex items-center gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-slate-200/80 shadow-sm">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Private Session Storage</span>
                </div>
              </div>
            </div>

            {/* Visual Food / Ingredient Detection Showcase Card */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl bg-slate-900 p-5 sm:p-6 shadow-2xl border border-slate-800">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-semibold text-white">
                      fridge_to_plate_yolo11s.pt
                    </span>
                  </div>
                  <span className="font-mono text-[11px] bg-slate-800 px-2.5 py-1 rounded-md text-emerald-400">
                    conf &ge; 0.40 &bull; 640&times;640
                  </span>
                </div>

                {/* Simulated Interactive Detection Stage */}
                <div className="mt-4 relative h-72 rounded-2xl bg-gradient-to-br from-slate-800 via-slate-850 to-slate-900 border border-slate-700/80 overflow-hidden p-4">
                  {/* Decorative Kitchen Grid */}
                  <div
                    className="absolute inset-0 opacity-15"
                    style={{
                      backgroundImage:
                        "radial-gradient(#10b981 1px, transparent 1px)",
                      backgroundSize: "18px 18px",
                    }}
                  />

                  {sampleBoundingBoxes.map((box) => (
                    <div
                      key={box.label}
                      className={`absolute ${box.pos} border-2 ${box.border} rounded-xl flex items-start justify-start p-1.5 transition-transform hover:scale-105`}
                    >
                      <span
                        className={`${box.badge} text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow`}
                      >
                        {box.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bottom Ingredient Match Preview */}
                <div className="mt-4 bg-slate-800/90 rounded-2xl p-4 border border-slate-700/70 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      4 Ingredients Ready to Confirm
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Shakshuka, Roasted Tomato Pasta &amp; 6 more matches
                    </p>
                  </div>
                  <Link
                    to="/detect"
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shrink-0"
                  >
                    Try Yours &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How the Application Works Section */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
            End-to-End Architecture
          </span>
          <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
            How Fridge2Food Works
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            Designed around a clean local pipeline: React Frontend &rarr; Node.js/Express API &rarr; Python FastAPI Service &rarr; Local YOLO11s Model &amp; Two-Stage Gemini AI.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {workflowSteps.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-11 h-11 rounded-xl ${item.color} flex items-center justify-center`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-extrabold text-slate-300 font-mono">
                      STEP {item.step}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
