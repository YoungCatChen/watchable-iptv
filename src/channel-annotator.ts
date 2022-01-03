import arrayShuffle from 'array-shuffle';
import {
  defer as observableDefer,
  from as observableFrom,
  lastValueFrom,
  mergeAll,
  Observable,
  tap,
} from 'rxjs';
import {HostAvailabilityMap, probeChannel} from './channel-prober.js';
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
        console.debug(probeResult.getLogMessage());
      })
    )
  );
  return observableFrom(observables).pipe(mergeAll(5));
}
