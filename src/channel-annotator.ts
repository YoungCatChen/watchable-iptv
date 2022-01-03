import arrayShuffle from 'array-shuffle';
import {
  defer as observableDefer,
  from as observableFrom,
  lastValueFrom,
  mergeAll,
  Observable,
  tap,
} from 'rxjs';
import {
  ChannelProbeResult,
  HostAvailabilityMap,
  probeChannel,
} from './channel-prober.js';
import {M3u8Channel} from './m3u8-channel-list.js';

/** Annotation information to be stored in a `M3u8Channel`. */
export interface AnnotatedChannel {
  probePassed?: boolean;
  dereferencedUrl?: string;
}

/**
 * Probes each channel's watchability and attaches annotation as properties in
 * `AnnotatedChannel` to each channel.
 *
 * @param channels Input channels. The elements inside will be annotated.
 * @returns A promise to indicate completion, but nothing inside.
 */
export async function annotateChannels(channels: M3u8Channel[]): Promise<{}> {
  if (channels.length === 0) return {};
  return lastValueFrom(annotateChannels$(channels));
}

/** Internal implementation with Observables of `annotateChannels()`. */
function annotateChannels$(
  channels: Array<M3u8Channel & AnnotatedChannel>
): Observable<{}> {
  channels = channels.filter(channel => !!channel.url);
  channels = arrayShuffle(channels);
  const hostAvailability = new HostAvailabilityMap();
  const observables = channels.map(channel =>
    observableDefer(() => probeChannel(channel.url!, hostAvailability)).pipe(
      tap(probeResult => {
        channel.probePassed = probeResult.passed;
        channel.dereferencedUrl = probeResult.getDereferencedUrl();
        logProbeResult(channel, probeResult);
      })
    )
  );
  return observableFrom(observables).pipe(mergeAll(5));
}

/** Logs the probe result briefly to console. */
function logProbeResult(
  channel: M3u8Channel & AnnotatedChannel,
  probeResult: ChannelProbeResult
) {
  const drs = probeResult.downloadResults;
  const lastDr = drs[drs.length - 1];
  let msg: string;

  if (probeResult.previousProbePassed !== undefined) {
    msg = 'Previously ' + (probeResult.passed ? 'good' : 'bad');
  } else if (probeResult.passed) {
    if (lastDr) {
      msg = `${Math.round(lastDr.bytesPerSecond / 1000)} KB/s`;
    } else {
      msg = '(no DownloadResult)';
    }
  } else {
    msg = probeResult.reason || '(unknown reason)';
    if (probeResult.reason === 'media-too-slow' && lastDr) {
      msg += ` ${Math.round(lastDr.bytesPerSecond / 1000)} KB/s`;
    }
  }

  const url = channel.url?.href;
  // const derefUrl = channel.dereferencedUrl;

  console.debug(
    probeResult.passed ? '✅' : '❌',
    msg.padEnd(25),
    url
    // derefUrl && derefUrl !== url ? `⇒ ${derefUrl}` : ''
  );
}
