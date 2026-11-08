import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  UtensilsCrossed,
  Camera,
  Sparkles,
  ChefHat,
  Trash2,
  Activity,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useSession } from "../context/SessionContext";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    sessionId,
    ingredients,
    recipeSuggestions,
    selectedRecipe,
    clearSession,
    systemHealth,
  } = useSession();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleClearSession = async () => {
    setClearing(true);
    try {
      await clearSession();
      navigate("/detect");
    } finally {
      setClearing(false);
      setMobileMenuOpen(false);
    }
  };

  const navItems = [
    {
      name: "Ingredients",
      path: "/detect",
      icon: Camera,
      badge: ingredients.length > 0 ? ingredients.length : null,
    },
    {
      name: "Recipes",
      path: "/recipes",
      icon: Sparkles,
      badge: recipeSuggestions.length > 0 ? recipeSuggestions.length : null,
    },
  ];

  if (selectedRecipe) {
    navItems.push({
      name: "Cooking Mode",
      path: `/cook/${selectedRecipe.id}`,
      icon: ChefHat,
    });
  }

  const yoloReady = Boolean(systemHealth?.inferenceService?.model_loaded);
  const backendOnline = systemHealth && systemHealth.status !== "offline";

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          to="/"
          className="flex items-center gap-3 group"
        >
          <div className="w-10 h-10 rounded-md bg-emerald-700 flex items-center justify-center text-white ">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              Fridge2Food
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
                {item.badge !== null && item.badge !== undefined && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-600 text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Status Indicator & Clear Session */}
        <div className="hidden md:flex items-center gap-3">
          <div
            title={
              yoloReady
                ? "Fine-tuned YOLO11s model loaded and ready"
                : backendOnline
                ? "Backend online (Verify fridge_to_plate_yolo11s.pt in models/)"
                : "Backend server offline"
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              yoloReady
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : backendOnline
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}
          >
            {yoloReady ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            <span>
              {yoloReady
                ? "Detector ready"
                : backendOnline
                ? "Check Model / FastAPI"
                : "Backend Offline"}
            </span>
          </div>

          {(sessionId || ingredients.length > 0) && (
            <button
              type="button"
              onClick={handleClearSession}
              disabled={clearing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{clearing ? "Clearing..." : "Clear Session"}</span>
            </button>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-600 text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          {(sessionId || ingredients.length > 0) && (
            <button
              type="button"
              onClick={handleClearSession}
              disabled={clearing}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200"
            >
              <Trash2 className="w-4 h-4" />
              <span>{clearing ? "Clearing Session..." : "Clear Session"}</span>
            </button>
          )}
        </div>
      )}
    </header>
  );
}
