'use client';

import { useState, useEffect } from 'react';
import { analyzeImage } from './actions';
import Image from 'next/image';

interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Meal {
  id: string;
  timestamp: number;
  image: string;
  macros: Macros;
  rawText: string;
}

export default function Home() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('nutrition_tracker_meals');
    if (saved) {
      try {
        setMeals(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load meals', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('nutrition_tracker_meals', JSON.stringify(meals));
  }, [meals]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreview(objectUrl);
      setError(null);
    }
  };

  const parseMacros = (text: string): Macros => {
    const getVal = (regex: RegExp) => {
      const match = text.match(regex);
      return match ? parseInt(match[1], 10) : 0;
    };
    return {
      calories: getVal(/# ⚡ (\d+) Calories/),
      protein: getVal(/\*\*Protein:\*\* (\d+)g/),
      carbs: getVal(/\*\*Carbs:\*\* (\d+)g/),
      fat: getVal(/\*\*Fat:\*\* (\d+)g/),
    };
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 300;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          } else {
            reject(new Error('Failed to get canvas context'));
          }
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await analyzeImage(formData);
      if (response.error) {
        setError(response.error);
      } else {
        const text = response.text || '';
        const macros = parseMacros(text);
        const compressedImage = await compressImage(file);

        const newMeal: Meal = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          image: compressedImage,
          macros,
          rawText: text,
        };

        setMeals(prev => [newMeal, ...prev]);
        setFile(null);
        setPreview(null);
      }
    } catch (err) {
      setError('An unexpected error occurred.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const deleteMeal = (id: string) => {
    setMeals(prev => prev.filter(m => m.id !== id));
  };

  const totalMacros = meals.reduce((acc, meal) => ({
    calories: acc.calories + meal.macros.calories,
    protein: acc.protein + meal.macros.protein,
    carbs: acc.carbs + meal.macros.carbs,
    fat: acc.fat + meal.macros.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-4xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
          מעקב תזונה AI
        </h1>

        {/* Summary Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-xl">
          <h2 className="text-2xl font-semibold mb-4 text-gray-200">סיכום יומי</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/20 p-4 rounded-xl text-center">
              <div className="text-3xl font-bold text-green-400">{totalMacros.calories}</div>
              <div className="text-sm text-gray-400">קלוריות</div>
            </div>
            <div className="bg-black/20 p-4 rounded-xl text-center">
              <div className="text-3xl font-bold text-blue-400">{totalMacros.protein}</div>
              <div className="text-sm text-gray-400">חלבון</div>
            </div>
            <div className="bg-black/20 p-4 rounded-xl text-center">
              <div className="text-3xl font-bold text-yellow-400">{totalMacros.carbs}</div>
              <div className="text-sm text-gray-400">פחמימות</div>
            </div>
            <div className="bg-black/20 p-4 rounded-xl text-center">
              <div className="text-3xl font-bold text-red-400">{totalMacros.fat}</div>
              <div className="text-sm text-gray-400">שומן</div>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
          <h2 className="text-xl font-semibold mb-4 text-gray-200">הוסף ארוחה</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col items-center justify-center w-full">
              <label
                htmlFor="image-upload"
                className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-600 rounded-xl cursor-pointer hover:bg-white/5 transition-colors relative overflow-hidden"
              >
                {preview ? (
                  <Image
                    src={preview}
                    alt="Preview"
                    fill
                    className="object-contain p-2"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    <p className="text-sm text-gray-400">לחץ להעלאת ארוחה</p>
                  </div>
                )}
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {preview && (
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all ${loading
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 shadow-lg'
                  }`}
              >
                {loading ? 'מנתח...' : 'הוסף'}
              </button>
            )}
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-center flex flex-col items-center gap-2">
              <p>{error}</p>
              <button
                onClick={() => handleSubmit()}
                className="px-4 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
              >
                נסה שוב
              </button>
            </div>
          )}
        </div>

        {/* Meal History */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-200">היסטוריית ארוחות</h2>
          {meals.length === 0 ? (
            <p className="text-center text-gray-500 py-8">עדיין לא תועדו ארוחות.</p>
          ) : (
            meals.map((meal) => (
              <div key={meal.id} className="bg-white/5 rounded-xl p-4 border border-white/10 flex gap-4 items-start">
                <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-black/20">
                  <Image
                    src={meal.image}
                    alt="Meal"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-grow">
                  <div className="flex justify-between items-start">
                    <div className="text-sm text-gray-400 mb-2">
                      {new Date(meal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <button
                      onClick={() => deleteMeal(meal.id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      מחק
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div className="bg-white/5 p-2 rounded">
                      <div className="font-bold text-green-400">{meal.macros.calories}</div>
                      <div className="text-xs text-gray-500">קל'</div>
                    </div>
                    <div className="bg-white/5 p-2 rounded">
                      <div className="font-bold text-blue-400">{meal.macros.protein}</div>
                      <div className="text-xs text-gray-500">חלבון</div>
                    </div>
                    <div className="bg-white/5 p-2 rounded">
                      <div className="font-bold text-yellow-400">{meal.macros.carbs}</div>
                      <div className="text-xs text-gray-500">פחמ'</div>
                    </div>
                    <div className="bg-white/5 p-2 rounded">
                      <div className="font-bold text-red-400">{meal.macros.fat}</div>
                      <div className="text-xs text-gray-500">שומן</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 line-clamp-2" dir="rtl">
                    {meal.rawText.replace(/# ⚡.*|\*\*Protein:\*\*.*|\*\*Carbs:\*\*.*|\*\*Fat:\*\*.*/g, '').trim()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
