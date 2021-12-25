import * as assert from 'assert';
import {firstValueFrom} from 'rxjs';
import {URL} from 'url';
import {download, DownloadResult} from './downloader';

export class ChannelProbeResult {
  readonly downloadResults: DownloadResult[] = [];
  reason?: 'playlist-has-no-media' | 'playlist-too-nested' | 'media-too-slow';

  get passed(): boolean {
    return !this.reason;
  }
}

export async function probeChannel(
  url: string | URL
): Promise<ChannelProbeResult> {
  if (typeof url === 'string') url = new URL(url);
  const probeResult = new ChannelProbeResult();
  let downloadResult: DownloadResult;

  for (let i = 0; i < 5; ++i) {
    downloadResult = await firstValueFrom(download(url, 10));
    probeResult.downloadResults.push(downloadResult);
    if (downloadResult.status === 'done' && downloadResult.looksLikeText) {
      const nextUrl = findFirstMediaUrl(downloadResult.text);
      if (!nextUrl) {
        probeResult.reason = 'playlist-has-no-media';
        return probeResult;
      }
      url = new URL(nextUrl, downloadResult.responseUrl);
    } else {
      break;
    }
  }

  assert(downloadResult!);

  // If we have redirected a few times and still got a text file, mark as bad.
  if (downloadResult.looksLikeText) {
    probeResult.reason = 'playlist-too-nested';
    return probeResult;
  }

  // When we reach here, we should have tried downloading a video file.
  // Mark as good only if download speed is high enough.
  if (
    downloadResult.status === 'done' ||
    (downloadResult.status === 'time-out' &&
      downloadResult.bytesPerSecond >= 100000)
  ) {
    // do nothing.
  } else {
    probeResult.reason = 'media-too-slow';
  }
  return probeResult;
}

function findFirstMediaUrl(m3u8Text: string): string | null {
  for (let line of m3u8Text.split(/\r?\n/)) {
    line = line.trim();
    if (!line.startsWith('#')) return line;
  }
  return null;
}

// probeChannel(
//   'http://39.134.115.163:8080/PLTV/88888910/224/3221225618/index.m3u8'
// ).then(r => {
//   console.log(r);
// });
