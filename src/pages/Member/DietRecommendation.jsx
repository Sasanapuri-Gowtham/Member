import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  Loader2,
  AlertTriangle,
  Sparkles,
  Leaf,
  UtensilsCrossed,
} from "lucide-react";
import { getMedicines, getDietPlan, saveDietPlan } from "../../services/firebase";
import { generateDietPlan } from "../../services/GeminiKey";
import "./DietRecommendation.css";

const MEAL_META = {
  breakfast: { emoji: "🌅", label: "Breakfast", cssClass: "breakfast" },
  lunch:    { emoji: "☀️", label: "Lunch",     cssClass: "lunch" },
  snacks:   { emoji: "🍎", label: "Snacks",    cssClass: "snacks" },
  dinner:   { emoji: "🌙", label: "Dinner",    cssClass: "dinner" },
};

export default function DietRecommendation() {
  const [dietPlan, setDietPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [expandedMeal, setExpandedMeal] = useState(null);

  const memberId = localStorage.getItem("userId") || "XixBCGGzCehNB1rZedd11TGWcRI2";

  // Load cached diet plan from Firestore on mount
  useEffect(() => {
    async function loadDietPlan() {
      try {
        setLoading(true);
        const existing = await getDietPlan(memberId);
        if (existing) {
          setDietPlan(existing);
        }
      } catch (err) {
        console.error("Error loading diet plan:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDietPlan();
  }, [memberId]);

  const handleGenerate = useCallback(async () => {
    try {
      setGenerating(true);
      setError(null);

      // 1. Fetch user's medicines
      const medicines = await getMedicines(memberId);
      if (!medicines || medicines.length === 0) {
        setError("No medicines found. Please upload a prescription first.");
        return;
      }

      // 2. Prepare medicine summary for Gemini
      const medSummary = medicines.map((m) => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        timing: m.timing,
        note: m.note,
      }));

      // 3. Call Gemini for diet recommendation
      const plan = await generateDietPlan(medSummary);

      // 4. Save to Firestore
      await saveDietPlan(memberId, plan);

      setDietPlan({ ...plan, generatedAt: new Date().toISOString() });
    } catch (err) {
      console.error("Error generating diet plan:", err);
      setError(err.message || "Failed to generate diet plan. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [memberId]);

  const toggleMeal = (mealKey) => {
    setExpandedMeal((prev) => (prev === mealKey ? null : mealKey));
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="diet-section">
        <div className="diet-loading">
          <Loader2 size={32} className="diet-loading-icon spin" />
          <p>Loading diet plan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="diet-section">
      {/* Header */}
      <div className="diet-header">
        <div className="diet-header-left">
          <div className="diet-header-icon">
            <UtensilsCrossed size={20} />
          </div>
          <div className="diet-header-text">
            <h3>Diet Recommendation</h3>
            <p>Balanced diet based on your medicines</p>
          </div>
        </div>
        <button
          className="diet-generate-btn"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <Loader2 size={16} className="spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              {dietPlan ? "Regenerate" : "Generate"}
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="diet-error">
          <AlertTriangle size={18} className="diet-error-icon" />
          <div className="diet-error-content">
            <p>{error}</p>
            <button className="diet-error-retry" onClick={handleGenerate}>
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!dietPlan && !generating && !error && (
        <div className="diet-empty">
          <Leaf size={44} className="diet-empty-icon" />
          <h4>No diet plan yet</h4>
          <p>
            Generate a personalized diet recommendation based on your current
            medicines for better health outcomes.
          </p>
          <button
            className="diet-generate-btn"
            onClick={handleGenerate}
            disabled={generating}
          >
            <Sparkles size={16} />
            Generate Diet Plan
          </button>
        </div>
      )}

      {/* Generating animation */}
      {generating && !dietPlan && (
        <div className="diet-loading">
          <Loader2 size={36} className="diet-loading-icon spin" />
          <p>Analyzing your medicines...</p>
          <p className="diet-loading-sub">
            Creating a balanced diet plan with Gemini AI
          </p>
        </div>
      )}

      {/* Diet Plan Content */}
      {dietPlan && !generating && (
        <div className="diet-plan-container">
          {dietPlan.generatedAt && (
            <p className="diet-plan-date">
              Last updated:{" "}
              {new Date(dietPlan.generatedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}

          {/* Meal cards */}
          {["breakfast", "lunch", "snacks", "dinner"].map((mealKey) => {
            const meal = dietPlan.meals?.[mealKey];
            if (!meal) return null;
            const meta = MEAL_META[mealKey];
            const isOpen = expandedMeal === mealKey;

            return (
              <div className="diet-meal-card" key={mealKey}>
                <div
                  className="diet-meal-header"
                  onClick={() => toggleMeal(mealKey)}
                >
                  <div className={`diet-meal-icon ${meta.cssClass}`}>
                    {meta.emoji}
                  </div>
                  <div className="diet-meal-info">
                    <p className="diet-meal-name">{meta.label}</p>
                    <p className="diet-meal-summary">
                      {meal.items?.length || 0} recommended items
                    </p>
                  </div>
                  <button
                    className={`diet-meal-toggle ${isOpen ? "open" : ""}`}
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>

                <div className={`diet-meal-body ${isOpen ? "open" : ""}`}>
                  <div className="diet-meal-body-inner">
                    <ul className="diet-food-list">
                      {meal.items?.map((item, idx) => (
                        <li className="diet-food-item" key={idx}>
                          <div className="diet-food-bullet" />
                          <div className="diet-food-text">
                            <div className="diet-food-name">{item.name}</div>
                            {item.detail && (
                              <div className="diet-food-detail">
                                {item.detail}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Tips */}
          {dietPlan.tips && dietPlan.tips.length > 0 && (
            <div className="diet-tips-card">
              <p className="diet-tips-title">
                <Leaf size={15} />
                Dietary Tips
              </p>
              <ul className="diet-tips-list">
                {dietPlan.tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Foods to avoid */}
          {dietPlan.avoid && dietPlan.avoid.length > 0 && (
            <div className="diet-avoid-card">
              <p className="diet-avoid-title">
                <AlertTriangle size={15} />
                Foods to Avoid
              </p>
              <ul className="diet-avoid-list">
                {dietPlan.avoid.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
