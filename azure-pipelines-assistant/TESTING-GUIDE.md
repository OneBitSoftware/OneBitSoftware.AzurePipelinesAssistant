# Azure Pipelines Assistant - Testing Guide

This guide explains how to test the Azure Pipelines Assistant extension using the provided launch configurations.

## 🚀 Quick Start

1. **Open the workspace root in VS Code**:
   ```bash
   code .
   ```

2. **Install dependencies**:
   ```bash
   cd azure-pipelines-assistant
   npm install
   ```

3. **Choose a testing method** from the options below.

> **Note**: All VS Code configurations (launch, tasks, settings) are consolidated in the root `.vscode/` folder. All Azure Pipelines extension configurations are prefixed with "Azure Pipelines" for easy identification.

## 🎯 Launch Configurations

Access these configurations via **Run and Debug** view (`Ctrl+Shift+D`) or press `F5`.

### 🔧 **Development & Testing**

#### **1. Run Azure Pipelines Extension** ⭐ *Most Common*
- **Purpose**: Launch extension in development mode
- **Usage**: Press `F5` or select from debug dropdown
- **What it does**: 
  - Compiles the extension
  - Opens new VS Code window with extension loaded
  - Enables debugging with breakpoints

#### **2. Run Azure Pipelines Extension (Watch Mode)** ⭐ *For Active Development*
- **Purpose**: Launch with automatic recompilation
- **Usage**: Select from debug dropdown
- **What it does**:
  - Starts file watcher
  - Automatically recompiles on file changes
  - Hot reload for faster development

#### **3. Debug Azure Pipelines Extension**
- **Purpose**: Advanced debugging with isolated environment
- **Usage**: Select from debug dropdown
- **What it does**:
  - Disables other extensions for clean testing
  - Enhanced debugging features
  - Async stack traces enabled

### 🧪 **Testing Configurations**

#### **4. Azure Pipelines Extension Tests**
- **Purpose**: Run all extension unit tests
- **Usage**: Select from debug dropdown
- **What it does**:
  - Compiles tests
  - Runs full test suite in VS Code environment
  - Shows test results in debug console

#### **5. Azure Pipelines Cross-IDE Compatibility Tests**
- **Purpose**: Test compatibility across IDEs
- **Usage**: Select from debug dropdown
- **What it does**:
  - Tests VS Code, Cursor, and Windsurf compatibility
  - Validates API usage
  - Checks Open VSX Registry requirements

#### **6. Azure Pipelines Platform Validation Tests**
- **Purpose**: Test cross-platform functionality
- **Usage**: Select from debug dropdown
- **What it does**:
  - Tests Windows, macOS, and Linux compatibility
  - Validates file system operations
  - Checks environment variables

#### **7. Debug Azure Pipelines Extension Tests**
- **Purpose**: Debug individual test files
- **Usage**: Select from debug dropdown
- **What it does**:
  - Runs Mocha tests with debugging
  - Allows breakpoints in test files
  - Extended timeout for debugging

### 📦 **Packaging & Distribution**

#### **8. Package Azure Pipelines Extension**
- **Purpose**: Create distributable packages
- **Usage**: Select from debug dropdown
- **What it does**:
  - Creates VSIX packages for VS Code and Open VSX
  - Tests packaging process
  - Validates package contents

### 🔍 **Specialized Debugging**

#### **9. Debug Azure Pipelines Authentication**
- **Purpose**: Focus on authentication debugging
- **Usage**: Select from debug dropdown
- **Environment**: `DEBUG_AUTH=true`

#### **10. Debug Azure Pipelines Tree Provider**
- **Purpose**: Focus on tree view debugging
- **Usage**: Select from debug dropdown
- **Environment**: `DEBUG_TREE=true`

### 🔄 **Compound Configurations**

#### **11. Azure Pipelines: Extension + Watch**
- **Purpose**: Combined development setup
- **Usage**: Select from debug dropdown
- **What it does**: Runs extension with watch mode

#### **12. Azure Pipelines: Full Test Suite**
- **Purpose**: Run all tests sequentially
- **Usage**: Select from debug dropdown
- **What it does**: Runs unit tests, compatibility tests, and platform validation

#### **13. Azure Pipelines: Debug Extension + Tests**
- **Purpose**: Debug extension and tests simultaneously
- **Usage**: Select from debug dropdown

## 📋 **Step-by-Step Testing Workflows**

### 🎯 **Basic Extension Testing**

1. **Start Development**:
   - Select **"Run Azure Pipelines Extension"** configuration
   - Press `F5`
   - New VS Code window opens with extension loaded

2. **Configure Extension**:
   - In the new window, open Command Palette (`Ctrl+Shift+P`)
   - Run: `Azure Pipelines: Configure`
   - Enter your Azure DevOps organization
   - Enter your Personal Access Token

3. **Test Core Features**:
   - Check Explorer sidebar for "Azure Pipelines" view
   - Verify status bar shows connection status
   - Test commands in Command Palette
   - Right-click pipelines for context menu

### 🧪 **Comprehensive Testing**

1. **Run Full Test Suite**:
   - Select **"Azure Pipelines: Full Test Suite"** compound configuration
   - Monitor test results in Debug Console
   - Check for any failures

2. **Test Cross-IDE Compatibility**:
   - Select **"Azure Pipelines Cross-IDE Compatibility Tests"**
   - Verify all compatibility checks pass
   - Review compatibility report

3. **Validate Platform Support**:
   - Select **"Azure Pipelines Platform Validation Tests"**
   - Check platform-specific functionality
   - Verify file system operations

### 📦 **Package Testing**

1. **Create Package**:
   - Select **"Package Azure Pipelines Extension"** configuration
   - Wait for packaging to complete
   - Check `azure-pipelines-assistant/packages/` directory for VSIX files

2. **Install and Test Package**:
   - Go to Extensions view (`Ctrl+Shift+X`)
   - Click "..." → "Install from VSIX..."
   - Select generated VSIX file
   - Test installed extension

## 🛠️ **Available Tasks**

Access via Command Palette (`Ctrl+Shift+P`) → "Tasks: Run Task":

### Build Tasks
- **npm: compile** - Compile TypeScript
- **npm: watch** - Watch mode compilation
- **npm: package** - Create production build
- **Build and Package** - Full build pipeline

### Test Tasks
- **npm: test** - Run unit tests
- **npm: test:compatibility** - Cross-IDE tests
- **npm: validate:cross-platform** - Platform tests
- **Full Test and Build** - Complete validation

### Utility Tasks
- **Lint Code** - Run ESLint
- **Type Check** - TypeScript type checking
- **Clean Build** - Clean build artifacts
- **Install Dependencies** - npm install

## 🔧 **Debugging Tips**

### **Setting Breakpoints**
1. Open source file in VS Code
2. Click in gutter next to line number
3. Red dot appears indicating breakpoint
4. Run extension in debug mode
5. Execution pauses at breakpoint

### **Debug Console**
- View variables and expressions
- Execute code in current context
- Monitor extension logs

### **Output Panel**
- View extension logs: `View` → `Output` → "Azure Pipelines Assistant"
- Monitor compilation: Select "Tasks" from dropdown
- Check test results: Select appropriate test output

### **Developer Tools**
- In extension development window: `Help` → `Toggle Developer Tools`
- View console logs and network requests
- Monitor extension activation

## 🚨 **Troubleshooting**

### **Extension Won't Start**
1. Check Debug Console for errors
2. Verify compilation succeeded
3. Run **"Type Check"** task
4. Check **"npm: compile"** task output

### **Tests Failing**
1. Run **"npm: compile-tests"** task
2. Check test file syntax
3. Verify mock data is correct
4. Use **"Debug Specific Test File"** for detailed debugging

### **Authentication Issues**
1. Use **"Debug Authentication Service"** configuration
2. Check PAT permissions in Azure DevOps
3. Verify organization name format
4. Test with different credentials

### **Tree View Not Loading**
1. Use **"Debug Tree Data Provider"** configuration
2. Check network connectivity
3. Verify API responses in Debug Console
4. Test with different Azure DevOps projects

## 📊 **Performance Monitoring**

### **Extension Diagnostics**
- Command: `Azure Pipelines: Show Extension Diagnostics`
- Shows memory usage, activation time, resource count

### **Memory Diagnostics**
- Command: `Azure Pipelines: Show Memory Diagnostics`
- Monitors memory consumption over time

### **Health Checks**
- Command: `Azure Pipelines: Run Health Check`
- Validates all extension components

## 🎯 **Best Practices**

1. **Use Watch Mode** during active development
2. **Set breakpoints** for complex debugging scenarios
3. **Run tests frequently** to catch regressions early
4. **Test with real data** when possible
5. **Monitor performance** with diagnostic commands
6. **Test error scenarios** with invalid credentials
7. **Validate cross-platform** before releases

## 📝 **Testing Checklist**

### ✅ **Before Each Release**
- [ ] All unit tests pass
- [ ] Cross-IDE compatibility validated
- [ ] Platform validation successful
- [ ] Package creation works
- [ ] Manual testing with real Azure DevOps data
- [ ] Error handling tested
- [ ] Performance acceptable
- [ ] Documentation updated

### ✅ **During Development**
- [ ] Extension activates without errors
- [ ] Core features work as expected
- [ ] No console errors or warnings
- [ ] Memory usage stable
- [ ] Responsive UI interactions

This testing guide should help you thoroughly validate the Azure Pipelines Assistant extension across all supported scenarios and platforms.