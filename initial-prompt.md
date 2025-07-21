I am writing a technical specification. I want to build a VS Code extension. I want the extension to view Azure Pipelines and show me a list of them, show their execution runs, show me the jobs/stages/tasks for each run. I don't want the tool to help me write Azure Pipelines and YAML. It should visualise the pipelines similiar to the UI in Azure DevOps pipelines.

There is already an extension for vscode (https://github.com/pedroccaetano/azure-pipeline-runner) that looks promising, however it doesn't run in Cursor IDE and in Windsurf IDE. It doesn't work in modern VSCode.

It must be Open VSX so we can publish it in the Open VSX Registry at https://open-vsx.org/.

Please review https://github.com/pedroccaetano/azure-pipeline-runner and write a specification for such a vscode extension.

See:
https://learn.microsoft.com/en-us/azure/devops/pipelines/get-started/key-pipelines-concepts?view=azure-devops 
https://learn.microsoft.com/en-us/azure/devops/pipelines/?view=azure-devops
https://learn.microsoft.com/en-us/rest/api/azure/devops/pipelines/?view=azure-devops-rest-7.1
https://learn.microsoft.com/en-us/rest/api/azure/devops/?view=azure-devops-rest-7.2
https://code.visualstudio.com/api/get-started/your-first-extension
https://github.com/pedroccaetano/azure-pipeline-runner