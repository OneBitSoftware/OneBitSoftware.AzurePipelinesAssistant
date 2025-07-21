# Azure Pipelines Assistant - Technical Specification

## 1. Overview

### 1.1 Purpose
The Azure Pipelines Assistant is a Visual Studio Code extension that provides comprehensive visualization and monitoring of Azure DevOps pipelines directly within the editor. This extension focuses on viewing and analyzing pipeline execution data, similar to the Azure DevOps web interface, without providing pipeline editing capabilities.

### 1.2 Scope
- **Primary Function**: Visualization and monitoring of Azure DevOps pipelines
- **Target Environments**: VS Code, Cursor IDE, Windsurf IDE
- **Distribution**: Open VSX Registry compatible
- **Azure DevOps Support**: Azure DevOps Services (cloud-based)

### 1.3 Key Differentiators from Existing Extension
- **Modern Architecture**: Built with current VS Code extension APIs and best practices
- **Cross-IDE Compatibility**: Works in VS Code, Cursor, and Windsurf
- **Enhanced Visualization**: Rich tree views with pipeline hierarchy representation
- **Performance Optimized**: Efficient API usage with caching and pagination
- **Better UX**: Intuitive navigation and responsive interface

## 2. Technical Requirements

### 2.1 Platform Requirements
- **VS Code API**: Minimum version 1.94.0
- **Node.js**: Version 18.x or higher
- **TypeScript**: Version 5.x
- **Package Manager**: npm or yarn
- **Build Tool**: webpack or esbuild for bundling

### 2.2 Extension Architecture
```
src/
├── extension.ts              # Main extension entry point
├── providers/
│   ├── pipelineProvider.ts   # Pipeline data provider
│   ├── runProvider.ts        # Run/build data provider
│   └── stageProvider.ts      # Stage/job data provider
├── services/
│   ├── azureDevOpsService.ts # Azure DevOps API client
│   ├── authService.ts        # Authentication management
│   └── cacheService.ts       # Data caching service
├── models/
│   ├── pipeline.ts           # Pipeline data models
│   ├── run.ts               # Run/build data models
│   └── stage.ts             # Stage/job data models
├── views/
│   ├── pipelineTreeView.ts   # Pipeline tree view
│   ├── runDetailView.ts      # Run details webview
│   └── logView.ts           # Log viewer webview
├── utils/
│   ├── constants.ts          # Application constants
│   ├── formatting.ts         # Data formatting utilities
│   └── icons.ts             # Icon definitions
└── test/
    ├── unit/                 # Unit tests
    └── integration/          # Integration tests
```

### 2.3 Dependencies
The extension will use modern versions of standard VS Code extension dependencies. Specific versions will be determined during development to ensure compatibility with the latest VS Code API and security best practices.

## 3. Core Features

### 3.1 Pipeline Management
- **List Pipelines**: Display all pipelines organized by project
- **Pipeline Details**: Show pipeline configuration, recent runs, and statistics
- **Pipeline Search**: Search and filter pipelines by name, project, or status
- **Favorites**: Mark frequently used pipelines as favorites

### 3.2 Run Visualization
- **Run History**: Display chronological list of pipeline runs
- **Run Details**: Comprehensive view of individual runs including:
  - Overall status and duration
  - Stage breakdown with timing
  - Job details and artifacts
  - Error information and logs
- **Real-time Updates**: Live status updates for running pipelines
- **Run Comparison**: Compare different runs of the same pipeline

### 3.3 Stage and Job Visualization
- **Hierarchical View**: Tree structure showing stages → jobs → tasks
- **Visual Status Indicators**: Color-coded status (success, failed, running, queued)
- **Timing Information**: Duration for each stage and job
- **Dependency Visualization**: Show stage dependencies and execution order

### 3.4 Log Viewer
- **Integrated Log Display**: View logs within VS Code without external browser
- **Log Filtering**: Filter logs by severity, keyword, or time range
- **Log Search**: Search within logs for specific terms
- **Download Logs**: Export logs for offline analysis

## 4. User Interface Design

### 4.1 Main View Structure
Based on the existing extension UI, the main view will feature:

**Welcome Panel** (when not configured):
- Welcome message: "Welcome to Azure Pipelines Assistant!"
- Configuration instructions with required PAT permissions:
  - Build (Read & Execute)
  - Code (Read) 
  - Release (Read, Write, Execute, & Manage)
- "Configure" button for quick setup
- "Refresh" button to reload data

**Tree View Structure** (when configured):
```
Azure Pipelines Assistant
├── 📁 PIPELINES
│   ├── 📁 Project A
│   │   ├── 🔧 Pipeline 1
│   │   └── 🔧 Pipeline 2
│   └── 📁 Project B
│       └── 🔧 Pipeline 3
├── 📁 BUILDS
│   ├── ✅ Run #123 (2024-01-15)
│   └── ❌ Run #122 (2024-01-14)
├── 📁 STAGES
│   ├── 📊 Build Stage
│   ├── 🔨 Build Job
│   └── 🧪 Test Job
└── 🚀 Deploy Stage
```

**Configuration Integration**:
- Settings accessible through VS Code settings UI
- Fields for "Organization" and "Pat" (Personal Access Token)
- Real-time validation with error messages:
  - "Organization and PAT are required."
  - "Error listing projects. Please check if your PAT has the correct permissions."

### 4.2 Context Menus
- **Pipeline Context Menu**:
  - View in Browser
  - Refresh
  - Add to Favorites
  - View Recent Runs
  
- **Run Context Menu**:
  - View Details
  - View in Browser
  - View Logs
  - Download Artifacts

### 4.3 Status Bar Integration
- Current pipeline run status
- Quick access to refresh all data
- Connection status indicator

### 4.4 Webview Panels
- **Run Details Panel**: Comprehensive run information
- **Log Viewer Panel**: Integrated log display
- **Pipeline Analytics Panel**: Statistics and trends

## 5. Azure DevOps Integration

### 5.1 Authentication
- **Personal Access Token (PAT)**: Primary authentication method
- **Required Permissions**:
  - Build (Read)
  - Code (Read)
  - Project and Team (Read)
  - Release (Read)

### 5.2 API Endpoints
```typescript
// Core API endpoints to be used
const API_ENDPOINTS = {
  PROJECTS: '/{organization}/_apis/projects',
  PIPELINES: '/{organization}/{project}/_apis/pipelines',
  RUNS: '/{organization}/{project}/_apis/pipelines/{pipelineId}/runs',
  RUN_DETAILS: '/{organization}/{project}/_apis/pipelines/{pipelineId}/runs/{runId}',
  STAGES: '/{organization}/{project}/_apis/build/builds/{buildId}/stages',
  TIMELINE: '/{organization}/{project}/_apis/build/builds/{buildId}/timeline',
  LOGS: '/{organization}/{project}/_apis/build/builds/{buildId}/logs/{logId}'
};
```

### 5.3 Data Models
```typescript
interface Pipeline {
  id: number;
  name: string;
  project: Project;
  folder: string;
  revision: number;
  url: string;
  configuration: {
    type: string;
    path: string;
    repository: Repository;
  };
}

interface PipelineRun {
  id: number;
  name: string;
  state: 'completed' | 'inProgress' | 'cancelling' | 'cancelled';
  result: 'succeeded' | 'failed' | 'canceled' | 'abandoned';
  createdDate: Date;
  finishedDate?: Date;
  pipeline: Pipeline;
  resources: RunResources;
  variables: Record<string, Variable>;
  stages: Stage[];
}

interface Stage {
  id: string;
  name: string;
  state: 'completed' | 'inProgress' | 'pending' | 'skipped';
  result: 'succeeded' | 'failed' | 'canceled' | 'abandoned';
  startTime?: Date;
  finishTime?: Date;
  jobs: Job[];
  dependsOn: string[];
}

interface Job {
  id: string;
  name: string;
  state: 'completed' | 'inProgress' | 'pending' | 'skipped';
  result: 'succeeded' | 'failed' | 'canceled' | 'abandoned';
  startTime?: Date;
  finishTime?: Date;
  agentName?: string;
  tasks: Task[];
}

interface Task {
  id: string;
  name: string;
  displayName: string;
  state: 'completed' | 'inProgress' | 'pending' | 'skipped';
  result: 'succeeded' | 'failed' | 'canceled' | 'abandoned';
  startTime?: Date;
  finishTime?: Date;
  logId?: number;
  errorCount: number;
  warningCount: number;
}
```

## 6. Configuration

### 6.1 Extension Settings
```json
{
  "azurePipelinesAssistant.organization": {
    "type": "string",
    "description": "Azure DevOps organization name",
    "scope": "window"
  },
  "azurePipelinesAssistant.pat": {
    "type": "string",
    "description": "Personal Access Token (PAT) for Azure DevOps",
    "scope": "window"
  },
  "azurePipelinesAssistant.refreshInterval": {
    "type": "number",
    "default": 30,
    "description": "Auto-refresh interval in seconds",
    "scope": "window"
  },
  "azurePipelinesAssistant.maxRunsPerPipeline": {
    "type": "number",
    "default": 50,
    "description": "Maximum number of runs to display per pipeline",
    "scope": "window"
  },
  "azurePipelinesAssistant.showTimestamps": {
    "type": "boolean",
    "default": true,
    "description": "Show timestamps in log viewer",
    "scope": "window"
  },
  "azurePipelinesAssistant.favoriteProjects": {
    "type": "array",
    "items": {
      "type": "string"
    },
    "description": "List of favorite project names",
    "scope": "window"
  }
}
```

### 6.2 Commands
```json
{
  "commands": [
    {
      "command": "azurePipelinesAssistant.refreshAll",
      "title": "Refresh All",
      "category": "Azure Pipelines Assistant"
    },
    {
      "command": "azurePipelinesAssistant.viewInBrowser",
      "title": "View in Browser",
      "category": "Azure Pipelines Assistant"
    },
    {
      "command": "azurePipelinesAssistant.viewRunDetails",
      "title": "View Run Details",
      "category": "Azure Pipelines Assistant"
    },
    {
      "command": "azurePipelinesAssistant.viewLogs",
      "title": "View Logs",
      "category": "Azure Pipelines Assistant"
    },
    {
      "command": "azurePipelinesAssistant.configure",
      "title": "Configure",
      "category": "Azure Pipelines Assistant"
    }
  ]
}
```

## 7. Performance Considerations

### 7.1 Caching Strategy
- **In-memory caching**: Cache pipeline and run data for 5 minutes
- **Incremental updates**: Only fetch changed data using API timestamps
- **Lazy loading**: Load detailed information only when requested
- **Background refresh**: Update cache in background without blocking UI

### 7.3 Memory Management
- **Data cleanup**: Regularly clean up old cached data
- **Event listener management**: Properly dispose of event listeners
- **Resource monitoring**: Monitor memory usage and optimize accordingly

## 8. Error Handling

### 8.1 Authentication Errors
- **Invalid PAT**: Clear error message with setup instructions
- **Expired PAT**: Automatic detection and user notification
- **Permission errors**: Specific messages about missing permissions

### 8.2 Network Errors
- **Connection timeouts**: Retry with exponential backoff
- **API failures**: Graceful degradation with cached data
- **Rate limiting**: Appropriate user feedback and retry logic

### 8.3 Data Errors
- **Malformed responses**: Robust parsing with fallback values
- **Missing data**: Handle incomplete API responses gracefully
- **Version compatibility**: Handle API version differences

## 10. Security Considerations

### 10.1 Token Storage
- **Secure storage**: Use VS Code's secure storage for PAT
- **Token validation**: Verify token permissions before use
- **Token rotation**: Support for updating expired tokens

## 11. Deployment and Distribution

### 11.1 Open VSX Compatibility
- **Manifest compatibility**: Ensure package.json meets Open VSX requirements
- **License compliance**: Use appropriate open source license
- **Documentation**: Comprehensive README and documentation

### 11.2 Build Process
```json
{
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "webpack --mode production",
    "watch": "webpack --mode development --watch",
    "test": "npm run compile && node ./out/test/runTest.js",
    "lint": "eslint src --ext ts",
    "package": "vsce package",
    "publish": "ovsx publish"
  }
}
```

### 11.3 CI/CD Pipeline
- **Automated testing**: Run tests on multiple Node.js versions
- **Cross-platform builds**: Build for Windows, macOS, and Linux
- **Automated publishing**: Publish to Open VSX Registry on release
