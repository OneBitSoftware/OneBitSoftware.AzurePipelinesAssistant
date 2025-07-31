import * as vscode from 'vscode';

/**
 * Represents stored credentials for Azure DevOps authentication
 */
export interface Credentials {
  organization: string;
  personalAccessToken: string;
}

/**
 * Represents the result of credential validation
 */
export interface ValidationResult {
  isValid: boolean;
  permissions: Permission[];
  missingPermissions: Permission[];
  errorMessage?: string;
  userInfo?: {
    displayName: string;
    emailAddress: string;
    id: string;
  };
}

/**
 * Represents an Azure DevOps permission
 */
export interface Permission {
  name: string;
  displayName: string;
  required: boolean;
}

/**
 * Authentication service interface for managing Azure DevOps credentials
 */
export interface IAuthenticationService {
  /**
   * Validates the provided credentials against Azure DevOps API
   * @param organization Azure DevOps organization name
   * @param pat Personal Access Token
   * @returns Promise resolving to validation result
   */
  validateCredentials(organization: string, pat: string): Promise<ValidationResult>;

  /**
   * Retrieves stored credentials from secure storage
   * @returns Promise resolving to stored credentials or null if not found
   */
  getStoredCredentials(): Promise<Credentials | null>;

  /**
   * Stores credentials securely using VS Code's SecretStorage API
   * @param credentials Credentials to store
   * @returns Promise that resolves when credentials are stored
   */
  storeCredentials(credentials: Credentials): Promise<void>;

  /**
   * Clears stored credentials from secure storage
   * @returns Promise that resolves when credentials are cleared
   */
  clearCredentials(): Promise<void>;

  /**
   * Checks if the user is currently authenticated
   * @returns True if authenticated, false otherwise
   */
  isAuthenticated(): boolean;

  /**
   * Gets the current organization name
   * @returns Organization name or null if not authenticated
   */
  getCurrentOrganization(): string | null;

  /**
   * Event fired when authentication state changes
   */
  readonly onAuthenticationChanged: vscode.Event<boolean>;
}

