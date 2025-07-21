import { ProjectState, ProjectVisibility } from './common';

/**
 * Azure DevOps Project model
 */
export interface Project {
    id: string;
    name: string;
    description?: string;
    url: string;
    state: ProjectState;
    visibility: ProjectVisibility;
}