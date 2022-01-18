import assert from 'assert';
import * as http from 'http';
import {lastValueFrom} from 'rxjs';
import {URL} from 'url';
import {download, DownloadStatus} from './downloader';

/** A convenient promised-based wrapper over `http.Server`. */
class Server {
  /** Creates a `Server` and waits for successful listen. */
  static createAndListen(): Promise<Server> {
    return new Promise(resolve => {
      const listenerWrap: [http.RequestListener] = [console.log];
      const callListener: http.RequestListener = (req, resp) => {
        listenerWrap[0](req, resp);
      };
      const server = http.createServer(callListener);
      server.listen({host: 'localhost', port: 0}, () => {
        resolve(new Server(server, listenerWrap));
      });
    });
  }

  readonly port: number;
  readonly listeners = new Map<string, http.RequestListener>();
  numConnections = 0;

  constructor(
    readonly serverInstance: http.Server,
    /**
     * An array that has only one `http.RequestListener` callback function. Its
     * (only) element will be replaced by `Server`'s own listener. The array is
     * for caller and this constructor to keep an object reference. Caller
     * should make sure to let `http.Server` call the replaced listener.
     */
    listenerWrap: [http.RequestListener]
  ) {
    listenerWrap[0] = this.dispatch.bind(this);
    const address = serverInstance.address();
    assert.ok(address);
    assert.ok(typeof address === 'object');
    this.port = address.port;
  }

  /**
   * Dispatches requests to `this.listeners` according to the request path. It
   * takes care of `/redirect` requests. It maintains `this.numConnections`.
   *
   * This is the the actual listener of the underlying `http.Server`.
   */
  private dispatch(req: http.IncomingMessage, resp: http.ServerResponse) {
    this.numConnections++;
    resp.on('close', () => {
      this.numConnections--;
    });

    assert.ok(req.url);
    const url = new URL(req.url, 'http://dummy');

    if (url.pathname === '/redirect') {
      const destination = url.searchParams.get('url');
      assert.ok(destination);
      resp.writeHead(302, {['Location']: destination});
      resp.end();
      return;
    }

    for (const [path, listener] of this.listeners.entries()) {
      if (path === url.pathname) {
        listener(req, resp);
        return;
      }
    }

    resp.writeHead(404, `Listener for ${req.url} is not found`);
    resp.end(`Listener for ${req.url} is not found!`);
  }
}

describe('download()', () => {
  let server: Server | null = null;

  beforeAll(async () => {
    server = await Server.createAndListen();
  });

  afterEach(() => {
    server?.listeners.clear();
  });

  afterAll(() => {
    server?.serverInstance.close();
  });

  type GetFullUrlFn = (pathOrFull: string) => string;

  /** Prepends `http://localhost:<port>`, if input is only a URL path. */
  function getFullUrlNoRedirection(pathOrFull: string): string {
    if (pathOrFull.includes('://')) return pathOrFull;
    assert.ok(pathOrFull.startsWith('/'));
    return `http://localhost:${server!.port}${pathOrFull}`;
  }

  /** Prepends a redirection prefix to the input URL. */
  function getFullUrlWithRedirection(pathOrFull: string): string {
    return `http://localhost:${server!.port}/redirect?url=${pathOrFull}`;
  }

  describe.each<[string, GetFullUrlFn]>([
    ['when response is direct', getFullUrlNoRedirection],
    ['when response is redirected', getFullUrlWithRedirection],
  ])('%s', (description, getFullUrl) => {
    it('downloads a text file', async () => {
      server!.listeners.set('/text', (req, resp) => {
        resp.writeHead(200).end('body');
      });
      const dr = await lastValueFrom(download(getFullUrl('/text'), 1));
      expect(dr.status).toBe<DownloadStatus>('done');
      expect(dr.reqUrl.href).toContain('/text');
      expect(dr.respUrl?.href).toContain('/text');
      expect(dr.statusCode).toBe(200);
      expect(dr.error).toBeFalsy();
      expect(dr.byteLength).toBe(4);
      expect(dr.looksLikeText).toBeTruthy();
      expect(dr.text).toBe('body');
    });

    it('downloads a binary file', async () => {
      server!.listeners.set('/binary', (req, resp) => {
        resp.writeHead(200);
        resp.end(Buffer.from([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70]));
      });
      const dr = await lastValueFrom(download(getFullUrl('/binary'), 1));
      expect(dr.status).toBe<DownloadStatus>('done');
      expect(dr.byteLength).toBe(8);
      expect(dr.looksLikeText).toBeFalsy();
    });

    it('tracks download speed', async () => {
      server!.listeners.set('/binary', async (req, resp) => {
        // request      header    body (50B)   body (50B)
        //     |---------->>---------->>---------->>|
        //      <--50ms-->
        await sleep(50);
        resp.writeHead(200).flushHeaders();
        await sleep(50);
        resp.write(Buffer.alloc(50, 'a'));
        await sleep(50);
        resp.end(Buffer.alloc(50, 'b'));
      });

      const dr = await lastValueFrom(download(getFullUrl('/binary'), 1));
      expect(dr.status).toBe<DownloadStatus>('done');
      expect(dr.byteLength).toBe(100);

      // Each chunk is 50ms; between header chunk (1st) and ending chunk (3rd)
      // is 100ms. 100bytes / 100ms == 1000 bytes/sec.
      expect(dr.bytesPerSecond).toBeGreaterThan(900);
      expect(dr.bytesPerSecond).toBeLessThan(1100);
    });

    it('tracks download speed even when download is incomplete', async () => {
      server!.listeners.set('/binary', async (req, resp) => {
        // Similar to above, but more body chunks.
        // request      header       body        body         body
        //     |---------->>---------->>---------->>---....---->>|
        //                  <----- 10 body chunks = 500 ms ----->
        //      <-- 1 header chunk + 10 body chunks = 550 ms --->
        await sleep(50);
        resp.writeHead(200).flushHeaders();
        for (let i = 0; i < 10; i++) {
          await sleep(50);
          resp.write(Buffer.alloc(50, String(i)));
        }
        resp.end();
      });

      const dr = await lastValueFrom(download(getFullUrl('/binary'), 0.29));
      expect(dr.status).toBe<DownloadStatus>('time-out');

      // Each chunk is 50ms, so within 290ms it should get 5 chunks, including
      // 1 header chunk and 4 body chunks. 4 x chunk size = 200 bytes.
      expect(dr.byteLength).toBe(200);

      // Each chunk is 50ms; between header chunk (1st) and 4th body chunk (5th)
      // is 200ms. 200bytes / 200 ms == 1000 bytes/sec.
      expect(dr.bytesPerSecond).toBeGreaterThan(900);
      expect(dr.bytesPerSecond).toBeLessThan(1100);
    });

    it('reports error on unsupported scheme', async () => {
      const url = getFullUrl('mms://localhost/abc');
      const dr = await lastValueFrom(download(url, 1));
      expect(dr.status).toBe<DownloadStatus>('error');
      expect(dr.error).toBeTruthy();
      expect(dr.error?.message).toContain('Unsupported protocol mms');
    });

    it('reports error on connection establishment', async () => {
      // get an unused port
      const secondServerInfo = await Server.createAndListen();
      secondServerInfo.serverInstance.close();
      const port = secondServerInfo.port;
      // connecting to an unused port should fail.
      const url = getFullUrl(`http://localhost:${port}/`);
      const dr = await lastValueFrom(download(getFullUrl(url), 1));
      expect(dr.status).toBe<DownloadStatus>('error');
      expect(dr.error).toBeTruthy();
      expect(dr.error?.message).toContain('connect ECONNREFUSED');
    });

    it('reports error on bad status code', async () => {
      server!.listeners.set('/bad', (req, resp) => {
        resp.writeHead(400).end('body');
      });
      const dr = await lastValueFrom(download(getFullUrl('/bad'), 1));
      expect(dr.status).toBe<DownloadStatus>('error');
      expect(dr.statusCode).toBe(400);
    });

    it('reports error on connection reset', async () => {
      server!.listeners.set('/bad', (req, resp) => {
        resp.writeHead(200).destroy();
      });
      const dr = await lastValueFrom(download(getFullUrl('/bad'), 1));
      expect(dr.status).toBe<DownloadStatus>('error');
      expect(dr.error).toBeTruthy();
      expect(dr.error?.message).toContain('socket hang up');
    });

    it('reports time-out on response late on first byte', async () => {
      server!.listeners.set('/slow', async (req, resp) => {
        await sleep(500);
        resp.writeHead(200).end('body');
      });
      const dr = await lastValueFrom(download(getFullUrl('/slow'), 0.2));
      expect(dr.status).toBe<DownloadStatus>('time-out');
    });

    it('reports time-out on response body taking too long', async () => {
      server!.listeners.set('/slow', async (req, resp) => {
        resp.writeHead(200).flushHeaders();
        await sleep(500);
        resp.end('body');
      });
      const dr = await lastValueFrom(download(getFullUrl('/slow'), 0.2));
      expect(dr.status).toBe<DownloadStatus>('time-out');
    });

    it('destroys connection on unsubscribed observable', async () => {
      const dedicatedServer = await Server.createAndListen();
      dedicatedServer.listeners.set('/slow', async (req, resp) => {
        await sleep(500);
        resp.writeHead(200).end('body');
      });

      try {
        expect(dedicatedServer.numConnections).toBe(0);
        const url = getFullUrl(`http://localhost:${dedicatedServer.port}/slow`);
        const obs = download(url, 1);
        await sleep(50);
        expect(dedicatedServer.numConnections).toBe(0);
        const subscr = obs.subscribe();
        await sleep(50);
        expect(dedicatedServer.numConnections).toBe(1);
        subscr.unsubscribe();
        await sleep(50);
        expect(dedicatedServer.numConnections).toBe(0);
      } finally {
        dedicatedServer.serverInstance.close();
      }
    });
  });
});

/** Example usage: `await sleep(100);` */
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
