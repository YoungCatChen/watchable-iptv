import {FollowOptions, http, https} from 'follow-redirects';
import {RequestOptions} from 'http';
import {Observable} from 'rxjs';
import {URL} from 'url';

const USER_AGENT = 'iPlayTV/3.0.0';

export function download(
  url: string,
  timeout = 10
): Observable<DownloadResult> {
  const obs = new Observable<DownloadResult>(subscriber => {
    const result = new DownloadResult(url);
    let req: ReturnType<typeof http.get> | null = null;
    let timeoutHandle: NodeJS.Timeout | null = null;

    function clearAndEmit(resultStatus: DownloadStatus, error?: Error) {
      req?.destroy();
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (subscriber.closed) return;
      result.status = resultStatus;
      result.error = error;
      subscriber.next(result);
      subscriber.complete();
    }

    timeoutHandle = setTimeout(() => clearAndEmit('time-out'), timeout * 1000);

    const urlObj = new URL(url);
    const httpObj = urlObj.protocol === 'https:' ? https : http;
    const options: RequestOptions & FollowOptions<RequestOptions> = {
      followRedirects: true,
      trackRedirects: true,
      maxBodyLength: 10 * 1024 * 1024,
      headers: {'user-agent': USER_AGENT},
    };
    Object.assign(urlObj, options);

    req = httpObj.get(urlObj, resp => {
      resp.on('data', (chunk: Buffer) => result.chunks.push(chunk));
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
  bytesPerSecond: number[] = [];
  chunks: Buffer[] = [];

  constructor(public responseUrl: string) {}

  get body(): Buffer {
    return Buffer.concat(this.chunks);
  }

  get text(): string {
    return this.body.toString('utf-8');
  }
}

// download(
//   'http://39.134.115.163:8080/PLTV/88888910/224/3221225618/index.m3u8'
// ).subscribe(dr => {
//   console.log(dr, dr.text.length, dr.text);
// });

// download(
//   'http://39.135.138.60:18890/PLTV/88888910/224/3221225618/1640158888-1-1639657009.hls.ts?ssr_hostlv1=39.134.116.2:18890&ssr_host=117.169.124.137:8080&tenantId=8601',
//   1
// ).subscribe(dr => {
//   console.log(dr, dr.text.length);
// });