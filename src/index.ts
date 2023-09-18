import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import * as Comlink from 'comlink';
import initKernelPy from './initKernelPy';

const pendingWorkers: MyWorker[] = [];

class MyWorker extends Worker {
  constructor(scriptURL: string | URL, options?: WorkerOptions) {
    super(scriptURL, options);
    const { grist } = (window as any);
    if (grist) {
      exposeWorker(this, grist);
    } else {
      pendingWorkers.push(this);
    }
  }
}

window.Worker = MyWorker;

const emptyNotebook = {
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
  format: 'json' as const,
};

/**
 * Initialization data for the grist-widget extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'grist-widget:plugin',
  description: 'Custom Grist widget for a JupyterLite notebook',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    // Make sure there's a notebook file so it doesn't give a 404 error
    // if the grist plugin loads too slowly.
    app.serviceManager.contents.save('notebook.ipynb', emptyNotebook);

    hideBars(app).catch(e => console.error(e));

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
      const notebook = await grist.getOption('notebook');
      if (notebook) {
        await app.serviceManager.contents.save('notebook.ipynb', notebook);
        // Immediately reload the notebook file, otherwise it will show a dialog
        // asking the user if they want to reload the file.
        await app.commands.execute('docmanager:reload');
      }

      console.log('JupyterLab extension grist-widget is activated!');

      const kernel = await getKernel(app);
      kernel.requestExecute({ code: initKernelPy });

      for (const worker of pendingWorkers) {
        exposeWorker(worker, grist);
      }
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

function exposeWorker(worker: Worker, grist: any) {
  Comlink.expose({
    grist: {
      ...grist,
      getTable: (tableId: string) => Comlink.proxy(grist.getTable(tableId))
    }
  }, worker);
}

async function getKernel(app: JupyterFrontEnd) {
  while (true) {
    const widget = app.shell.currentWidget;
    const kernel = (widget as any)?.context.sessionContext?.session?.kernel;
    if (kernel) {
      return kernel;
    }
    await delay(100);
  }
}

async function updateRecordsInKernel(
  app: JupyterFrontEnd,
  records: any,
  { rerunCells }: { rerunCells: boolean }
) {
  const kernel = await getKernel(app);
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
}

async function hideBars(app: JupyterFrontEnd) {
  while (!app.shell.currentWidget) {
    await delay(100);
  }
  const shell = app.shell as any;
  shell.collapseLeft();
  shell._titleHandler.parent.setHidden(true);
  shell._leftHandler.sideBar.setHidden(true);
  for (let i = 0; i < 1000; i++) {
    if (!shell.leftCollapsed) {
      shell.collapseLeft();
      shell._leftHandler.sideBar.setHidden(true);
      break;
    } else {
      await delay(10);
    }
  }
}

export default plugin;
