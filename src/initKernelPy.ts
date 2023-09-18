// language=Python
const code = `
def __make_grist_api():
    from pyodide.ffi import to_js
    import js
    import pyodide_js

    class ComlinkProxy:
        def __init__(self, proxy, name=None):
            self._proxy = proxy
            self._name = name

        def __getattr__(self, name):
            return ComlinkProxy(getattr(self._proxy, name), name)

        async def __call__(self, *args, **kwargs):
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
    return ComlinkProxy(js.Comlink.wrap(js).grist)


grist = __make_grist_api()
`;

export default code;
