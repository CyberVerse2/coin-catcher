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

  return (
    <div className="w-full max-w-md mx-auto mt-8 p-4 bg-gray-50 rounded-lg shadow">
      <h2 className="text-2xl font-bold text-center mb-6 text-gray-700">Leaderboard</h2>
      <ul className="space-y-3">
        {highScores.map((entry, index) => (
          <li 
            key={`${entry.userName}-${entry.score}-${index}`} // A more robust key using available data + index
            className="flex justify-between items-center p-3 bg-white rounded shadow-sm hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center">
              <span className="text-lg font-semibold text-gray-600 mr-3 w-8 text-center">{index + 1}.</span>
              <span className="text-lg text-gray-800 truncate" title={entry.userName}>{entry.userName}</span>
            </div>
            <div className="flex flex-col items-end min-w-[120px]">
                <span className="text-xl font-bold text-blue-600 mb-0.5">{entry.score} pts</span>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' })} - {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Leaderboard; 