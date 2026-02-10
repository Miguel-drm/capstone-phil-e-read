import React, { useState, useEffect } from 'react';
import {
  loadReversalConfig,
  saveReversalConfig,
  resetReversalConfig,
  validateReversalPair,
  type ReversalConfig,
} from '../utils/reversalDetection';

const ReversalSettings: React.FC = () => {
  const [config, setConfig] = useState<ReversalConfig>(loadReversalConfig());
  const [newWord1, setNewWord1] = useState('');
  const [newWord2, setNewWord2] = useState('');
  const [pairError, setPairError] = useState('');
  const [excludeWord, setExcludeWord] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    // Load config on mount
    setConfig(loadReversalConfig());
  }, []);

  const handleSave = () => {
    saveReversalConfig(config);
    setSaveMessage('Settings saved successfully!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleReset = () => {
    const defaultConfig = resetReversalConfig();
    setConfig(defaultConfig);
    setSaveMessage('Settings reset to defaults!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleAddPair = () => {
    setPairError('');
    const validation = validateReversalPair(newWord1, newWord2);

    if (!validation.valid) {
      setPairError(validation.error || 'Invalid pair');
      return;
    }

    const w1 = newWord1.trim().toLowerCase();
    const w2 = newWord2.trim().toLowerCase();

    // Check for duplicates
    const isDuplicate = config.customReversalPairs.some(
      (pair) =>
        (pair.word1.toLowerCase() === w1 && pair.word2.toLowerCase() === w2) ||
        (pair.word1.toLowerCase() === w2 && pair.word2.toLowerCase() === w1)
    );

    if (isDuplicate) {
      setPairError('This pair already exists');
      return;
    }

    setConfig({
      ...config,
      customReversalPairs: [...config.customReversalPairs, { word1: w1, word2: w2 }],
    });

    setNewWord1('');
    setNewWord2('');
  };

  const handleRemovePair = (index: number) => {
    setConfig({
      ...config,
      customReversalPairs: config.customReversalPairs.filter((_, i) => i !== index),
    });
  };

  const handleAddExcludeWord = () => {
    const word = excludeWord.trim().toLowerCase();
    if (!word) return;

    if (config.excludeWords.includes(word)) {
      return;
    }

    setConfig({
      ...config,
      excludeWords: [...config.excludeWords, word],
    });

    setExcludeWord('');
  };

  const handleRemoveExcludeWord = (word: string) => {
    setConfig({
      ...config,
      excludeWords: config.excludeWords.filter((w) => w !== word),
    });
  };

  return (
    <div className="space-y-6">
      {/* Save Message */}
      {saveMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium">{saveMessage}</span>
        </div>
      )}

      {/* Enable/Disable Toggle */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">
              Enable Reversal Detection
            </h3>
            <p className="text-sm text-slate-600">
              Automatically detect when students reverse letters or words while reading
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>
      </div>

      {/* Minimum Word Length */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Minimum Word Length</h3>
        <p className="text-sm text-slate-600 mb-4">
          Only detect reversals in words with at least this many letters
        </p>
        <div className="flex items-center gap-4">
          <input
            type="number"
            min="1"
            max="10"
            value={config.minWordLength}
            onChange={(e) =>
              setConfig({ ...config, minWordLength: parseInt(e.target.value) || 1 })
            }
            className="w-24 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <span className="text-sm text-slate-600">letters</span>
        </div>
      </div>

      {/* Custom Reversal Pairs */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">
          Custom Reversal Pairs
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Add specific word pairs that should be detected as reversals (e.g., "was" ↔ "saw")
        </p>

        {/* Add New Pair */}
        <div className="mb-4">
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Word 1"
              value={newWord1}
              onChange={(e) => {
                setNewWord1(e.target.value);
                setPairError('');
              }}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <span className="flex items-center text-slate-400 font-bold">↔</span>
            <input
              type="text"
              placeholder="Word 2"
              value={newWord2}
              onChange={(e) => {
                setNewWord2(e.target.value);
                setPairError('');
              }}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={handleAddPair}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
          {pairError && (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {pairError}
            </p>
          )}
        </div>

        {/* List of Pairs */}
        <div className="space-y-2">
          {config.customReversalPairs.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No custom pairs added yet</p>
          ) : (
            config.customReversalPairs.map((pair, index) => (
              <div
                key={index}
                className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded-lg border border-slate-200"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{pair.word1}</span>
                  <span className="text-slate-400">↔</span>
                  <span className="font-medium text-slate-900">{pair.word2}</span>
                </div>
                <button
                  onClick={() => handleRemovePair(index)}
                  className="text-red-600 hover:text-red-700 p-1"
                  title="Remove pair"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Exclude Words */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Exclude Words</h3>
        <p className="text-sm text-slate-600 mb-4">
          Words that should never be flagged as reversals
        </p>

        {/* Add Exclude Word */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Enter word to exclude"
            value={excludeWord}
            onChange={(e) => setExcludeWord(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddExcludeWord()}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            onClick={handleAddExcludeWord}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            Add
          </button>
        </div>

        {/* List of Excluded Words */}
        <div className="flex flex-wrap gap-2">
          {config.excludeWords.length === 0 ? (
            <p className="text-sm text-slate-500 italic">No excluded words</p>
          ) : (
            config.excludeWords.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200"
              >
                <span className="text-sm font-medium text-slate-900">{word}</span>
                <button
                  onClick={() => handleRemoveExcludeWord(word)}
                  className="text-slate-500 hover:text-red-600"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={handleReset}
          className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors"
        >
          Reset to Defaults
        </button>
        <button
          onClick={handleSave}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition-colors"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
};

export default ReversalSettings;
