import { Project } from './project';
import { Repository } from './common';

/**
 * Azure DevOps Pipeline model
 */
export interface Pipeline {
    id: number;
    name: string;
    project: Project;
    folder?: string;
    revision: number;
    url: string;
    configuration: {
        type: 'yaml' | 'designerJson';
        path: string;
        repository: Repository;
    };
}