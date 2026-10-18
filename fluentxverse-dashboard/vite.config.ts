import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'path';

const pageChunkFiles: Record<string, string[]> = {
  'pages-core': [
    'src/pages/DashboardPage.tsx',
    'src/pages/LoginPage.tsx',
  ],
  'pages-users': [
    'src/pages/TutorsPage.tsx',
    'src/pages/StudentsPage.tsx',
    'src/pages/ApplicationsPage.tsx',
    'src/pages/AdminsPage.tsx',
  ],
  'pages-operations': [
    'src/pages/SessionsPage.tsx',
    'src/pages/TicketsPage.tsx',
    'src/pages/AnalyticsPage.tsx',
    'src/pages/InboxPage.tsx',
    'src/pages/SettingsPage.tsx',
  ],
  'pages-interviews': [
    'src/pages/InterviewSchedulePage.tsx',
    'src/pages/InterviewRoomPage.tsx',
  ],
  'pages-lesson-material': [
    'src/pages/LessonMaterialMakerPage.tsx',
    'src/pages/LessonMaterialViewPage.tsx',
  ],
  'pages-conversational': [
    'src/pages/ConversationalSkillsEditorPage.tsx',
    'src/pages/ConversationalSkillsPreview.tsx',
    'src/pages/ConversationalSkillsVisualEditor.tsx',
  ],
  'pages-daily-dispatch': [
    'src/pages/DailyDispatchEditorPage.tsx',
    'src/pages/DailyDispatchPreviewPage.tsx',
    'src/pages/DailyDispatchArchivePage.tsx',
    'src/pages/DailyDispatchStudentPage.tsx',
  ],
  'pages-young-learners': [
    'src/pages/YoungLearnersEditorPage.tsx',
    'src/pages/YoungLearnersVisualEditor.tsx',
    'src/pages/YoungLearnersPreview.tsx',
  ],
  'pages-discussion': [
    'src/pages/DiscussionQuestionsEditorPage.tsx',
    'src/pages/DiscussionQuestionsVisualEditor.tsx',
  ],
};

const manualChunks = (id: string) => {
  const normalizedId = id.replaceAll('\\', '/');

  if (normalizedId.includes('/node_modules/')) {
    if (normalizedId.includes('/node_modules/preact/') || normalizedId.includes('/node_modules/preact-iso/')) {
      return 'vendor-preact';
    }
    if (normalizedId.includes('/node_modules/axios/')) {
      return 'vendor-network';
    }
  }

  for (const [chunkName, files] of Object.entries(pageChunkFiles)) {
    if (files.some((file) => normalizedId.endsWith(file))) {
      return chunkName;
    }
  }

  return undefined;
};

export default defineConfig({
  plugins: [preact()],
  server: {
    port: 5175,
    strictPort: true,
    host: '0.0.0.0',
    // Increase header size limits to prevent 431 errors
    headers: {
      'Connection': 'keep-alive',
    },
    hmr: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8765',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@context': path.resolve(__dirname, 'src/context'),
      '@api': path.resolve(__dirname, 'src/api'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
