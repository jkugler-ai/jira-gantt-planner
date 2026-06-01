import React from 'react';
import { JiraIssue } from '../types';
import { ExternalLink, X, AlertTriangle, Calendar, User } from 'lucide-react';

interface SidebarProps {
  issue: JiraIssue | null;
  jiraBaseUrl: string;
  onClose: () => void;
}

const STATUS_BADGES: Record<string, string> = {
  'To Do': 'bg-gray-400 text-white',
  'In Progress': 'bg-blue-500 text-white',
  'Closed': 'bg-green-500 text-white',
  'Done': 'bg-green-500 text-white',
  'Needs Review': 'bg-yellow-500 text-white',
};

export const Sidebar: React.FC<SidebarProps> = ({ issue, jiraBaseUrl, onClose }) => {
  if (!issue) return null;
  
  return (
    <div className="w-80 bg-nvidia-surface border-l border-nvidia-border p-4 overflow-y-auto">
      <div className="flex justify-between items-start mb-4">
        <a
          href={`${jiraBaseUrl}/browse/${issue.key}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-nvidia-green font-mono font-bold text-lg hover:underline flex items-center gap-1"
        >
          {issue.key}
          <ExternalLink size={14} />
        </a>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
          <X size={18} />
        </button>
      </div>
      
      <h3 className="text-gray-900 font-semibold mb-3">{issue.summary}</h3>
      
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm w-20">Status:</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGES[issue.status] || 'bg-gray-400 text-white'}`}>
            {issue.status}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm w-20">Type:</span>
          <span className="text-gray-800 text-sm">{issue.issueType}</span>
        </div>
        
        {issue.assignee && (
          <div className="flex items-center gap-2">
            <User size={14} className="text-gray-400" />
            <span className="text-gray-500 text-sm w-16">Assignee:</span>
            <span className="text-gray-800 text-sm">{issue.assignee}</span>
          </div>
        )}
        
        {issue.startDate && (
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-gray-400" />
            <span className="text-gray-500 text-sm w-16">Start:</span>
            <span className="text-gray-800 text-sm">{issue.startDate}</span>
          </div>
        )}
        
        {issue.dueDate && (
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-gray-400" />
            <span className="text-gray-500 text-sm w-16">Due:</span>
            <span className="text-gray-800 text-sm">{issue.dueDate}</span>
          </div>
        )}
        
        {issue.blockedBy.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-1 mb-2">
              <AlertTriangle size={14} className="text-red-500" />
              <span className="text-red-600 text-sm font-medium">Blocked By:</span>
            </div>
            <div className="space-y-1 pl-4">
              {issue.blockedBy.map((key) => (
                <a
                  key={key}
                  href={`${jiraBaseUrl}/browse/${key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-nvidia-green hover:underline"
                >
                  {key}
                </a>
              ))}
            </div>
          </div>
        )}
        
        {issue.blocks.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-1 mb-2">
              <AlertTriangle size={14} className="text-yellow-500" />
              <span className="text-yellow-600 text-sm font-medium">Blocks:</span>
            </div>
            <div className="space-y-1 pl-4">
              {issue.blocks.map((key) => (
                <a
                  key={key}
                  href={`${jiraBaseUrl}/browse/${key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-nvidia-green hover:underline"
                >
                  {key}
                </a>
              ))}
            </div>
          </div>
        )}
        
        {issue.children.length > 0 && (
          <div className="mt-4">
            <span className="text-gray-500 text-sm">Children: {issue.children.length} issues</span>
          </div>
        )}
      </div>
    </div>
  );
};
