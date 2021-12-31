import followRedirects, {FollowOptions} from 'follow-redirects';
import {IncomingMessage, RequestOptions} from 'http';
import {Observable} from 'rxjs';
import {URL} from 'url';
import urlToOptions from 'url-to-options';
import {inspect} from 'util';
const {http, https} = followRedirects;

const USER_AGENT = 'iPlayTV/3.0.0';

/** Downloads contents from a URL, following potential redirections. */
export function download(
  url: string | URL,
  timeout = 10
): Observable<DownloadResult> {
  const obs = new Observable<DownloadResult>(subscriber => {
    if (typeof url === 'string') url = new URL(url);
    const result = new DownloadResult(url);

    let req: ReturnType<typeof http.get> | null = null;
    let resp: IncomingMessage | null = null;
    let timeoutHandle: NodeJS.Timeout | null = null;

    function clearAndEmit(resultStatus: DownloadStatus, error?: Error) {
      req?.destroy();
      resp?.destroy();
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (subscriber.closed) return;
      result.status = resultStatus;
      result.error = error;
      subscriber.next(result);
      subscriber.complete();
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      clearAndEmit('error');
      return;
    }

    timeoutHandle = setTimeout(() => clearAndEmit('time-out'), timeout * 1000);

    const httpObj = url.protocol === 'https:' ? https : http;
    const options: RequestOptions & FollowOptions<RequestOptions> = {
      ...urlToOptions(url),
      followRedirects: true,
      trackRedirects: true,
      maxBodyLength: 10 * 1024 * 1024,
      headers: {'user-agent': USER_AGENT},
    };

    req = httpObj.get(options, response => {
      resp = response;
      result.respUrl = new URL(response.responseUrl);
      result.pushStartChunk();
      if ((resp.statusCode || 0) >= 400) clearAndEmit('error');
      resp.on('data', (chunk: Buffer) => result.pushChunk(chunk));
      resp.on('end', () => clearAndEmit('done'));
      resp.on('error', (err: Error) => clearAndEmit('error', err));
    });

    req.on('error', (err: Error) => clearAndEmit('error', err));
    return () => clearAndEmit('aborted');
  });

  return obs;
}

export type DownloadStatus =
  | 'pending'
  | 'done'
  | 'error'
  | 'time-out'
  | 'aborted';

export class DownloadResult {
  status: DownloadStatus = 'pending';
  error?: Error;
  private readonly chunks: Array<{timestamp: number; chunk: Buffer}> = [];

  /** The response URL. May differ from the `reqUrl` if redirection occurs. */
  respUrl: URL;

  constructor(
    /** The request URL. May differ from the `respUrl` if redirection occurs. */
    readonly reqUrl: URL
  ) {
    this.respUrl = reqUrl;
  }

  /** @override */
  toString(): String {
    return (
      `DownloadResult { ${this.status}` +
      (this.error ? `:[${this.error.message}] ` : ' ') +
      `${this.byteLength}B ${Math.round(this.bytesPerSecond / 1000)}kB/s ` +
      `URL:[${this.reqUrl.href}]` +
      (this.respUrl.href === this.reqUrl.href
        ? ''
        : `=>[${this.respUrl.href}]`) +
      ' }'
    );
  }

  [inspect.custom](): String {
    return this.toString();
  }

  get body(): Buffer {
    return Buffer.concat(this.chunks.map(item => item.chunk));
  }

  get text(): string {
    return this.body.toString('utf-8');
  }

  get byteLength(): number {
    return this.chunks
      .map(item => item.chunk.byteLength)
      .reduce((a, b) => a + b, 0);
  }

  get bytesPerSecond(): number {
    if (this.chunks.length <= 1) return NaN;
    const startTime = this.chunks[0].timestamp;
    const endTime = this.chunks[this.chunks.length - 1].timestamp;
    return (this.byteLength / (endTime - startTime)) * 1000;
  }

  get looksLikeText(): boolean {
    const item = this.chunks.find(item => item.chunk.length >= 10);
    if (!item) return false;
    let i = 0;
    for (const c of item.chunk) {
      if (c < 8 || c > 128) return false;
      if (++i >= 10) break;
    }
    return true;
  }

  pushStartChunk() {
    this.pushChunk(Buffer.from([]));
  }

  pushChunk(chunk: Buffer) {
    this.chunks.push({timestamp: Date.now(), chunk});
  }
}

// download('https://httpbin.org/get').subscribe(dr => {
//   console.log(dr, dr.text);
// });

// download(
//   'http://39.135.138.60:18890/PLTV/88888910/224/3221225618/1640222571-1-1639663375.hls.ts?ssr_hostlv1=39.134.116.2:18890&ssr_host=117.169.124.137:8080&tenantId=8601',
//   5
// ).subscribe(dr => {
//   console.log(dr);
// });
