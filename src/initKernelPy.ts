// language=Python
const code = `
async def __bootstrap_grist():
    from pyodide.http import pyfetch  # noqa
    import io
    import tarfile
    
    response = await pyfetch('/files/package.tar.gz')
    bytes_file = io.BytesIO(await response.bytes())
    with tarfile.open(fileobj=bytes_file) as tar:
        tar.extractall()
    
    import grist.browser  # noqa
    return grist.browser.grist

grist = await __bootstrap_grist()
`;

export default code;
