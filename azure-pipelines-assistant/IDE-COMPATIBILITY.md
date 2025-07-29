# IDE Compatibility Guide

This document outlines the compatibility of the Azure Pipelines Assistant extension across different IDEs and platforms.

## Supported IDEs

### Visual Studio Code
- **Version**: 1.74.0 or higher
- **Marketplace**: VS Code Marketplace
- **Installation**: Install directly from VS Code Extensions view or download `.vsix` file
- **Features**: Full feature support
- **Testing Status**: ✅ Fully tested

### Cursor
- **Version**: Compatible with VS Code API 1.74.0+
- **Marketplace**: Open VSX Registry
- **Installation**: Install from Open VSX Registry or manually install `.vsix` file
- **Features**: Full feature support (inherits VS Code API compatibility)
- **Testing Status**: ✅ Compatibility validated

### Windsurf
- **Version**: Compatible with VS Code API 1.74.0+
- **Marketplace**: Open VSX Registry
- **Installation**: Install from Open VSX Registry or manually install `.vsix` file
- **Features**: Full feature support (inherits VS Code API compatibility)
- **Testing Status**: ✅ Compatibility validated

## Supported Platforms

### Windows
- **Versions**: Windows 10, Windows 11
- **Architecture**: x64, ARM64
- **Node.js**: 18.x or higher
- **Testing Status**: ✅ Fully tested

### macOS
- **Versions**: macOS 10.15 (Catalina) or higher
- **Architecture**: Intel (x64), Apple Silicon (ARM64)
- **Node.js**: 18.x or higher
- **Testing Status**: ✅ Fully tested

### Linux
- **Distributions**: Ubuntu 18.04+, Debian 10+, CentOS 8+, Fedora 32+
- **Architecture**: x64, ARM64
- **Node.js**: 18.x or higher
- **Testing Status**: ✅ Fully tested

## Installation Instructions

### VS Code
1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X)
3. Search for "Azure Pipelines Assistant"
4. Click Install

### Cursor
1. Open Cursor
2. Go to Extensions view
3. Search for "Azure Pipelines Assistant" in Open VSX Registry
4. Click Install

### Windsurf
1. Open Windsurf
2. Go to Extensions view
3. Search for "Azure Pipelines Assistant" in Open VSX Registry
4. Click Install

### Manual Installation
1. Download the appropriate `.vsix` file from releases
2. Open your IDE
3. Go to Extensions view
4. Click "..." menu → "Install from VSIX..."
5. Select the downloaded `.vsix` file

## Feature Compatibility Matrix

| Feature | VS Code | Cursor | Windsurf | Notes |
|---------|---------|--------|----------|-------|
| Tree View | ✅ | ✅ | ✅ | Full support |
| Pipeline Triggering | ✅ | ✅ | ✅ | Full support |
| Run Details | ✅ | ✅ | ✅ | Webview-based |
| Log Viewer | ✅ | ✅ | ✅ | Webview-based |
| Authentication | ✅ | ✅ | ✅ | SecretStorage API |
| Status Bar | ✅ | ✅ | ✅ | Full support |
| Commands | ✅ | ✅ | ✅ | Command Palette |
| Context Menus | ✅ | ✅ | ✅ | Full support |
| Settings | ✅ | ✅ | ✅ | Configuration API |
| Real-time Updates | ✅ | ✅ | ✅ | Background polling |

## API Compatibility

### VS Code API Requirements
- **Minimum Version**: 1.74.0
- **Required APIs**:
  - `vscode.window.createTreeView`
  - `vscode.window.createWebviewPanel`
  - `vscode.secrets` (SecretStorage)
  - `vscode.commands.registerCommand`
  - `vscode.workspace.getConfiguration`
  - `vscode.window.showInformationMessage`
  - `vscode.StatusBarItem`

### Extension Capabilities
- **Activation Events**: `onView`, `onCommand`, `onStartupFinished`
- **Contributes**: Views, Commands, Menus, Configuration
- **Dependencies**: None (all dependencies bundled)

## Testing and Validation

### Automated Testing
Run the compatibility test suite:
```bash
npm run test:compatibility
```

### Platform Validation
Validate platform-specific functionality:
```bash
npm run validate:cross-platform
```

### Manual Testing Checklist

#### Basic Functionality
- [ ] Extension activates without errors
- [ ] Tree view displays correctly
- [ ] Authentication works with PAT
- [ ] Pipeline data loads successfully
- [ ] Commands execute properly

#### IDE-Specific Testing
- [ ] VS Code: Full feature testing
- [ ] Cursor: Extension loads and functions
- [ ] Windsurf: Extension loads and functions

#### Platform-Specific Testing
- [ ] Windows: All features work
- [ ] macOS: All features work
- [ ] Linux: All features work

## Troubleshooting

### Common Issues

#### Extension Not Loading
1. Check IDE version compatibility (1.74.0+)
2. Verify extension is properly installed
3. Check IDE error logs
4. Try restarting the IDE

#### Authentication Issues
1. Verify PAT has required permissions
2. Check organization name format
3. Clear stored credentials and re-authenticate
4. Verify network connectivity to Azure DevOps

#### Performance Issues
1. Check cache settings
2. Reduce refresh interval
3. Limit number of runs per pipeline
4. Clear extension cache

### Platform-Specific Issues

#### Windows
- Ensure PowerShell execution policy allows scripts
- Check Windows Defender exclusions
- Verify Node.js installation

#### macOS
- Check Gatekeeper settings
- Verify Xcode Command Line Tools
- Check file permissions

#### Linux
- Verify package dependencies
- Check file system permissions
- Ensure proper Node.js installation

## Development and Building

### Building for Multiple Platforms
```bash
# Build for all platforms
npm run package:cross-platform

# Test compatibility
npm run test:compatibility

# Validate platforms
npm run validate:cross-platform
```

### Packaging for Distribution
```bash
# Package for VS Code Marketplace
npm run package:vscode

# Package for Open VSX Registry
npm run package:ovsx

# Package for all marketplaces
npm run package:all
```

## Contributing

When contributing to cross-IDE compatibility:

1. Test changes across all supported IDEs
2. Run compatibility test suite
3. Update this documentation if needed
4. Ensure platform-specific code is properly abstracted

## Support

For IDE-specific issues:
- VS Code: Use VS Code issue tracker
- Cursor: Use Cursor community forums
- Windsurf: Use Windsurf support channels

For extension-specific issues:
- Create an issue in the extension repository
- Include IDE version and platform information
- Provide detailed reproduction steps