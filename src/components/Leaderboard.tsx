'use client';

import React, { useState, useEffect } from 'react';

interface HighScoreEntry {
  userName: string;
  score: number;
  createdAt: string; // Assuming ISO string date
}

const Leaderboard = () => {
  const [highScores, setHighScores] = useState<HighScoreEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHighScores = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/highscore');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to fetch high scores' }));
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setHighScores(data);
      } catch (err: any) {
        console.error('Error fetching high scores:', err);
        setError(err.message || 'Could not load high scores.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHighScores();
  }, []); // Empty dependency array means this runs once on mount

  if (isLoading) {
    return <div className="text-center p-4">Loading high scores...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-500">Error: {error}</div>;
  }

  if (highScores.length === 0) {
    return <div className="text-center p-4">No high scores yet. Be the first!</div>;
  }

  // return (
  //   <div className="w-full max-w-2xl mx-auto mt-8 p-4 bg-gray-50 rounded-lg shadow">
  //     <h2 className="text-2xl font-bold text-center mb-6 text-gray-700">Leaderboard</h2>
  //     <ul className="space-y-2">
  //       {highScores.map((entry, index) => (
  //         <li
  //           key={`${entry.userName}-${entry.score}-${index}`}
  //           className="flex justify-between items-center p-2 bg-white rounded shadow-sm hover:bg-gray-100 transition-colors"
  //         >
  //           <div className="flex items-center flex-grow pr-2">
  //             <span className="text-lg font-semibold text-gray-600 mr-3 w-8 text-center shrink-0">{index + 1}.</span>
  //             <span className="text-lg text-gray-800 truncate" title={entry.userName}>{entry.userName}</span>
  //           </div>
  //           <div className="flex flex-col items-end min-w-[150px] shrink-0">
  //               <span className="text-xl font-bold text-blue-600 mb-0.5 pr-2">{entry.score} pts</span>
  //               <span className="text-xs text-gray-500 whitespace-nowrap">
  //                   {new Date(entry.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' })} - {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
  //               </span>
  //           </div>
  //         </li>
  //       ))}
  //     </ul>
  //   </div>
  // );

  return (
    <div
      className="
        w-full max-w-2xl mx-auto mt-8 p-6
        bg-gradient-to-br from-blue-400 via-blue-500 to-black
        rounded-lg shadow-[4px_4px_0_rgba(0,0,0,0.5)]
        border-2 border-blue-300
        font-'Press Start 2P' text-blue-200
        pixelated
      "
    >
      <h2 className="text-center mb-6 text-xl uppercase tracking-widest">
        Leaderboard
      </h2>
      <ul className="space-y-1">
        {highScores.map((entry, idx) => (
          <li
            key={`${entry.userName}-${entry.score}-${idx}`}
            className="
              flex justify-between items-center
              p-2 bg-black bg-opacity-30
              border border-blue-300
              rounded-sm
              hover:bg-opacity-50
              transition-all
            "
          >
            <div className="flex items-center flex-grow pr-2">
              <span className="w-6 text-sm text-blue-300 text-center">
                {idx + 1}.
              </span>
              <span
                className="ml-2 truncate"
                title={entry.userName}
              >
                {entry.userName}
              </span>
            </div>
            <div className="flex flex-col items-end min-w-[140px]">
              <span className="text-sm font-bold">
                {entry.score} pts
              </span>
              <span className="text-[10px] text-blue-200 whitespace-nowrap">
                {new Date(entry.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "numeric",
                  day: "numeric",
                })}{" "}
                –{" "}
                {new Date(entry.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Leaderboard; 