import * as vscode from 'vscode';
import * as https from 'https';
import { 
  IAuthenticationService, 
  Credentials, 
  ValidationResult, 
  Permission
} from '../interfaces/authenticationService';
import { AuthenticationError } from '../errors/errorTypes';
import { ErrorHandler } from '../errors/errorHandler';
import { withRetry } from '../errors/errorRecovery';

/**
 * Implementation of the authentication service for Azure DevOps
 */
export class AuthenticationService implements IAuthenticationService {
  private static readonly CREDENTIALS_KEY = 'azurePipelinesAssistant.credentials';
  
  private readonly _onAuthenticationChanged = new vscode.EventEmitter<boolean>();
  public readonly onAuthenticationChanged = this._onAuthenticationChanged.event;
  
  private _isAuthenticated = false;
  private _currentOrganization: string | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly errorHandler?: ErrorHandler
  ) {
    this.initializeAuthenticationState();
  }

  /**
   * Initialize authentication state from stored credentials
   */
  private async initializeAuthenticationState(): Promise<void> {
    try {
      const credentials = await this.getStoredCredentials();
      this._isAuthenticated = credentials !== null;
      this._currentOrganization = credentials?.organization || null;
    } catch (error) {
      const authError = new AuthenticationError(
        'Failed to initialize authentication state',
        'NETWORK_ERROR',
        'Unable to load stored credentials',
        { operation: 'initializeAuthenticationState' }
      );
      
      if (this.errorHandler) {
        await this.errorHandler.handleErrorSilently(authError);
      } else {
        console.error('Failed to initialize authentication state:', error);
      }
      
      this._isAuthenticated = false;
      this._currentOrganization = null;
    }
  }

  /**
   * Validates credentials against Azure DevOps API
   */
  public async validateCredentials(organization: string, pat: string): Promise<ValidationResult> {
    if (!organization || !pat) {
      throw new AuthenticationError('Organization and Personal Access Token are required', 'INVALID_PAT');
    }

    try {
      // First, validate the PAT by getting user profile
      const userInfo = await this.getUserProfile(organization, pat);
      
      // Then check permissions by attempting to access required APIs
      const permissions = await this.checkPermissions(organization, pat);
      
      const requiredPermissions = this.getRequiredPermissions();
      const missingPermissions = requiredPermissions.filter(required => 
        !permissions.some(granted => granted.name === required.name)
      );

      return {
        isValid: missingPermissions.length === 0,
        permissions,
        missingPermissions,
        userInfo
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return {
          isValid: false,
          permissions: [],
          missingPermissions: this.getRequiredPermissions(),
          errorMessage: error.message
        };
      }
      
      throw new AuthenticationError(
        `Failed to validate credentials: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'NETWORK_ERROR'
      );
    }
  }

  /**
   * Gets user profile information from Azure DevOps
   */
  private async getUserProfile(organization: string, pat: string): Promise<{ displayName: string; emailAddress: string; id: string }> {
    const url = `https://dev.azure.com/${organization}/_apis/profile/profiles/me?api-version=6.0`;
    
    try {
      const response = await this.makeHttpRequest(url, pat);
      const data = JSON.parse(response);
      
      return {
        displayName: data.displayName || 'Unknown',
        emailAddress: data.emailAddress || 'Unknown',
        id: data.id || 'Unknown'
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('401')) {
        throw new AuthenticationError('Invalid Personal Access Token', 'INVALID_PAT');
      }
      if (error instanceof Error && error.message.includes('404')) {
        throw new AuthenticationError('Invalid organization name', 'INVALID_ORGANIZATION');
      }
      throw new AuthenticationError('Failed to get user profile', 'NETWORK_ERROR');
    }
  }

  /**
   * Checks what permissions the PAT has
   */
  private async checkPermissions(organization: string, pat: string): Promise<Permission[]> {
    const permissions: Permission[] = [];
    const permissionChecks = [
      {
        name: 'Build',
        displayName: 'Build (read)',
        url: `https://dev.azure.com/${organization}/_apis/build/definitions?api-version=6.0&$top=1`,
        required: true
      },
      {
        name: 'Code',
        displayName: 'Code (read)',
        url: `https://dev.azure.com/${organization}/_apis/git/repositories?api-version=6.0&$top=1`,
        required: true
      },
      {
        name: 'Project',
        displayName: 'Project and team (read)',
        url: `https://dev.azure.com/${organization}/_apis/projects?api-version=6.0&$top=1`,
        required: true
      },
      {
        name: 'Release',
        displayName: 'Release (read)',
        url: `https://vsrm.dev.azure.com/${organization}/_apis/release/definitions?api-version=6.0&$top=1`,
        required: true
      }
    ];

    for (const check of permissionChecks) {
      try {
        await this.makeHttpRequest(check.url, pat);
        permissions.push({
          name: check.name,
          displayName: check.displayName,
          required: check.required
        });
      } catch (error) {
        // Permission not granted - continue checking others
        console.debug(`Permission check failed for ${check.name}:`, error);
      }
    }

    return permissions;
  }

  /**
   * Gets the list of required permissions
   */
  private getRequiredPermissions(): Permission[] {
    return [
      { name: 'Build', displayName: 'Build (read)', required: true },
      { name: 'Code', displayName: 'Code (read)', required: true },
      { name: 'Project', displayName: 'Project and team (read)', required: true },
      { name: 'Release', displayName: 'Release (read)', required: true }
    ];
  }

  /**
   * Makes an HTTP request to Azure DevOps API with retry logic
   */
  private makeHttpRequest(url: string, pat: string): Promise<string> {
    return withRetry(async () => {
      return new Promise<string>((resolve, reject) => {
        const auth = Buffer.from(`:${pat}`).toString('base64');
        const urlObj = new URL(url);
        
        const options = {
          hostname: urlObj.hostname,
          port: urlObj.port || 443,
          path: urlObj.pathname + urlObj.search,
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
            'User-Agent': 'Azure-Pipelines-Assistant-VSCode'
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            }
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });

        req.end();
      });
    }, 'authenticationRequest', {
      maxRetries: 2,
      baseDelay: 1000
    });
  }

  /**
   * Retrieves stored credentials from secure storage
   */
  public async getStoredCredentials(): Promise<Credentials | null> {
    try {
      const credentialsJson = await this.context.secrets.get(AuthenticationService.CREDENTIALS_KEY);
      if (!credentialsJson) {
        return null;
      }

      const credentials = JSON.parse(credentialsJson) as Credentials;
      
      // Validate the structure
      if (!credentials.organization || !credentials.personalAccessToken) {
        console.warn('Invalid credentials structure found in storage');
        await this.clearCredentials();
        return null;
      }

      return credentials;
    } catch (error) {
      console.error('Failed to retrieve stored credentials:', error);
      return null;
    }
  }

  /**
   * Stores credentials securely using VS Code's SecretStorage API
   */
  public async storeCredentials(credentials: Credentials): Promise<void> {
    if (!credentials.organization || !credentials.personalAccessToken) {
      throw new AuthenticationError('Invalid credentials: organization and PAT are required', 'INVALID_PAT');
    }

    try {
      const credentialsJson = JSON.stringify(credentials);
      await this.context.secrets.store(AuthenticationService.CREDENTIALS_KEY, credentialsJson);
      
      // Update internal state
      this._isAuthenticated = true;
      this._currentOrganization = credentials.organization;
      
      // Fire authentication changed event
      this._onAuthenticationChanged.fire(true);
      
      console.log('Credentials stored successfully');
    } catch (error) {
      console.error('Failed to store credentials:', error);
      throw new AuthenticationError('Failed to store credentials securely', 'NETWORK_ERROR');
    }
  }

  /**
   * Clears stored credentials from secure storage
   */
  public async clearCredentials(): Promise<void> {
    try {
      await this.context.secrets.delete(AuthenticationService.CREDENTIALS_KEY);
      
      // Update internal state
      this._isAuthenticated = false;
      this._currentOrganization = null;
      
      // Fire authentication changed event
      this._onAuthenticationChanged.fire(false);
      
      console.log('Credentials cleared successfully');
    } catch (error) {
      console.error('Failed to clear credentials:', error);
      throw new AuthenticationError('Failed to clear credentials', 'NETWORK_ERROR');
    }
  }

  /**
   * Checks if the user is currently authenticated
   */
  public isAuthenticated(): boolean {
    return this._isAuthenticated;
  }

  /**
   * Gets the current organization name
   */
  public getCurrentOrganization(): string | null {
    return this._currentOrganization;
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this._onAuthenticationChanged.dispose();
  }
}