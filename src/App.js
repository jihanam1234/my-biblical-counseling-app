import React, { useState } from 'react';

function App() {
  const [problemInput, setProblemInput] = useState('');
  const [counselResponse, setCounselResponse] = useState('');
  const [prayerPrompt, setPrayerPrompt] = useState('');
  const [actionableSteps, setActionableSteps] = useState('');
  const [isLoadingCounsel, setIsLoadingCounsel] = useState(false);
  const [isLoadingPrayer, setIsLoadingPrayer] = useState(false);
  const [isLoadingActions, setIsLoadingActions] = useState(false);
  const [error, setError] = useState('');

  // Firebase 관련 코드를 모두 제거했습니다.
  // 따라서 userId, db, auth, isAuthReady 상태와 useEffect는 필요 없습니다.

  const callGeminiAPI = async (prompt) => {
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    };

    const apiKey = ""; // Canvas 환경에서 자동 제공됩니다.
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
      throw new Error("AI로부터 응답을 받을 수 없습니다.");
    }
  };

  const handleGetCounsel = async () => {
    if (!problemInput.trim()) {
      setError("상담을 받으려면 문제나 질문을 입력해주세요.");
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

      // Firebase 저장 코드를 제거했습니다.

    } catch (apiError) {
      console.error("Error fetching biblical counsel:", apiError);
      setError("상담을 받는데 실패했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.");
    } finally {
      setIsLoadingCounsel(false);
    }
  };

  const handleGeneratePrayerPrompt = async () => {
    if (!problemInput.trim()) {
      setError("기도 프롬프트를 생성하려면 먼저 문제나 질문을 입력해주세요.");
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
      setError("기도 프롬프트 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoadingPrayer(false);
    }
  };

  const handleSuggestActionableSteps = async () => {
    if (!counselResponse.trim()) {
      setError("실천 단계를 제안하려면 먼저 성경 상담을 받아주세요.");
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
      setError("실천 단계 제안에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsLoadingActions(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-indigo-200 flex flex-col items-center p-4 font-inter text-gray-800">
      <div className="w-full max-w-3xl bg-white shadow-xl rounded-xl p-8 space-y-8 my-8">
        <h1 className="text-4xl font-extrabold text-center text-blue-700 mb-6">
          성경 상담 앱 (간단 버전)
        </h1>

        {/* 사용자 ID 표시는 Firebase를 사용하지 않으므로 제거합니다. */}

        <div className="space-y-4">
          <label htmlFor="problemInput" className="block text-lg font-semibold text-gray-700">
            당신의 마음이나 생각에 무엇이 있나요?
          </label>
          <textarea
            id="problemInput"
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 ease-in-out shadow-sm resize-y min-h-[100px]"
            rows="5"
            placeholder="당신의 상황, 질문 또는 어려움을 여기에 설명해주세요..."
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
              '성경적 상담 받기 ✨'
            )}
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
            <strong className="font-bold">오류!</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        {counselResponse && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 shadow-md">
            <h2 className="text-2xl font-bold text-blue-800 mb-4">하나님의 말씀에서 온 상담:</h2>
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
                  '기도 프롬프트 생성 ✨'
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
                  '실천 단계 제안 ✨'
                )}
              </button>
            </div>
          </div>
        )}

        {prayerPrompt && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 shadow-md mt-4">
            <h2 className="text-2xl font-bold text-green-800 mb-4">기도 프롬프트:</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{prayerPrompt}</p>
          </div>
        )}

        {actionableSteps && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 shadow-md mt-4">
            <h2 className="text-2xl font-bold text-purple-800 mb-4">실천 단계 및 성찰:</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{actionableSteps}</p>
          </div>
        )}

        {/* 과거 세션 표시는 Firebase를 사용하지 않으므로 제거합니다. */}
      </div>
    </div>
  );
}

export default App;
