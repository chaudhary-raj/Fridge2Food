import React from "react";
import { UtensilsCrossed, Cpu, Sparkles, ShieldCheck } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200/80 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
              <UtensilsCrossed className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Fridge2Food</p>
              <p className="text-xs text-slate-500">
                Fine-Tuned YOLO11s (`fridge_to_plate_yolo11s.pt`) + Two-Stage Gemini API
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-600" />
              Local YOLO11s Object Detection (640&times;640)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Two-Stage Gemini Recipe Architect
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Ephemeral Session Storage
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
