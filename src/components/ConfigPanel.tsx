import React, { useState } from 'react';
import { JiraConfig } from '../types';
import { Settings, Loader2 } from 'lucide-react';

interface ConfigPanelProps {
  config: JiraConfig | null;
  onConnect: (config: JiraConfig) => void;
  loading: boolean;
  progress: string;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onConnect, loading, progress }) => {
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl || '');
  const [token, setToken] = useState(config?.token || '');
  const [rootKey, setRootKey] = useState(config?.rootIssueKey || '');
  const [proxyUrl, setProxyUrl] = useState(config?.proxyUrl || 'http://localhost:4201');
  const [showConfig, setShowConfig] = useState(!config);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newConfig: JiraConfig = {
      baseUrl: baseUrl.replace(/\/$/, ''),
      token,
      rootIssueKey: rootKey.toUpperCase(),
      proxyUrl: proxyUrl.replace(/\/$/, ''),
    };
    localStorage.setItem('jira-gantt-config', JSON.stringify(newConfig));
    onConnect(newConfig);
  };
  
  if (!showConfig && config) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-nvidia-surface border-b border-nvidia-border">
        <span className="text-gray-600 text-sm">
          Connected: <span className="text-nvidia-green font-mono font-semibold">{config.rootIssueKey}</span> @ {config.baseUrl}
        </span>
        <button
          onClick={() => setShowConfig(true)}
          className="text-gray-400 hover:text-nvidia-green"
        >
          <Settings size={16} />
        </button>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 size={14} className="animate-spin" />
            <span>{progress}</span>
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className="bg-nvidia-surface border-b border-nvidia-border p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-nvidia-green rounded flex items-center justify-center font-bold text-white">
            N
          </div>
          <h2 className="text-xl font-bold text-gray-900">Jira Project Planner</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Jira Base URL</label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://jira.company.com"
                className="w-full px-3 py-2 bg-white border border-nvidia-border rounded text-gray-900 placeholder-gray-400 focus:border-nvidia-green focus:outline-none focus:ring-1 focus:ring-nvidia-green"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Personal Access Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Your PAT"
                className="w-full px-3 py-2 bg-white border border-nvidia-border rounded text-gray-900 placeholder-gray-400 focus:border-nvidia-green focus:outline-none focus:ring-1 focus:ring-nvidia-green"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Root Issue Key</label>
              <input
                type="text"
                value={rootKey}
                onChange={(e) => setRootKey(e.target.value)}
                placeholder="OMPE-57790"
                className="w-full px-3 py-2 bg-white border border-nvidia-border rounded text-gray-900 placeholder-gray-400 focus:border-nvidia-green focus:outline-none focus:ring-1 focus:ring-nvidia-green font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Proxy URL</label>
              <input
                type="url"
                value={proxyUrl}
                onChange={(e) => setProxyUrl(e.target.value)}
                placeholder="http://localhost:3001"
                className="w-full px-3 py-2 bg-white border border-nvidia-border rounded text-gray-900 placeholder-gray-400 focus:border-nvidia-green focus:outline-none focus:ring-1 focus:ring-nvidia-green"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-nvidia-green text-white font-bold rounded hover:bg-green-600 disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Loading...' : 'Connect & Load'}
            </button>
            {config && (
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="px-4 py-2 border border-nvidia-border text-gray-600 rounded hover:text-gray-900 hover:border-gray-400"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
        
        {loading && progress && (
          <div className="mt-3 text-sm text-gray-500 font-mono">{progress}</div>
        )}
      </div>
    </div>
  );
};
