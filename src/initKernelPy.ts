// language=Python
const code = `
def __make_grist_api():
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

    js.importScripts("https://unpkg.com/comlink@4.4.1/dist/umd/comlink.js")
    pyodide_js.registerComlink(js.Comlink)
    return ComlinkProxy(js.Comlink.wrap(js).grist)


grist = __make_grist_api()
`;

export default code;
