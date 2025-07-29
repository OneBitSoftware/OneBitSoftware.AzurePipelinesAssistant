# Contributing to Azure Pipelines Assistant

Thank you for your interest in contributing to Azure Pipelines Assistant! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.x or higher
- **npm** 8.x or higher
- **VS Code** 1.74.0+ (recommended for development)
- **Git** for version control

### Development Environment Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/azure-pipelines-assistant/azure-pipelines-assistant.git
   cd azure-pipelines-assistant
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Open in VS Code**
   ```bash
   code .
   ```

4. **Build the extension**
   ```bash
   npm run build:development
   ```

5. **Run tests**
   ```bash
   npm run test:unit
   ```

## 🏗️ Project Structure

```
azure-pipelines-assistant/
├── src/                          # Source code
│   ├── commands/                 # Command implementations
│   ├── errors/                   # Error handling and types
│   ├── interfaces/               # TypeScript interfaces
│   ├── models/                   # Data models
│   ├── services/                 # Core services
│   ├── utils/                    # Utility functions
│   ├── webviews/                 # Webview providers
│   └── extension.ts              # Main extension entry point
├── media/                        # Static assets (CSS, JS for webviews)
├── scripts/                      # Build and utility scripts
├── src/test/                     # Test files
│   ├── unit/                     # Unit tests
│   ├── integration/              # Integration tests
│   ├── e2e/                      # End-to-end tests
│   └── fixtures/                 # Test data and mocks
├── dist/                         # Built extension files
├── packages/                     # Distribution packages
└── docs/                         # Documentation
```

## 🛠️ Development Workflow

### Building the Extension

```bash
# Development build (with source maps)
npm run build:development

# Production build (optimized)
npm run build:production

# Watch mode (rebuilds on changes)
npm run build:watch
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Debugging

1. **Open the project in VS Code**
2. **Press F5** to launch the Extension Development Host
3. **Set breakpoints** in your TypeScript code
4. **Use the extension** in the development host to trigger breakpoints

### Code Quality

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint -- --fix

# Type checking
npm run check-types

# Format code
npm run format
```

## 🧪 Testing Guidelines

### Test Structure

We use VS Code's testing framework with the following structure:

```typescript
// Use VS Code's suite and test syntax
suite('ServiceName', () => {
  let service: ServiceName;
  
  setup(() => {
    // Setup before each test
    service = new ServiceName();
  });
  
  teardown(() => {
    // Cleanup after each test
    service.dispose();
  });
  
  suite('methodName', () => {
    test('should do something', async () => {
      // Test implementation
      const result = await service.methodName();
      assert.strictEqual(result, expectedValue);
    });
  });
});
```

### Test Categories

1. **Unit Tests** (`src/test/unit/`)
   - Test individual functions and classes in isolation
   - Use mocks for dependencies
   - Fast execution

2. **Integration Tests** (`src/test/integration/`)
   - Test interaction between components
   - May use real Azure DevOps API (with test organization)
   - Slower execution

3. **End-to-End Tests** (`src/test/e2e/`)
   - Test complete user workflows
   - Test extension activation and commands
   - Slowest execution

4. **Performance Tests** (`src/test/performance/`)
   - Test memory usage and response times
   - Benchmark critical operations
   - Ensure scalability

### Writing Good Tests

- **Use descriptive test names** that explain what is being tested
- **Follow the AAA pattern**: Arrange, Act, Assert
- **Test both success and failure scenarios**
- **Use appropriate mocks** to isolate units under test
- **Keep tests independent** - each test should be able to run in isolation

## 📝 Code Style Guidelines

### TypeScript Guidelines

- **Use strict TypeScript** - enable all strict compiler options
- **Prefer interfaces over types** for object shapes
- **Use explicit return types** for public methods
- **Document public APIs** with JSDoc comments
- **Use meaningful variable names** - avoid abbreviations

### Code Organization

- **One class per file** with the same name as the file
- **Group related functionality** in services
- **Use dependency injection** for testability
- **Implement proper error handling** with custom error types
- **Follow SOLID principles**

### Example Code Style

```typescript
/**
 * Service for managing Azure DevOps pipeline operations
 */
export class AzureDevOpsService implements IAzureDevOpsService {
  constructor(
    private readonly apiClient: IApiClient,
    private readonly cacheService: ICacheService,
    private readonly logger: ILogger
  ) {}

  /**
   * Retrieves all projects from Azure DevOps
   * @returns Promise resolving to array of projects
   * @throws {AuthenticationError} When authentication fails
   * @throws {NetworkError} When API request fails
   */
  async getProjects(): Promise<Project[]> {
    try {
      const cacheKey = 'projects';
      const cached = this.cacheService.get<Project[]>(cacheKey);
      
      if (cached) {
        return cached;
      }

      const response = await this.apiClient.get<ProjectsResponse>('/projects');
      const projects = response.data.value;
      
      this.cacheService.set(cacheKey, projects);
      return projects;
    } catch (error) {
      this.logger.error('Failed to fetch projects', error);
      throw error;
    }
  }
}
```

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Clear description** of the issue
2. **Steps to reproduce** the problem
3. **Expected behavior** vs actual behavior
4. **Environment information**:
   - IDE and version
   - Operating system
   - Extension version
   - Azure DevOps organization type (cloud/server)
5. **Error messages** or logs if available
6. **Screenshots** if applicable

### Bug Report Template

```markdown
## Bug Description
A clear and concise description of the bug.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What you expected to happen.

## Actual Behavior
What actually happened.

## Environment
- IDE: VS Code 1.85.0
- OS: Windows 11
- Extension Version: 0.0.1
- Azure DevOps: Cloud

## Additional Context
Any other context about the problem.
```

## 💡 Feature Requests

We welcome feature requests! Please:

1. **Check existing issues** to avoid duplicates
2. **Provide clear use cases** for the feature
3. **Describe the expected behavior** in detail
4. **Consider implementation complexity** and maintenance burden
5. **Be open to discussion** about alternative approaches

### Feature Request Template

```markdown
## Feature Description
A clear and concise description of the feature.

## Use Case
Describe the problem this feature would solve.

## Proposed Solution
Describe how you envision this feature working.

## Alternatives Considered
Any alternative solutions you've considered.

## Additional Context
Any other context or screenshots about the feature.
```

## 🔄 Pull Request Process

### Before Submitting

1. **Fork the repository** and create a feature branch
2. **Write tests** for your changes
3. **Ensure all tests pass** (`npm test`)
4. **Run linting** (`npm run lint`)
5. **Update documentation** if needed
6. **Test manually** in the Extension Development Host

### Pull Request Guidelines

1. **Use a clear title** that describes the change
2. **Reference related issues** using keywords (fixes #123)
3. **Provide detailed description** of changes
4. **Include screenshots** for UI changes
5. **Keep changes focused** - one feature/fix per PR
6. **Update CHANGELOG.md** if applicable

### Pull Request Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings introduced
```

## 🏷️ Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Steps

1. **Update version** in package.json
2. **Update CHANGELOG.md** with release notes
3. **Create release branch** (`release/v1.0.0`)
4. **Run full test suite** and manual testing
5. **Build production package** (`npm run package:all`)
6. **Create GitHub release** with release notes
7. **Publish to marketplaces** (VS Code Marketplace, Open VSX)

## 🤝 Community Guidelines

### Code of Conduct

- **Be respectful** and inclusive
- **Welcome newcomers** and help them get started
- **Focus on constructive feedback**
- **Assume good intentions**
- **Report inappropriate behavior**

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and community discussion
- **Pull Requests**: Code contributions and reviews

## 📚 Additional Resources

### Documentation

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Azure DevOps REST API](https://docs.microsoft.com/en-us/rest/api/azure/devops/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Documentation](https://nodejs.org/en/docs/)

### Tools and Libraries

- **esbuild**: Fast JavaScript bundler
- **ESLint**: JavaScript/TypeScript linting
- **Mocha**: Testing framework
- **Sinon**: Test spies, stubs, and mocks
- **VS Code Test Runner**: Extension testing

## ❓ Getting Help

If you need help:

1. **Check the documentation** and existing issues
2. **Ask in GitHub Discussions** for general questions
3. **Create an issue** for specific problems
4. **Join the community** and help others

Thank you for contributing to Azure Pipelines Assistant! 🎉