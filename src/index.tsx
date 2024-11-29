@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    @apply antialiased;
  }
  body {
    @apply bg-gray-50 text-gray-900;
  }
}

@layer components {
  .form-input {
    @apply mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-primary focus:border-primary;
  }
  
  .btn {
    @apply px-4 py-2 rounded-md font-medium transition-colors duration-200;
  }
  
  .btn-primary {
    @apply bg-primary text-white hover:bg-primary-dark;
  }
  
  .btn-secondary {
    @apply bg-white text-primary border border-primary hover:bg-gray-50;
  }
  
  .input-label {
    @apply block text-sm font-medium text-gray-700;
  }
  
  .error-message {
    @apply mb-4 bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded;
  }
  
  .success-message {
    @apply mb-4 bg-green-50 border border-green-400 text-green-700 px-4 py-3 rounded;
  }
  
  .card {
    @apply bg-white shadow-lg rounded-lg overflow-hidden;
  }
  
  .card-header {
    @apply bg-gradient-to-r from-primary to-primary-dark px-6 py-4;
  }
  
  .status-badge {
    @apply inline-flex items-center px-3 py-1 rounded-full text-sm font-medium;
  }
  
  .status-badge-active {
    @apply status-badge bg-green-100 text-green-800;
  }
  
  .status-badge-inactive {
    @apply status-badge bg-red-100 text-red-800;
  }
  
  .status-badge-pending {
    @apply status-badge bg-yellow-100 text-yellow-800;
  }
  
  .nav-link {
    @apply flex items-center space-x-2 p-3 rounded-lg hover:bg-gray-50;
  }
  
  .nav-link-active {
    @apply bg-[#e6ffe6] text-[#004d00];
  }
  
  .dashboard-card {
    @apply bg-white p-6 rounded-lg shadow-md;
  }
  
  .dashboard-stat {
    @apply text-2xl font-semibold text-gray-900;
  }
  
  .dashboard-label {
    @apply text-sm font-medium text-gray-600;
  }
  
  .dashboard-icon {
    @apply w-6 h-6;
  }
  
  .dashboard-icon-wrapper {
    @apply p-3 rounded-full;
  }
}