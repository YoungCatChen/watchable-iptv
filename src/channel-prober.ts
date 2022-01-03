import * as assert from 'assert';
import {firstValueFrom} from 'rxjs';
import {URL} from 'url';
import {download, DownloadResult} from './downloader.js';
import {M3u8ChannelList2} from './m3u8-channel-list.js';

export class ChannelProbeResult {
  readonly downloadResults: DownloadResult[] = [];
  previousProbePassed?: boolean;
  reason?:
    | 'playlist-has-no-media'
    | 'playlist-too-nested'
    | 'media-too-slow'
    | 'download-error';

  get passed(): boolean {
    if (this.reason) return false;
    if (this.previousProbePassed !== undefined) return this.previousProbePassed;
    return true;
  }

  getDereferencedUrl(): string | undefined {
    const firstDr = this.downloadResults[0];
    if (!firstDr) return undefined;

    // If there is `Location:` redirection URL, return it.
    const redirectionUrl = firstDr.respUrl;
    if (redirectionUrl) return redirectionUrl.href;

    // If the response body is a playlist that contains only one media, return
    // it.
    if (firstDr.looksLikeText) {
      const url = M3u8ChannelList2.findMediaUrlIfSingleTrivialMedia(
        firstDr.text
      );
      if (url) return url;
    }

    // Can't dereference the channel URL.
    return undefined;
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
    const previousProbePassed = hostAvailability?.get(url.hostname);
    if (previousProbePassed !== undefined) {
      probeResult.previousProbePassed = previousProbePassed;
      return probeResult;
    }

    downloadResult = await firstValueFrom(download(url, 10));
    probeResult.downloadResults.push(downloadResult);

    const isPlaylist =
      downloadResult.status === 'done' &&
      downloadResult.byteLength > 0 &&
      downloadResult.looksLikeText;

    if (!isPlaylist) break;

    const nextUrl = M3u8ChannelList2.findFirstMediaUrl(downloadResult.text);
    if (!nextUrl) {
      probeResult.reason = 'playlist-has-no-media';
      return probeResult;
    }
    url = new URL(nextUrl, downloadResult.respUrl);
  }

  assert.ok(downloadResult!);

  if (downloadResult.status === 'error' || downloadResult.byteLength === 0) {
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
  assert.ok(downloadResult.respUrl);
  if (
    (downloadResult.status === 'done' && downloadResult.byteLength >= 30000) ||
    (downloadResult.status === 'time-out' &&
      downloadResult.bytesPerSecond >= 100000)
  ) {
    hostAvailability?.set(downloadResult.reqUrl.hostname, true);
    hostAvailability?.set(downloadResult.respUrl.hostname, true);
  } else {
    probeResult.reason = 'media-too-slow';
    hostAvailability?.set(downloadResult.reqUrl.hostname, false);
    hostAvailability?.set(downloadResult.respUrl.hostname, false);
  }
  return probeResult;
}

// probeChannel('http://222.179.155.21:1935/ch2.m3u8').then(r => {
//   console.log(r);
// });
