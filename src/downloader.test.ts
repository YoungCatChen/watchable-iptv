import {jest} from '@jest/globals';
import assert from 'assert';
import {
  createServer,
  IncomingMessage,
  ServerResponse,
  Server,
  RequestListener,
} from 'http';
import {lastValueFrom} from 'rxjs';
import {URL} from 'url';
import {download} from './downloader';

interface ServerInfo {
  readonly serverInstance: Server;
  readonly port: number;
  readonly listeners: Map<string, RequestListener>;
}

function startServer(): Promise<ServerInfo> {
  const listeners = new Map<string, RequestListener>();

  function globalRequestListener(req: IncomingMessage, resp: ServerResponse) {
    assert.ok(req.url);
    const url = new URL(req.url, 'http://dummy');

    if (url.pathname === '/redirect') {
      const destination = url.searchParams.get('url');
      assert.ok(destination);
      resp.writeHead(302, {['Location']: destination});
      resp.end();
      return;
    }

    for (const [path, listener] of listeners.entries()) {
      if (path === url.pathname) {
        listener(req, resp);
        return;
      }
    }

    resp.writeHead(404, `Listener for ${req.url} is not found`);
    resp.end(`Listener for ${req.url} is not found!`);
  }

  return new Promise(resolve => {
    const server = createServer(globalRequestListener);
    server.listen({host: 'localhost', port: 0}, () => {
      const address = server.address();
      assert.ok(address);
      assert.ok(typeof address === 'object');
      resolve({serverInstance: server, port: address.port, listeners});
    });
  });
}

describe('download()', () => {
  let serverInfo: ServerInfo | null = null;

  beforeAll(async () => {
    serverInfo = await startServer();
  });

  afterEach(() => {
    serverInfo?.listeners.clear();
  });

  afterAll(() => {
    serverInfo?.serverInstance.close();
  });

  describe.each`
    redirected | description
    ${false}   | ${'(when response is direct)'}
    ${true}    | ${'(when response is redirected)'}
  `('$description', ({redirected}) => {
    let urlPrefix = '';

    beforeAll(() => {
      if (redirected) {
        urlPrefix = `http://localhost:${serverInfo!.port}/redirect?url=`;
      } else {
        urlPrefix = `http://localhost:${serverInfo!.port}`;
      }
    });

    it('downloads a text file', async () => {
      serverInfo!.listeners.set('/text', (req, resp) => {
        resp.writeHead(200).end('body');
      });
      const dr = await lastValueFrom(download(`${urlPrefix}/text`, 1));
      expect(dr.status).toBe('done');
      expect(dr.reqUrl.href).toContain('/text');
      expect(dr.respUrl?.href).toContain('/text');
      expect(dr.statusCode).toBe(200);
      expect(dr.error).toBeFalsy();
      expect(dr.byteLength).toBe(4);
      expect(dr.looksLikeText).toBeTruthy();
      expect(dr.text).toBe('body');
    });

    it('downloads a binary file', async () => {
      serverInfo!.listeners.set('/binary', (req, resp) => {
        resp.writeHead(200);
        resp.end(Buffer.from([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70]));
      });
      const dr = await lastValueFrom(download(`${urlPrefix}/binary`, 1));
      expect(dr.status).toBe('done');
      expect(dr.byteLength).toBe(8);
      expect(dr.looksLikeText).toBeFalsy();
    });

    xit('tracks download speed', async () => {});
    xit('follows redirection', async () => {});
    xit('reports error on unsupported scheme', async () => {});
    xit('reports error on connection establishment', async () => {});
    xit('reports error on bad status code', async () => {});
    xit('reports error on connection lost', async () => {});
    xit('reports time-out on response late on first byte', async () => {});
    xit('reports time-out on response body taking too long', async () => {});
    xit('reports aborted on unsubscribed observable', async () => {});
  });
});
