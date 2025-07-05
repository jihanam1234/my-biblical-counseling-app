import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp } from 'firebase/firestore';

// Ensure __app_id and __firebase_config are defined in the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};

function App() {
  const [problemInput, setProblemInput] = useState('');
  const [counselResponse, setCounselResponse] = useState('');
  const [prayerPrompt, setPrayerPrompt] = useState('');
  const [actionableSteps, setActionableSteps] = useState('');
  const [isLoadingCounsel, setIsLoadingCounsel] = useState(false);
  const [isLoadingPrayer, setIsLoadingPrayer] = useState(false);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [error, setError] = useState('');
  const [counselingHistory, setCounselingHistory] = useState([]);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Initialize Firebase and handle authentication
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);
      setDb(firestore);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
          setIsAuthReady(true);
        } else {
          // If no user, try to sign in with custom token or anonymously
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            try {
              await signInWithCustomToken(firebaseAuth, __initial_auth_token);
            } catch (authError) {
              console.error("Error signing in with custom token:", authError);
              await signInAnonymously(firebaseAuth);
            }
          } else {
            await signInAnonymously(firebaseAuth);
          }
        }
      });

      return () => unsubscribe(); // Cleanup auth listener
    } catch (e) {
      console.error("Error initializing Firebase:", e);
      setError("Failed to initialize the app. Please try again.");
    }
  }, []);

  // Listen for counseling history changes from Firestore
  useEffect(() => {
    if (db && userId && isAuthReady) {
      const q = query(
        collection(db, `artifacts/${appId}/users/${userId}/counselingSessions`),
        // orderBy is avoided as per instructions to prevent index missing errors.
        // Data will be sorted in memory.
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const sessions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        // Sort by timestamp in descending order (most recent first)
        sessions.sort((a, b) => (b.timestamp?.toDate() || 0) - (a.timestamp?.toDate() || 0));
        setCounselingHistory(sessions);
      }, (err) => {
        console.error("Error fetching counseling history:", err);
        setError("Failed to load past sessions.");
      });

      return () => unsubscribe(); // Cleanup snapshot listener
    }
  }, [db, userId, isAuthReady, appId]);

  const callGeminiAPI = async (prompt) => {
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    };

    const apiKey = ""; // Canvas will automatically provide this at runtime
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.candidates && result.candidates.length > 0 &&
        result.candidates[0].content && result.candidates[0].content.parts &&
        result.candidates[0].content.parts.length > 0) {
      return result.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Could not get a response from the AI.");
    }
  };

  const handleGetCounsel = async () => {
    if (!problemInput.trim()) {
      setError("Please enter a problem or question to receive counsel.");
      return;
    }
    if (!db || !userId) {
      setError("App is not ready. Please wait a moment or refresh.");
      return;
    }

    setIsLoadingCounsel(true);
    setCounselResponse('');
    setPrayerPrompt(''); // Clear previous generated content
    setActionableSteps(''); // Clear previous generated content
    setError('');

    try {
      const prompt = `Provide biblical counsel, wisdom, and encouragement for the following situation or question. Focus on relevant scripture and Christian principles, offering practical guidance. The input is: "${problemInput}"`;
      const text = await callGeminiAPI(prompt);
      setCounselResponse(text);

      // Save to Firestore
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/counselingSessions`), {
        problem: problemInput,
        counsel: text,
        timestamp: serverTimestamp(),
        userId: userId
      });

    } catch (apiError) {
      console.error("Error fetching biblical counsel:", apiError);
      setError("Failed to get counsel. Please check your internet connection and try again.");
    } finally {
      setIsLoadingCounsel(false);
    }
  };

  const handleGeneratePrayerPrompt = async () => {
    if (!problemInput.trim()) {
      setError("Please enter a problem or question first to generate a prayer prompt.");
      return;
    }
    setIsLoadingPrayer(true);
    setPrayerPrompt('');
    setError('');

    try {
      const prompt = `Based on the following problem: "${problemInput}", generate a concise prayer prompt or a short prayer focusing on seeking God's wisdom, strength, and comfort.`;
      const text = await callGeminiAPI(prompt);
      setPrayerPrompt(text);
    } catch (apiError) {
      console.error("Error generating prayer prompt:", apiError);
      setError("Failed to generate prayer prompt. Please try again.");
    } finally {
      setIsLoadingPrayer(false);
    }
  };

  const handleSuggestActionableSteps = async () => {
    if (!counselResponse.trim()) {
      setError("Please get biblical counsel first to suggest actionable steps.");
      return;
    }
    setIsLoadingActions(true);
    setActionableSteps('');
    setError('');

    try {
      const prompt = `Based on the following biblical counsel: "${counselResponse}", and the original problem: "${problemInput}", suggest 3-5 practical, actionable steps or reflection questions a person can take to apply this counsel in their life.`;
      const text = await callGeminiAPI(prompt);
      setActionableSteps(text);
    } catch (apiError) {
      console.error("Error suggesting actionable steps:", apiError);
      setError("Failed to suggest actionable steps. Please try again.");
    } finally {
      setIsLoadingActions(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 flex flex-col items-center p-4 font-inter text-gray-800">
      <div className="w-full max-w-3xl bg-white shadow-xl rounded-xl p-8 space-y-8 my-8">
        <h1 className="text-4xl font-extrabold text-center text-blue-700 mb-6">
          Biblical Counsel
        </h1>

        {userId && (
          <p className="text-sm text-center text-gray-600 mb-4">
            User ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded-md text-xs">{userId}</span>
          </p>
        )}

        <div className="space-y-4">
          <label htmlFor="problemInput" className="block text-lg font-semibold text-gray-700">
            What's on your heart or mind?
          </label>
          <textarea
            id="problemInput"
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out shadow-sm resize-y min-h-[100px]"
            rows="5"
            placeholder="Describe your situation, question, or struggle here..."
            value={problemInput}
            onChange={(e) => setProblemInput(e.target.value)}
            disabled={isLoadingCounsel || isLoadingPrayer || isLoadingActions}
          ></textarea>
          <button
            onClick={handleGetCounsel}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            disabled={isLoadingCounsel || isLoadingPrayer || isLoadingActions}
          >
            {isLoadingCounsel ? (
              <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'Get Biblical Counsel ✨'
            )}
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
            <strong className="font-bold">Error!</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        {counselResponse && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-md">
            <h2 className="text-2xl font-bold text-blue-800 mb-4">Counsel from God's Word:</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{counselResponse}</p>

            <div className="mt-6 flex flex-col sm:flex-row gap-4">
              <button
                onClick={handleGeneratePrayerPrompt}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                disabled={isLoadingPrayer || isLoadingCounsel || isLoadingActions}
              >
                {isLoadingPrayer ? (
                  <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  'Generate Prayer Prompt ✨'
                )}
              </button>
              <button
                onClick={handleSuggestActionableSteps}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                disabled={isLoadingActions || isLoadingCounsel || isLoadingPrayer}
              >
                {isLoadingActions ? (
                  <svg className="animate-spin h-5 w-5 text-white mr-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  'Suggest Actionable Steps ✨'
                )}
              </button>
            </div>
          </div>
        )}

        {prayerPrompt && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 shadow-md mt-4">
            <h2 className="text-2xl font-bold text-green-800 mb-4">Prayer Prompt:</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{prayerPrompt}</p>
          </div>
        )}

        {actionableSteps && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 shadow-md mt-4">
            <h2 className="text-2xl font-bold text-purple-800 mb-4">Actionable Steps & Reflection:</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{actionableSteps}</p>
          </div>
        )}

        {counselingHistory.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-blue-800 text-center">Your Past Sessions</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-inner max-h-96 overflow-y-auto">
              {counselingHistory.map((session) => (
                <div key={session.id} className="mb-4 p-4 bg-white rounded-lg shadow-sm border border-gray-100">
                  <p className="text-sm text-gray-500 mb-1">
                    {session.timestamp ? new Date(session.timestamp.toDate()).toLocaleString() : 'Loading date...'}
                  </p>
                  <p className="font-semibold text-gray-800 mb-2">
                    <span className="text-blue-600">Problem:</span> {session.problem}
                  </p>
                  <p className="text-gray-700 leading-relaxed">
                    <span className="text-blue-600 font-semibold">Counsel:</span> {session.counsel}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
