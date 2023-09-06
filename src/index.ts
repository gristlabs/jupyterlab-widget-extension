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
    app.serviceManager.contents.save('notebook.ipynb', {
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
      format: 'json',
    });
    console.log('JupyterLab extension grist-widget is activated!');
  }
};

export default plugin;
