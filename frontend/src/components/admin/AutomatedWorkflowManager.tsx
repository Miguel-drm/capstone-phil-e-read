import React, { useState, useEffect } from 'react';
import {
  CogIcon,
  PlayIcon,
  PauseIcon,
  PlusIcon,
  TrashIcon,
  BellIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { reportProcessingService } from '../../services/reportProcessingService';

interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  triggerType: 'new_report' | 'overdue_report' | 'quality_threshold' | 'teacher_pattern';
  conditions: {
    qualityScore?: number;
    daysSinceSubmission?: number;
    teacherId?: string;
    reportType?: string;
    studentCount?: number;
  };
  actions: WorkflowAction[];
  isActive: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  triggerCount: number;
  priority: 'low' | 'medium' | 'high';
}

interface WorkflowAction {
  type: 'auto_approve' | 'auto_reject' | 'flag_review' | 'send_notification' | 'assign_reviewer' | 'request_revision';
  parameters: Record<string, any>;
  delay?: number; // in minutes
}

interface AutomatedWorkflowManagerProps {
  adminId: string;
  adminName: string;
}

const AutomatedWorkflowManager: React.FC<AutomatedWorkflowManagerProps> = ({
  adminId
}) => {
  const [workflows, setWorkflows] = useState<WorkflowRule[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // const [editingWorkflow, setEditingWorkflow] = useState<WorkflowRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [newWorkflow, setNewWorkflow] = useState<Partial<WorkflowRule>>({
    name: '',
    description: '',
    triggerType: 'new_report',
    conditions: {},
    actions: [],
    isActive: true,
    priority: 'medium'
  });

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would fetch from Firestore
      // For now, we'll use mock data
      const mockWorkflows: WorkflowRule[] = [
        {
          id: '1',
          name: 'High Quality Auto-Approval',
          description: 'Automatically approve reports with quality score above 90%',
          triggerType: 'quality_threshold',
          conditions: { qualityScore: 90 },
          actions: [
            { type: 'auto_approve', parameters: { reason: 'High quality score' } }
          ],
          isActive: true,
          createdAt: new Date(),
          triggerCount: 45,
          priority: 'high'
        },
        {
          id: '2',
          name: 'Overdue Report Reminder',
          description: 'Send reminder for reports pending review for more than 3 days',
          triggerType: 'overdue_report',
          conditions: { daysSinceSubmission: 3 },
          actions: [
            { type: 'send_notification', parameters: { message: 'Report requires urgent review' } },
            { type: 'flag_review', parameters: { priority: 'high' } }
          ],
          isActive: true,
          createdAt: new Date(),
          lastTriggered: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          triggerCount: 12,
          priority: 'medium'
        },
        {
          id: '3',
          name: 'Low Quality Flag',
          description: 'Flag reports with quality score below 60% for manual review',
          triggerType: 'quality_threshold',
          conditions: { qualityScore: 60 },
          actions: [
            { type: 'flag_review', parameters: { reason: 'Low quality score requires attention' } },
            { type: 'assign_reviewer', parameters: { reviewerId: adminId } }
          ],
          isActive: true,
          createdAt: new Date(),
          triggerCount: 8,
          priority: 'high'
        }
      ];
      setWorkflows(mockWorkflows);
    } catch (error) {
      console.error('Error loading workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkflow = async () => {
    try {
      if (!newWorkflow.name || !newWorkflow.description || !newWorkflow.actions?.length) {
        alert('Please fill in all required fields');
        return;
      }

      const workflowId = await reportProcessingService.setupAutomatedWorkflow(
        newWorkflow.triggerType!,
        newWorkflow.actions!.map(a => a.type),
        newWorkflow.conditions!
      );

      // Add to local state (in real app, this would refetch from server)
      const createdWorkflow: WorkflowRule = {
        id: workflowId,
        name: newWorkflow.name!,
        description: newWorkflow.description!,
        triggerType: newWorkflow.triggerType!,
        conditions: newWorkflow.conditions!,
        actions: newWorkflow.actions!,
        isActive: newWorkflow.isActive!,
        createdAt: new Date(),
        triggerCount: 0,
        priority: newWorkflow.priority!
      };

      setWorkflows(prev => [...prev, createdWorkflow]);
      setShowCreateModal(false);
      setNewWorkflow({
        name: '',
        description: '',
        triggerType: 'new_report',
        conditions: {},
        actions: [],
        isActive: true,
        priority: 'medium'
      });
    } catch (error) {
      console.error('Error creating workflow:', error);
      alert('Failed to create workflow');
    }
  };

  const handleToggleWorkflow = async (workflowId: string, isActive: boolean) => {
    try {
      // In real implementation, update in Firestore
      setWorkflows(prev => prev.map(w => 
        w.id === workflowId ? { ...w, isActive } : w
      ));
    } catch (error) {
      console.error('Error toggling workflow:', error);
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    
    try {
      // In real implementation, delete from Firestore
      setWorkflows(prev => prev.filter(w => w.id !== workflowId));
    } catch (error) {
      console.error('Error deleting workflow:', error);
    }
  };

  const addActionToNewWorkflow = (actionType: WorkflowAction['type']) => {
    const newAction: WorkflowAction = {
      type: actionType,
      parameters: {}
    };

    setNewWorkflow(prev => ({
      ...prev,
      actions: [...(prev.actions || []), newAction]
    }));
  };

  const removeActionFromNewWorkflow = (index: number) => {
    setNewWorkflow(prev => ({
      ...prev,
      actions: prev.actions?.filter((_, i) => i !== index) || []
    }));
  };

  const getTriggerIcon = (triggerType: string) => {
    switch (triggerType) {
      case 'new_report':
        return <DocumentTextIcon className="h-5 w-5" />;
      case 'overdue_report':
        return <ClockIcon className="h-5 w-5" />;
      case 'quality_threshold':
        return <ChartBarIcon className="h-5 w-5" />;
      case 'teacher_pattern':
        return <UserGroupIcon className="h-5 w-5" />;
      default:
        return <CogIcon className="h-5 w-5" />;
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'auto_approve':
        return <CheckCircleIcon className="h-4 w-4 text-emerald-500" />;
      case 'auto_reject':
        return <ExclamationTriangleIcon className="h-4 w-4 text-rose-500" />;
      case 'flag_review':
        return <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />;
      case 'send_notification':
        return <BellIcon className="h-4 w-4 text-blue-500" />;
      case 'assign_reviewer':
        return <UserGroupIcon className="h-4 w-4 text-purple-500" />;
      case 'request_revision':
        return <ArrowPathIcon className="h-4 w-4 text-orange-500" />;
      default:
        return <CogIcon className="h-4 w-4 text-slate-500" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-200 border-t-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading Automated Workflows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Automated Workflows</h1>
              <p className="text-slate-600">Configure automated actions for report processing</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Create Workflow
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Workflow Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Workflows</p>
                <p className="text-3xl font-bold text-slate-900">{workflows.length}</p>
              </div>
              <div className="p-3 bg-indigo-100 rounded-lg">
                <CogIcon className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Active</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {workflows.filter(w => w.isActive).length}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <PlayIcon className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Triggers</p>
                <p className="text-3xl font-bold text-blue-600">
                  {workflows.reduce((sum, w) => sum + w.triggerCount, 0)}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <BellIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">High Priority</p>
                <p className="text-3xl font-bold text-rose-600">
                  {workflows.filter(w => w.priority === 'high').length}
                </p>
              </div>
              <div className="p-3 bg-rose-100 rounded-lg">
                <ExclamationTriangleIcon className="h-6 w-6 text-rose-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Workflows List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Workflow Rules</h3>
            <p className="text-sm text-slate-600">Manage your automated report processing rules</p>
          </div>

          {workflows.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {workflows.map(workflow => (
                <div key={workflow.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${
                          workflow.triggerType === 'new_report' ? 'bg-blue-100' :
                          workflow.triggerType === 'overdue_report' ? 'bg-amber-100' :
                          workflow.triggerType === 'quality_threshold' ? 'bg-purple-100' :
                          'bg-slate-100'
                        }`}>
                          {getTriggerIcon(workflow.triggerType)}
                        </div>
                        <div>
                          <h4 className="text-lg font-semibold text-slate-900">{workflow.name}</h4>
                          <p className="text-sm text-slate-600">{workflow.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            workflow.priority === 'high' ? 'bg-rose-100 text-rose-800' :
                            workflow.priority === 'medium' ? 'bg-amber-100 text-amber-800' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {workflow.priority}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            workflow.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {workflow.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>

                      {/* Conditions */}
                      <div className="mb-3">
                        <h5 className="text-sm font-medium text-slate-700 mb-2">Trigger Conditions:</h5>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(workflow.conditions).map(([key, value]) => (
                            <span key={key} className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">
                              {key}: {String(value)}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mb-3">
                        <h5 className="text-sm font-medium text-slate-700 mb-2">Actions:</h5>
                        <div className="flex flex-wrap gap-2">
                          {workflow.actions.map((action, index) => (
                            <div key={index} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">
                              {getActionIcon(action.type)}
                              <span>{action.type.replace('_', ' ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-6 text-sm text-slate-500">
                        <span>Triggered: {workflow.triggerCount} times</span>
                        {workflow.lastTriggered && (
                          <span>Last: {workflow.lastTriggered.toLocaleDateString()}</span>
                        )}
                        <span>Created: {workflow.createdAt.toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleToggleWorkflow(workflow.id, !workflow.isActive)}
                        className={`p-2 rounded-lg transition-colors ${
                          workflow.isActive
                            ? 'text-amber-600 hover:bg-amber-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={workflow.isActive ? 'Pause Workflow' : 'Activate Workflow'}
                      >
                        {workflow.isActive ? (
                          <PauseIcon className="h-4 w-4" />
                        ) : (
                          <PlayIcon className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => console.log('Edit workflow:', workflow.id)}
                        className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                        title="Edit Workflow"
                      >
                        <CogIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Workflow"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <CogIcon className="h-16 w-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">No Workflows Created</h3>
              <p className="text-slate-600 mb-4">Create your first automated workflow to streamline report processing.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Create First Workflow
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create Workflow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-semibold text-slate-900">Create New Workflow</h3>
              <p className="text-slate-600">Set up automated actions for report processing</p>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Workflow Name *
                  </label>
                  <input
                    type="text"
                    value={newWorkflow.name || ''}
                    onChange={(e) => setNewWorkflow(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., High Quality Auto-Approval"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={newWorkflow.description || ''}
                    onChange={(e) => setNewWorkflow(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Describe what this workflow does..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Trigger Type *
                    </label>
                    <select
                      value={newWorkflow.triggerType || 'new_report'}
                      onChange={(e) => setNewWorkflow(prev => ({ ...prev, triggerType: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="new_report">New Report Submitted</option>
                      <option value="overdue_report">Report Overdue</option>
                      <option value="quality_threshold">Quality Score Threshold</option>
                      <option value="teacher_pattern">Teacher Pattern</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Priority
                    </label>
                    <select
                      value={newWorkflow.priority || 'medium'}
                      onChange={(e) => setNewWorkflow(prev => ({ ...prev, priority: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Conditions */}
              <div>
                <h4 className="text-lg font-semibold text-slate-900 mb-3">Trigger Conditions</h4>
                <div className="space-y-3">
                  {newWorkflow.triggerType === 'quality_threshold' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Quality Score Threshold (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={newWorkflow.conditions?.qualityScore || ''}
                        onChange={(e) => setNewWorkflow(prev => ({
                          ...prev,
                          conditions: { ...prev.conditions, qualityScore: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g., 90"
                      />
                    </div>
                  )}

                  {newWorkflow.triggerType === 'overdue_report' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Days Since Submission
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={newWorkflow.conditions?.daysSinceSubmission || ''}
                        onChange={(e) => setNewWorkflow(prev => ({
                          ...prev,
                          conditions: { ...prev.conditions, daysSinceSubmission: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g., 3"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div>
                <h4 className="text-lg font-semibold text-slate-900 mb-3">Actions *</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => addActionToNewWorkflow('auto_approve')}
                      className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                    >
                      <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                      Auto Approve
                    </button>
                    <button
                      onClick={() => addActionToNewWorkflow('auto_reject')}
                      className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                    >
                      <ExclamationTriangleIcon className="h-4 w-4 text-rose-500" />
                      Auto Reject
                    </button>
                    <button
                      onClick={() => addActionToNewWorkflow('flag_review')}
                      className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                    >
                      <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
                      Flag for Review
                    </button>
                    <button
                      onClick={() => addActionToNewWorkflow('send_notification')}
                      className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                    >
                      <BellIcon className="h-4 w-4 text-blue-500" />
                      Send Notification
                    </button>
                  </div>

                  {/* Selected Actions */}
                  {newWorkflow.actions && newWorkflow.actions.length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-sm font-medium text-slate-700 mb-2">Selected Actions:</h5>
                      <div className="space-y-2">
                        {newWorkflow.actions.map((action, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              {getActionIcon(action.type)}
                              <span className="text-sm font-medium">{action.type.replace('_', ' ')}</span>
                            </div>
                            <button
                              onClick={() => removeActionFromNewWorkflow(index)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewWorkflow({
                    name: '',
                    description: '',
                    triggerType: 'new_report',
                    conditions: {},
                    actions: [],
                    isActive: true,
                    priority: 'medium'
                  });
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkflow}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Create Workflow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomatedWorkflowManager;