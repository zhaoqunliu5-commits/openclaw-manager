import { useState, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from './api';
import type { OperationLog } from './types';
import DashboardHeader from './components/DashboardHeader';
import ServiceCard from './components/ServiceCard';
import ConfigPanel from './components/ConfigPanel';
import LogViewer from './components/LogViewer';
import DetailPanel from './components/DetailPanel';
import SkillRecommendationBar from './components/SkillRecommendationBar';
import CommandPalette from './components/CommandPalette';
import ErrorBoundary from './components/ErrorBoundary';
import { useHotkeys } from './hooks/useHotkeys';

const ModelPanel = lazy(() => import('./components/ModelPanel'));
const MonitorPanel = lazy(() => import('./components/MonitorPanel'));
const ConfigManagePanel = lazy(() => import('./components/ConfigManagePanel'));
const SkillEnhancePanel = lazy(() => import('./components/SkillEnhancePanel'));
const MemoryPanel = lazy(() => import('./components/MemoryPanel'));
const CollaborationPanel = lazy(() => import('./components/CollaborationPanel'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const AutomationPanel = lazy(() => import('./components/AutomationPanel'));
const WorkflowPanel = lazy(() => import('./components/WorkflowPanel'));
const WorkspaceManagePanel = lazy(() => import('./components/WorkspaceManagePanel'));
const SkillEvaluationPanel = lazy(() => import('./components/SkillEvaluationPanel'));

const SkeletonCard = ({ delay = 0 }: { delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="relative glass-card rounded-2xl p-6 overflow-hidden"
  >
    <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
    <div className="h-6 bg-gray-700/50 rounded-xl w-32 mb-6 animate-pulse"></div>
    <div className="h-12 bg-gray-700/50 rounded-xl animate-pulse"></div>
  </motion.div>
);

function App() {
  const queryClient = useQueryClient();
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useHotkeys(activePanel, setActivePanel, setCommandPaletteOpen);

  const handlePanelToggle = (panel: string) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['overview'],
    queryFn: apiService.getOverview,
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ['services'],
    queryFn: apiService.getServices,
    staleTime: 10000,
    refetchInterval: 30000,
  });

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['config'],
    queryFn: apiService.getConfig,
    staleTime: 30000,
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['logs'],
    queryFn: apiService.getLogs,
    staleTime: 10000,
    refetchInterval: 30000,
  });

  const { data: modelProviders = [] } = useQuery({
    queryKey: ['modelProviders'],
    queryFn: apiService.getModelProviders,
  });

  const modelCount = modelProviders.reduce((sum, p) => sum + (p.models?.length || 0), 0);

  const startMutation = useMutation({
    mutationFn: (name: string) => apiService.startService(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    }
  });

  const stopMutation = useMutation({
    mutationFn: (name: string) => apiService.stopService(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    }
  });

  const restartMutation = useMutation({
    mutationFn: (name: string) => apiService.restartService(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    }
  });

  const handleStart = (name: string) => { startMutation.mutate(name); };
  const handleStop = (name: string) => { stopMutation.mutate(name); };
  const handleRestart = (name: string) => { restartMutation.mutate(name); };

  const getServiceLoadingState = (serviceName: string) => {
    return (
      (startMutation.isPending && startMutation.variables === serviceName) ||
      (stopMutation.isPending && stopMutation.variables === serviceName) ||
      (restartMutation.isPending && restartMutation.variables === serviceName)
    );
  };

  const defaultOverview = { agentCount: 0, skillCount: 0, workspaceCount: 0, runningServiceCount: 0 };
  const defaultServices = [
    { name: 'openclaw-gateway', isRunning: false },
    { name: 'canvas', isRunning: false },
  ];
  const defaultConfig = { gatewayPort: 0, gatewayMode: '', authMode: '', enabledPlugins: [], enabledChannels: [] };
  const defaultLogs: OperationLog[] = [];

  return (
    <ErrorBoundary>
    <div className="min-h-screen p-6 md:p-8 relative z-10">
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
      <div className="max-w-7xl mx-auto">
        {overviewLoading ? (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative mb-8"
          >
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/20 via-cyan-600/20 to-purple-600/20 rounded-3xl blur-2xl"></div>
            <div className="relative glass-card rounded-3xl p-8 overflow-hidden animate-pulse">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gray-600 to-transparent"></div>
              <div className="h-10 bg-gray-700/50 rounded-xl w-80 mb-4"></div>
              <div className="h-6 bg-gray-700/50 rounded-xl w-60"></div>
            </div>
          </motion.div>
        ) : (
          <DashboardHeader data={overviewData || defaultOverview} activePanel={activePanel} onPanelToggle={handlePanelToggle} modelCount={modelCount} />
        )}

        {activePanel && activePanel !== 'services' && activePanel !== 'models' && activePanel !== 'monitor' && activePanel !== 'config-manage' && activePanel !== 'skill-enhance' && activePanel !== 'memory' && activePanel !== 'collaboration' && activePanel !== 'settings' && activePanel !== 'automation' && activePanel !== 'workflow' && activePanel !== 'workspace-manage' && activePanel !== 'skill-evaluation' && (
          <div className="mb-8">
            <DetailPanel
              panelType={activePanel as 'agents' | 'skills' | 'workspaces'}
              onClose={() => setActivePanel(null)}
            />
          </div>
        )}

        {activePanel === 'models' && (
          <div className="mb-8">
            <Suspense fallback={<SkeletonCard delay={0} />}>
              <ModelPanel />
            </Suspense>
          </div>
        )}

        {activePanel === 'monitor' && (
          <div className="mb-8">
            <Suspense fallback={<SkeletonCard delay={0} />}>
              <MonitorPanel />
            </Suspense>
          </div>
        )}

        {activePanel === 'config-manage' && (
          <div className="mb-8">
            <Suspense fallback={<SkeletonCard delay={0} />}>
              <ConfigManagePanel />
            </Suspense>
          </div>
        )}

        {activePanel === 'skill-enhance' && (
          <div className="mb-8">
            <Suspense fallback={<SkeletonCard delay={0} />}>
              <SkillEnhancePanel />
            </Suspense>
          </div>
        )}

        {activePanel === 'memory' && (
          <div className="mb-8">
            <Suspense fallback={<SkeletonCard delay={0} />}>
              <MemoryPanel />
            </Suspense>
          </div>
        )}

        {activePanel === 'collaboration' && (
          <div className="mb-8">
            <Suspense fallback={<SkeletonCard delay={0} />}>
              <CollaborationPanel />
            </Suspense>
          </div>
        )}

        {activePanel === 'settings' && (
          <div className="mb-8">
            <Suspense fallback={<SkeletonCard delay={0} />}>
              <SettingsPanel />
            </Suspense>
          </div>
        )}

        {activePanel === 'automation' && (
          <div className="mb-8">
            <Suspense fallback={<SkeletonCard delay={0} />}>
              <AutomationPanel />
            </Suspense>
          </div>
        )}

        {activePanel === 'workflow' && (
          <div className="mb-8">
            <Suspense fallback={<SkeletonCard delay={0} />}>
              <WorkflowPanel />
            </Suspense>
          </div>
        )}

        {activePanel === 'workspace-manage' && (
          <div className="mb-8">
            <Suspense fallback={<SkeletonCard delay={0} />}>
              <WorkspaceManagePanel />
            </Suspense>
          </div>
        )}

        {activePanel === 'skill-evaluation' && (
          <div className="mb-8">
            <Suspense fallback={<SkeletonCard delay={0} />}>
              <SkillEvaluationPanel />
            </Suspense>
          </div>
        )}

        <div className="mb-8">
          <SkillRecommendationBar />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {servicesLoading ? (
            <>
              <SkeletonCard delay={0.1} />
              <SkeletonCard delay={0.2} />
            </>
          ) : (
            (services || defaultServices).map((service, index) => (
              <ServiceCard
                key={service.name}
                service={service}
                onStart={() => handleStart(service.name)}
                onStop={() => handleStop(service.name)}
                onRestart={() => handleRestart(service.name)}
                isLoading={getServiceLoadingState(service.name)}
                index={index}
              />
            ))
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {configLoading ? (
            <SkeletonCard delay={0.3} />
          ) : (
            <ConfigPanel config={config || defaultConfig} />
          )}

          {logsLoading ? (
            <SkeletonCard delay={0.4} />
          ) : (
            <LogViewer logs={logs || defaultLogs} />
          )}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-center text-gray-500 text-sm"
        >
          <p>OpenClaw 效率管理平台 · 赛博科技版 © 2026</p>
        </motion.div>
      </div>
    </div>
    </ErrorBoundary>
  );
}

export default App;
