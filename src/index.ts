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

      const records = await grist.fetchSelectedTable();
      await updateRecordsInKernel(app, records, { rerunCells: true });
      grist.onRecords(async (records: any) => {
        await updateRecordsInKernel(app, records, { rerunCells: false });
      });
    });
    document.head.appendChild(script);
  }
};

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function updateRecordsInKernel(
  app: JupyterFrontEnd,
  records: any,
  { rerunCells }: { rerunCells: boolean }
) {
  while (true) {
    const widget = app.shell.currentWidget;
    const kernel = (widget as any)?.context.sessionContext?.session?.kernel;
    if (!kernel) {
      await delay(100);
      continue;
    }
    const future = kernel.requestExecute({
      code: `__grist_records__ = ${JSON.stringify(records)}`
    });
    if (rerunCells) {
      let done = false;
      future.onIOPub = (msg: any) => {
        if (done) {
          return;
        }
        if (
          msg.header.msg_type === 'status' &&
          msg.content.execution_state === 'idle'
        ) {
          done = true;
          app.commands.execute('notebook:run-all-cells');
        }
      };
    }
    break;
  }
}

export default plugin;
