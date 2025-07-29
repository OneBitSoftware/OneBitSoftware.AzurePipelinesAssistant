# Azure Pipelines Assistant

A comprehensive Visual Studio Code extension for managing Azure DevOps pipelines directly from your editor. Compatible with VS Code, Cursor, and Windsurf IDEs.

## 🚀 Features

### Core Pipeline Management
- **Pipeline Explorer**: View all your Azure DevOps pipelines in a hierarchical tree structure organized by project
- **Pipeline Triggering**: Run pipelines directly from VS Code with custom parameters (branch, variables, etc.)
- **Real-time Monitoring**: Get live status updates for running pipelines with automatic refresh
- **Run History**: View comprehensive pipeline run history with detailed status information

### Advanced Pipeline Insights
- **Detailed Run Information**: View comprehensive pipeline run details with stage/job/task hierarchy
- **Interactive Run Details**: Expandable stages and jobs with timing information and status indicators
- **Run Comparison**: Compare different runs of the same pipeline to identify performance trends
- **Pipeline Analytics**: View pipeline statistics and success rates

### Integrated Development Experience
- **Log Viewer**: View pipeline logs within your IDE with syntax highlighting and search capabilities
- **Log Filtering**: Filter logs by severity, keyword, or time range for efficient troubleshooting
- **Artifact Management**: Download pipeline artifacts directly from the extension
- **Error Diagnostics**: Quick access to error details and failure analysis

### Authentication & Security
- **Secure Authentication**: Uses Personal Access Tokens stored securely in VS Code's secret storage
- **Permission Validation**: Automatically validates required permissions and provides clear error messages
- **Token Management**: Easy token rotation and credential management

### Cross-Platform & IDE Support
- **Cross-IDE Compatibility**: Works seamlessly with VS Code, Cursor, and Windsurf IDEs
- **Cross-Platform Support**: Full support for Windows, macOS, and Linux
- **Performance Optimized**: Efficient caching and background updates for optimal performance

## 📋 Requirements

- **IDE**: VS Code 1.74.0 or higher (or compatible IDE like Cursor/Windsurf)
- **Azure DevOps**: Access to an Azure DevOps organization
- **Personal Access Token** with the following permissions:
  - **Build** (Read & Execute) - Required for viewing and triggering pipelines
  - **Code** (Read) - Required for accessing repository information
  - **Project and Team** (Read) - Required for project access
  - **Release** (Read) - Required for release pipeline access

## ⚙️ Configuration

The extension provides comprehensive configuration options:

### Core Settings
- `azurePipelinesAssistant.organization`: Your Azure DevOps organization name
- `azurePipelinesAssistant.refreshInterval`: Auto-refresh interval in seconds (default: 30)
- `azurePipelinesAssistant.maxRunsPerPipeline`: Maximum runs to display per pipeline (default: 10)
- `azurePipelinesAssistant.autoRefresh`: Enable automatic background refresh (default: true)

### Display & UI Settings
- `azurePipelinesAssistant.showTimestamps`: Show timestamps in logs and run details (default: true)
- `azurePipelinesAssistant.compactView`: Use compact view in pipeline tree (default: false)
- `azurePipelinesAssistant.showWelcomeOnStartup`: Show welcome message on startup (default: true)

### Performance Settings
- `azurePipelinesAssistant.cacheTimeout`: Cache timeout in seconds (default: 300)
- `azurePipelinesAssistant.logLevel`: Logging level for diagnostics (default: info)

### Favorites & Personalization
- `azurePipelinesAssistant.favoriteProjects`: List of favorite project IDs
- `azurePipelinesAssistant.favoritePipelines`: List of favorite pipelines for quick access

## 📦 Installation

### VS Code Marketplace
1. Open VS Code
2. Go to Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for "Azure Pipelines Assistant"
4. Click **Install**

### Open VSX Registry (Cursor/Windsurf)
1. Open your IDE
2. Go to Extensions view
3. Search for "Azure Pipelines Assistant" in Open VSX Registry
4. Click **Install**

### Manual Installation
1. Download the `.vsix` file from [releases](https://github.com/azure-pipelines-assistant/azure-pipelines-assistant/releases)
2. Open your IDE
3. Go to Extensions view → "..." menu → "Install from VSIX..."
4. Select the downloaded file

## 🚀 Getting Started

### Initial Setup
1. **Install the extension** using one of the methods above
2. **Open Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. **Run "Azure Pipelines: Configure"**
4. **Enter your Azure DevOps organization name** (e.g., 'myorg' for https://dev.azure.com/myorg)
5. **Provide your Personal Access Token**
6. **Start managing your pipelines!**

### Creating a Personal Access Token
1. Go to your Azure DevOps organization
2. Click on your profile picture → **Personal access tokens**
3. Click **New Token**
4. Set the required permissions:
   - Build (Read & Execute)
   - Code (Read)
   - Project and Team (Read)
   - Release (Read)
5. Copy the token and paste it into the extension configuration

### First Use
After configuration, the Azure Pipelines view will appear in the Explorer panel showing:
- Your projects organized in a tree structure
- Pipelines within each project
- Recent runs for each pipeline
- Real-time status updates

## 🎯 Usage

### Pipeline Management
- **View Pipelines**: Browse all pipelines in the Azure Pipelines Explorer
- **Run Pipeline**: Right-click on a pipeline → "Run Pipeline"
- **View Recent Runs**: Expand a pipeline to see recent runs
- **Monitor Progress**: Watch real-time updates as pipelines execute

### Run Analysis
- **View Run Details**: Click on a run to see detailed stage/job/task breakdown
- **View Logs**: Right-click on a run → "View Logs" for integrated log viewing
- **Compare Runs**: Select multiple runs to compare performance and results
- **Download Artifacts**: Access and download pipeline artifacts

### Advanced Features
- **Favorites**: Mark frequently used pipelines and projects as favorites
- **Search & Filter**: Use the command palette to quickly find pipelines
- **Health Checks**: Run diagnostic commands to troubleshoot issues
- **Memory Diagnostics**: Monitor extension performance and memory usage

## 🔧 IDE Compatibility

### Supported IDEs
- **Visual Studio Code** 1.74.0+ ✅ Full support
- **Cursor** ✅ Full support (VS Code API compatible)
- **Windsurf** ✅ Full support (VS Code API compatible)

### Platform Support
- **Windows** ✅ Fully tested and supported
- **macOS** ✅ Fully tested and supported  
- **Linux** ✅ Fully tested and supported

For detailed compatibility information and troubleshooting, see [IDE-COMPATIBILITY.md](IDE-COMPATIBILITY.md).

## 🐛 Troubleshooting

### Common Issues

#### Authentication Problems
- **Invalid Token**: Ensure your PAT has the required permissions
- **Expired Token**: Tokens expire - create a new one if needed
- **Organization Name**: Use the organization name, not the full URL

#### Performance Issues
- **Large Logs**: Large pipeline logs may take time to load
- **Network Connectivity**: Real-time updates depend on stable internet connection
- **Cache Issues**: Use "Azure Pipelines: Clear Cache" command if data seems stale

#### IDE-Specific Issues
- **Extension Not Loading**: Ensure your IDE supports VS Code extensions
- **Missing Features**: Some advanced features may have limited support in non-VS Code IDEs

### Diagnostic Commands
Access these through the Command Palette (`Ctrl+Shift+P`):
- `Azure Pipelines: Run Health Check` - Comprehensive system check
- `Azure Pipelines: Show Extension Diagnostics` - View extension status
- `Azure Pipelines: Show Memory Diagnostics` - Monitor memory usage
- `Azure Pipelines: Clear Cache` - Clear all cached data
- `Azure Pipelines: Export Diagnostics` - Export diagnostic information

## 📊 Performance & Optimization

The extension is designed for optimal performance:
- **Intelligent Caching**: 5-minute cache with smart invalidation
- **Background Updates**: Non-blocking background refresh
- **Memory Management**: Automatic cleanup and resource management
- **Rate Limiting**: Respects Azure DevOps API limits with exponential backoff

## 🔒 Security & Privacy

- **Secure Token Storage**: PATs are stored using VS Code's secure storage API
- **No Data Collection**: The extension doesn't collect or transmit personal data
- **Local Processing**: All data processing happens locally
- **Minimal Permissions**: Only requests necessary Azure DevOps permissions

## 📈 Release Notes

### Version 0.0.1 - Initial Release

**🎉 Initial release of Azure Pipelines Assistant with comprehensive cross-IDE compatibility**

#### Core Features
- ✅ Complete pipeline management and monitoring
- ✅ Real-time status updates with background polling
- ✅ Integrated log viewer with syntax highlighting
- ✅ Pipeline run comparison and analytics
- ✅ Secure authentication with PAT storage

#### Cross-Platform Support
- ✅ Windows, macOS, and Linux compatibility
- ✅ VS Code, Cursor, and Windsurf IDE support
- ✅ Open VSX Registry distribution

#### Performance & Reliability
- ✅ Intelligent caching with 5-minute TTL
- ✅ Memory optimization and resource management
- ✅ Comprehensive error handling and recovery
- ✅ Extensive diagnostic and health check capabilities

#### Developer Experience
- ✅ Comprehensive configuration options
- ✅ Intuitive tree-based pipeline explorer
- ✅ Context menus and command palette integration
- ✅ Status bar integration and notifications

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:
- Setting up the development environment
- Running tests and building the extension
- Submitting pull requests
- Reporting issues and feature requests

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **GitHub Repository**: [azure-pipelines-assistant/azure-pipelines-assistant](https://github.com/azure-pipelines-assistant/azure-pipelines-assistant)
- **VS Code Marketplace**: [Azure Pipelines Assistant](https://marketplace.visualstudio.com/items?itemName=azure-pipelines-assistant.azure-pipelines-assistant)
- **Open VSX Registry**: [Azure Pipelines Assistant](https://open-vsx.org/extension/azure-pipelines-assistant/azure-pipelines-assistant)
- **Documentation**: [Full Documentation](https://github.com/azure-pipelines-assistant/azure-pipelines-assistant/wiki)
- **Issue Tracker**: [Report Issues](https://github.com/azure-pipelines-assistant/azure-pipelines-assistant/issues)

---

**Made with ❤️ for the Azure DevOps community**
