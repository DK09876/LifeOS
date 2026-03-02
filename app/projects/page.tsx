'use client';

import { useState, useMemo } from 'react';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import ProjectForm, { ProjectFormData } from '@/components/ProjectForm';
import TaskForm, { TaskFormData } from '@/components/TaskForm';
import { useToast } from '@/components/Toast';
import { useTasks, useDomains, useProjects, createProject, updateProjectData, deleteProject, createTask, updateTaskData } from '@/lib/hooks';
import { Project, Task } from '@/types';
import { getTaskPriorityColor, getStatusColor } from '@/lib/colors';

type StatusFilter = 'all' | 'Active' | 'Completed' | 'Archived';

export default function ProjectsPage() {
  const tasks = useTasks();
  const domains = useDomains();
  const projects = useProjects();
  const { showToast } = useToast();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [domainFilter, setDomainFilter] = useState<string>('all');
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Project modal state
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  // Task modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const filteredProjects = useMemo(() => {
    let result = projects;
    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }
    if (domainFilter !== 'all') {
      result = result.filter(p => p.domainId === domainFilter);
    }
    return result;
  }, [projects, statusFilter, domainFilter]);

  async function handleProjectSubmit(data: ProjectFormData) {
    try {
      if (editingProject) {
        await updateProjectData(editingProject.id, data);
      } else {
        await createProject(data);
      }
      setIsProjectModalOpen(false);
      setEditingProject(null);
    } catch { showToast('Failed to save project', 'error'); }
  }

  async function handleConfirmDeleteProject() {
    if (!projectToDelete) return;
    try {
      await deleteProject(projectToDelete);
      setProjectToDelete(null);
      if (expandedProjectId === projectToDelete) setExpandedProjectId(null);
    } catch { showToast('Failed to delete project', 'error'); }
  }

  async function handleTaskSubmit(data: TaskFormData) {
    try {
      if (editingTask) {
        await updateTaskData(editingTask.id, data);
      } else {
        // Pre-fill projectId if creating from an expanded project
        const taskData = expandedProjectId && !data.projectId
          ? { ...data, projectId: expandedProjectId }
          : data;
        await createTask(taskData);
      }
      setIsTaskModalOpen(false);
      setEditingTask(null);
    } catch { showToast('Failed to save task', 'error'); }
  }

  function handleEditProject(project: Project) {
    setEditingProject(project);
    setIsProjectModalOpen(true);
  }

  function handleEditTask(task: Task) {
    setEditingTask(task);
    setIsTaskModalOpen(true);
  }

  const statusColors: Record<string, string> = {
    Active: 'bg-green-500/20 text-green-300',
    Completed: 'bg-blue-500/20 text-blue-300',
    Archived: 'bg-gray-500/20 text-gray-400',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-[var(--muted)]">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setEditingProject(null); setIsProjectModalOpen(true); }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          + New Project
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-sm text-white"
        >
          <option value="all">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Archived">Archived</option>
        </select>
        <select
          value={domainFilter}
          onChange={e => setDomainFilter(e.target.value)}
          className="px-3 py-2 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-lg text-sm text-white"
        >
          <option value="all">All Domains</option>
          {domains.map(d => (
            <option key={d.id} value={d.id}>{d.icon || '📁'} {d.name}</option>
          ))}
        </select>
      </div>

      {/* Project Cards */}
      {filteredProjects.length === 0 ? (
        <div className="bg-[var(--card-bg)] rounded-lg p-12 text-center text-[var(--muted)]">
          {projects.length === 0 ? 'No projects yet. Create your first project to get started.' : 'No projects match the current filters.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map(project => {
            const isExpanded = expandedProjectId === project.id;
            const projectTasks = project.tasks || [];

            return (
              <div key={project.id} className="bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] overflow-hidden">
                {/* Project Card Header */}
                <div
                  className="p-4 hover:bg-[var(--card-hover)] cursor-pointer transition-colors"
                  onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{project.icon || '📦'}</span>
                      <div>
                        <h3 className="text-white font-medium">{project.name}</h3>
                        {project.domain && (
                          <span className="text-xs text-[var(--muted)]">
                            {project.domain.icon} {project.domain.name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${statusColors[project.status]}`}>
                        {project.status}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {project.completedTaskCount}/{project.taskCount} tasks
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditProject(project); }}
                        className="px-2 py-1 text-xs text-[var(--muted)] hover:text-white transition-colors"
                        aria-label="Edit project"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setProjectToDelete(project.id); }}
                        className="px-2 py-1 text-xs text-red-400 hover:text-red-300 transition-colors"
                        aria-label="Delete project"
                      >
                        Delete
                      </button>
                      <span className="text-[var(--muted)]">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-[var(--background)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${project.completionPercent || 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-[var(--muted)] w-10 text-right">
                      {project.completionPercent || 0}%
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {project.completedAP}/{project.totalAP} AP
                    </span>
                  </div>

                  {project.description && (
                    <p className="text-xs text-[var(--muted)] mt-2 line-clamp-2">{project.description}</p>
                  )}
                </div>

                {/* Expanded: Task List */}
                {isExpanded && (
                  <div className="border-t border-[var(--border-color)]">
                    {projectTasks.length === 0 ? (
                      <div className="p-4 text-sm text-[var(--muted)] text-center">
                        No tasks assigned yet. Edit an existing task and set its project, or create a new one below.
                      </div>
                    ) : (
                      <div className="divide-y divide-[var(--border-color)]">
                        {projectTasks.map(task => (
                          <div
                            key={task.id}
                            className="px-4 py-2 flex items-center justify-between hover:bg-[var(--card-hover)] cursor-pointer transition-colors"
                            onClick={() => handleEditTask(task)}
                          >
                            <div className="flex items-center gap-2">
                              {task.status === 'Done' ? (
                                <span className="text-green-400 text-sm">✓</span>
                              ) : (
                                <span className="text-[var(--muted)] text-sm">○</span>
                              )}
                              <span className={`text-sm ${task.status === 'Done' ? 'text-[var(--muted)] line-through' : 'text-white'}`}>
                                {task.taskName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs ${getStatusColor(task.status)}`}>{task.status}</span>
                              <span className={`px-1.5 py-0.5 rounded text-xs ${getTaskPriorityColor(task.taskPriority)}`}>
                                {task.taskPriority.split(' - ')[1]}
                              </span>
                              {task.actionPoints && (
                                <span className="text-xs text-[var(--muted)]">{task.actionPoints} AP</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="p-3 border-t border-[var(--border-color)]">
                      <button
                        onClick={() => {
                          setEditingTask(null);
                          setIsTaskModalOpen(true);
                        }}
                        className="text-sm text-blue-400 hover:text-blue-300"
                      >
                        + New task
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Project Modal */}
      <Modal
        isOpen={isProjectModalOpen}
        onClose={() => { setIsProjectModalOpen(false); setEditingProject(null); }}
        title={editingProject ? 'Edit Project' : 'Create Project'}
        maxWidth="lg"
      >
        <ProjectForm
          project={editingProject}
          domains={domains}
          onSubmit={handleProjectSubmit}
          onCancel={() => { setIsProjectModalOpen(false); setEditingProject(null); }}
        />
      </Modal>

      {/* Task Modal */}
      <Modal
        isOpen={isTaskModalOpen}
        onClose={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
        title={editingTask ? 'Edit Task' : 'Create Task'}
        maxWidth="lg"
      >
        <TaskForm
          task={editingTask}
          domains={domains}
          allTasks={tasks}
          projects={projects}
          onSubmit={handleTaskSubmit}
          onCancel={() => { setIsTaskModalOpen(false); setEditingTask(null); }}
        />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={projectToDelete !== null}
        onClose={() => setProjectToDelete(null)}
        onConfirm={handleConfirmDeleteProject}
        title="Delete Project"
        message="Are you sure you want to delete this project? Tasks will keep their data but will no longer be grouped."
      />
    </div>
  );
}
