import * as assert from 'assert';
import {firstValueFrom} from 'rxjs';
import {URL} from 'url';
import {download, DownloadResult} from './downloader.js';

export class ChannelProbeResult {
  readonly downloadResults: DownloadResult[] = [];
  reason?:
    | 'playlist-has-no-media'
    | 'playlist-too-nested'
    | 'media-too-slow'
    | 'download-error'
    | 'previously-checked';

  get passed(): boolean {
    return !this.reason;
  }
}

export class HostAvailabilityMap extends Map<string, boolean> {}

/**
 * Probes a channel for watchability.
 *
 * @param hostAvailability A map that lives across multiple calls to
 *    `probeChannel()`, if the caller wishes to skip repetitive probes to the
 *    same host.
 */
export async function probeChannel(
  url: string | URL,
  hostAvailability?: HostAvailabilityMap
): Promise<ChannelProbeResult> {
  if (typeof url === 'string') url = new URL(url);
  const probeResult = new ChannelProbeResult();
  let downloadResult: DownloadResult;

  for (let i = 0; i < 5; ++i) {
    if (hostAvailability?.get(url.hostname)) return probeResult;
    if (hostAvailability?.get(url.hostname) === false) {
      probeResult.reason = 'previously-checked';
      return probeResult;
    }

    downloadResult = await firstValueFrom(download(url, 10));
    probeResult.downloadResults.push(downloadResult);
    if (downloadResult.status === 'done' && downloadResult.looksLikeText) {
      const nextUrl = findFirstMediaUrl(downloadResult.text);
      if (!nextUrl) {
        probeResult.reason = 'playlist-has-no-media';
        return probeResult;
      }
      url = new URL(nextUrl, downloadResult.respUrl);
    } else {
      break;
    }
  }

  assert.ok(downloadResult!);

  if (downloadResult.status === 'error') {
    probeResult.reason = 'download-error';
    return probeResult;
  }

  // If we have redirected a few times and still got a text file, mark as bad.
  if (downloadResult.looksLikeText) {
    probeResult.reason = 'playlist-too-nested';
    return probeResult;
  }

  // When we reach here, we should have tried downloading a video file.
  // Mark as good only if download speed is high enough.
  if (
    (downloadResult.status === 'done' && downloadResult.byteLength >= 30000) ||
    (downloadResult.status === 'time-out' &&
      downloadResult.bytesPerSecond >= 100000)
  ) {
    // do nothing.
  } else {
    probeResult.reason = 'media-too-slow';
  }
  hostAvailability?.set(downloadResult.reqUrl.hostname, probeResult.passed);
  hostAvailability?.set(downloadResult.respUrl.hostname, probeResult.passed);
  return probeResult;
}

function findFirstMediaUrl(m3u8Text: string): string | null {
  for (let line of m3u8Text.split(/\r?\n/)) {
    line = line.trim();
    if (!line.startsWith('#')) return line;
  }
  return null;
}

// probeChannel('http://222.179.155.21:1935/ch2.m3u8').then(r => {
//   console.log(r);
// });
