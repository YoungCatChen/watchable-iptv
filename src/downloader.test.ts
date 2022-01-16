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
import {download} from './downloader';

interface ServerInfo {
  readonly serverInstance: Server;
  readonly port: number;
  readonly handlers: Map<string, RequestListener>;
}

function startServer(): Promise<ServerInfo> {
  const handlers = new Map<string, RequestListener>();

  function globalRequestListener(req: IncomingMessage, resp: ServerResponse) {
    for (const [path, listener] of handlers.entries()) {
      if (path === req.url) {
        listener(req, resp);
        return;
      }
    }
    resp.writeHead(404, 'Listener not found');
    resp.end('Listener not found!');
  }

  return new Promise(resolve => {
    const server = createServer(globalRequestListener);
    server.listen({host: 'localhost', port: 0}, () => {
      const address = server.address();
      assert.ok(address);
      assert.ok(typeof address === 'object');
      resolve({serverInstance: server, port: address.port, handlers});
    });
  });
}

describe('download()', () => {
  let serverInfo: ServerInfo | null = null;
  let hostport = 'http://1.1.1.1:1111';

  beforeAll(async () => {
    serverInfo = await startServer();
    hostport = `http://localhost:${serverInfo.port}`;
  });

  afterEach(() => {
    serverInfo?.handlers.clear();
  });

  afterAll(() => {
    serverInfo?.serverInstance.close();
  });

  it('downloads a text file', async () => {
    serverInfo!.handlers.set('/text', (req, resp) => {
      resp.writeHead(200);
      resp.end('body');
    });
    const dr = await lastValueFrom(download(`${hostport}/text`, 1));
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
    serverInfo!.handlers.set('/binary', (req, resp) => {
      resp.writeHead(200);
      resp.end(Buffer.from([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70]));
    });
    const dr = await lastValueFrom(download(`${hostport}/binary`, 1));
    expect(dr.status).toBe('done');
    expect(dr.byteLength).toBe(8);
    expect(dr.looksLikeText).toBeFalsy();
  });

  xit('tracks download speed', async () => {});
  xit('follows redirection', async () => {});
  xit('reports error on unsupported scheme', async () => {});
  xit('reports error on 404 not found', async () => {});
  xit('reports error on connection lost', async () => {});
  xit('reports time-out before initial response comes', async () => {});
  xit('reports time-out before redirected response comes', async () => {});
  xit('reports time-out before response ends', async () => {});
  xit('reports aborted on unsubscribed observable', async () => {});
});
