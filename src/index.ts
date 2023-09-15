import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import * as Comlink from 'comlink';

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

      const kernel = await getKernel(app);
      kernel.requestExecute({
        code: `
from pyodide.ffi import to_js
import js
import pyodide_js


class ComlinkProxy:
    def __init__(self, proxy):
        self.proxy = proxy

    def __getattr__(self, name):
        return ComlinkProxy(getattr(self.proxy, name))

    async def __call__(self, *args, **kwargs):
        args = [
            to_js(arg, dict_converter=js.Object.fromEntries)
            for arg in args
        ]
        kwargs = {
            key: to_js(value, dict_converter=js.Object.fromEntries)
            for key, value in kwargs.items()
        }
        result = await self.proxy(*args, **kwargs)
        if hasattr(result, "to_py"):
            result = result.to_py()
        return result


__grist_plugin__ = None

def __get_grist_plugin():
    global __grist_plugin__
    if __grist_plugin__ is not None:
        return __grist_plugin__

    js.importScripts("https://unpkg.com/comlink@4.4.1/dist/umd/comlink.js")
    pyodide_js.registerComlink(js.Comlink)
    __grist_plugin__ = ComlinkProxy(js.Comlink.wrap(js).grist)
    return __grist_plugin__
`
      });

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
  grist = {
    ...grist,
    getTable: (tableId: string) => Comlink.proxy(grist.getTable(tableId))
  };
  Comlink.expose(grist, worker);
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

export default plugin;
