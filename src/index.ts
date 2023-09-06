import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

/**
 * Initialization data for the grist-widget extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'grist-widget:plugin',
  description: 'Custom Grist widget for a JupyterLite notebook',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    const script = document.createElement('script');
    script.src = 'https://docs.getgrist.com/grist-plugin-api.js';
    script.id = 'grist-plugin-api';
    script.addEventListener('load', async () => {

      const grist = (window as any).grist;

      app.serviceManager.contents.fileChanged.connect(async (_, change) => {
        if (change.type === 'save' && change.newValue?.path === 'notebook.ipynb') {
          grist.setOption('notebook', change.newValue);
        }
      });

      grist.ready();
      const notebook = await grist.getOption('notebook') || {
        content: {
          'metadata': {
            'language_info': {
              'codemirror_mode': {
                'name': 'python',
                'version': 3
              },
              'file_extension': '.py',
              'mimetype': 'text/x-python',
              'name': 'python',
              'nbconvert_exporter': 'python',
              'pygments_lexer': 'ipython3',
              'version': '3.11'
            },
            'kernelspec': {
              'name': 'python',
              'display_name': 'Python (Pyodide)',
              'language': 'python'
            }
          },
          'nbformat_minor': 4,
          'nbformat': 4,
          'cells': [
            {
              'cell_type': 'code',
              'source': '',
              'metadata': {},
              'execution_count': null,
              'outputs': []
            }
          ]
        },
        format: 'json'
      };
      await app.serviceManager.contents.save('notebook.ipynb', notebook);
      console.log('JupyterLab extension grist-widget is activated!');
    });
    document.head.appendChild(script);
  }
};

export default plugin;
