// language=Python
const code = `
def __make_grist_api():
    from pyodide.ffi import to_js, create_proxy
    import js
    import pyodide_js
    import inspect
    import traceback
    import asyncio
    
    async def maybe_await(value):
        while inspect.isawaitable(value):
            value = await value
        return value
    
    def run_async(coro):
        if inspect.iscoroutinefunction(coro):
            coro = coro()
        asyncio.get_running_loop().run_until_complete(coro)

    class ComlinkProxy:
        def __init__(self, proxy, name=None):
            self._proxy = proxy
            self._name = name

        def __getattr__(self, name):
            return ComlinkProxy(getattr(self._proxy, name), name)

        async def __call__(self, *args, **kwargs):
            if any(callable(arg) for arg in args):
                assert len(args) == 1 and not kwargs, "Only one argument is supported for callbacks"
                [callback] = args
                async def wrapper(*callback_args):
                    callback_args = [
                        a.to_py() if hasattr(a, "to_py") else a
                        for a in callback_args
                    ]
                    await maybe_await(callback(*callback_args))

                js._grist_tmp1 = self._proxy
                js._grist_tmp2 = js.Comlink.proxy(create_proxy(wrapper))
                result = await js.eval("_grist_tmp1(_grist_tmp2)")
            else:
                args = [
                    to_js(arg, dict_converter=js.Object.fromEntries)
                    for arg in args
                ]
                kwargs = {
                    key: to_js(value, dict_converter=js.Object.fromEntries)
                    for key, value in kwargs.items()
                }
                result = await self._proxy(*args, **kwargs)

            if self._name == "getTable":
                result = ComlinkProxy(result)
            elif hasattr(result, "to_py"):
                result = result.to_py()
            return result

    js.importScripts("https://unpkg.com/comlink@4.4.1/dist/umd/comlink.js")
    pyodide_js.registerComlink(js.Comlink)
    
    get_ipython().display_formatter.formatters['text/plain'].for_type(
        str, lambda string, pp, cycle: pp.text(string)
    )
    
    def auto_display():
        handles = [display(display_id=True) for _ in range(45)]
        
        def start():
            for handle in handles:
                handle.update({}, raw=True)

            i = 0
            def disp(obj):
                nonlocal i
                # if i == len(handles) - 1:
                #     raise RuntimeError("Too many display calls")
                handles[i].update(obj)
                i += 1
            return disp
        return start
    
    def wrap_with_display(wrapper):
        disp_start = auto_display()
        async def inner_wrapper(*args):
            displayer = disp_start()
            try:
                await maybe_await(wrapper(displayer, *args))
            except Exception as e:
                displayer("".join(traceback.format_exception(
                    e.__class__, e, skip_traceback_internals(e.__traceback__)
                )))
                
        return inner_wrapper

    def skip_traceback_internals(tb):
        filename = (lambda: 0).__code__.co_filename
        original = tb
        while tb and tb.tb_frame.f_code.co_filename == filename:
            tb = tb.tb_next
        if tb:
            return tb
        else:
            return original

    class Grist:
        def __init__(self):
            self.raw = ComlinkProxy(js.Comlink.wrap(js).grist)
        
        def on_records(self, callback):
            @wrap_with_display
            async def wrapper(displayer, _, *rest):
                records = await self.raw.fetchSelectedTable(keepEncoded=True)
                return callback(displayer, records, *rest)

            @run_async
            async def run():
                await wrapper(None)
                await self.raw.onRecords(wrapper)
    
        def on_record(self, callback):
            @wrap_with_display
            async def wrapper(displayer, record, *rest):
                if record:
                    record = await self.raw.fetchSelectedRecord(record['id'], keepEncoded=True)
                    return callback(displayer, record, *rest)
            
            @run_async
            async def run():
                await wrapper(await self.raw.getCurrentRecord())
                await self.raw.onRecord(wrapper)
    
    
    return Grist() 


grist = __make_grist_api()
`;

export default code;
