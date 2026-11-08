import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SessionProvider } from "./context/SessionContext";
import Navbar from "./components/Navbar";
import DetectionPage from "./pages/DetectionPage";
import RecipesPage from "./pages/RecipesPage";
import CookingPage from "./pages/CookingPage";

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-stone-50 text-slate-900">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Navigate to="/detect" replace />} />
              <Route path="/detect" element={<DetectionPage />} />
              <Route path="/recipes" element={<RecipesPage />} />
              <Route path="/cook/:recipeId" element={<CookingPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </SessionProvider>
  );
}
