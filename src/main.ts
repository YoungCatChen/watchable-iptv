import arrayShuffle from 'array-shuffle';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
  defer as observableDefer,
  forkJoin,
  from as observableFrom,
  lastValueFrom,
  map,
  mergeAll,
  Observable,
  tap,
} from 'rxjs';
import {URL} from 'url';
import {download} from './downloader.js';
import {
  M3u8Channel,
  M3u8ChannelList,
  parseM3u8ChannelListFile,
} from './m3u8-channel-list.js';
import {
  ChannelProbeResult,
  HostAvailabilityMap,
  probeChannel,
} from './m3u8-channel-prober.js';

export async function main(channelListUrls: string[]): Promise<void> {
  const resultFiles = getChannelListFilenames(channelListUrls);
  const channelListTextsAndUrls = await downloadPlaylists(channelListUrls);
  const channelLists = channelListTextsAndUrls.map(([content, respUrl]) =>
    parseM3u8ChannelListFile(content, respUrl)
  );
  const allChannels = channelLists.map(list => list.channels).flat();
  await annotateChannels(allChannels);
  writeChannelLists(channelLists, resultFiles);
}

function getChannelListFilenames(channelListUrls: string[]): string[] {
  const bases = channelListUrls.map(s => {
    const filename = path.basename(new URL(s).pathname);
    const ext = path.extname(filename);
    const base = filename.slice(0, -ext.length);
    return base || 'no-name';
  });

  const baseToCount: {[base: string]: number} = {};
  for (let i = 0; i < bases.length; ++i) {
    const count = (baseToCount[bases[i]] = (baseToCount[bases[i]] || 0) + 1);
    if (count >= 2) bases[i] += String(count);
  }

  return bases.map(base => base + '.m3u8');
}

async function downloadPlaylists(
  urls: string[]
): Promise<Array<[string, URL]>> {
  if (urls.length === 0) return [];
  const observables = urls.map(url => downloadPlaylist$(url));
  return lastValueFrom(forkJoin(observables));
}

function downloadPlaylist$(url: string): Observable<[string, URL]> {
  return download(url).pipe(
    map(dr => {
      if (dr.status !== 'done' || !dr.looksLikeText) {
        console.debug(dr);
        throw new Error('Could not download playlist ' + url);
      }
      return [dr.text, dr.respUrl];
    })
  );
}

interface ChannelExtra {
  probePassed?: boolean;
  debugProbeResult?: ChannelProbeResult;
}

async function annotateChannels(channels: M3u8Channel[]): Promise<{}> {
  if (channels.length === 0) return {};
  return lastValueFrom(annotateChannels$(channels));
}

function annotateChannels$(
  channels: Array<M3u8Channel & ChannelExtra>
): Observable<{}> {
  channels = channels.filter(channel => !!channel.url);
  channels = arrayShuffle(channels);
  const hostAvailability = new HostAvailabilityMap();
  const observables = channels.map(channel =>
    observableDefer(() => probeChannel(channel.url!, hostAvailability)).pipe(
      tap(probeResult => {
        channel.probePassed = probeResult.passed;
        channel.debugProbeResult = probeResult;
        logProbeResult(channel);
      })
    )
  );
  return observableFrom(observables).pipe(mergeAll(5));
}

function logProbeResult(channel: M3u8Channel & ChannelExtra) {
  if (channel.debugProbeResult?.passed) {
    const lastDr =
      channel.debugProbeResult.downloadResults[
        channel.debugProbeResult.downloadResults.length - 1
      ];
    if (lastDr) {
      console.log(
        Math.round(lastDr.bytesPerSecond / 1000),
        'KB/s\t\t',
        channel.url?.href
      );
    } else {
      console.log('Good\t\t\t', channel.url?.href);
    }
  } else {
    console.log(' ', channel.debugProbeResult?.reason, '\t', channel.url?.href);
  }
}

function writeChannelLists(
  channelLists: M3u8ChannelList[],
  filepaths: string[]
) {
  assert.ok(channelLists.length === filepaths.length);
  for (let i = 0; i < channelLists.length; i++) {
    writeChannelList(channelLists[i], filepaths[i]);
  }
}

function writeChannelList(channelList: M3u8ChannelList, filepath: string) {
  const texts = [channelList.headerText];
  for (const ch of channelList.channels) {
    const channel = ch as M3u8Channel & ChannelExtra;
    if (channel.probePassed) texts.push(channel.text);
  }
  fs.writeFileSync(filepath, texts.join('\n'));
}

// main([
//   'https://iptv-org.github.io/iptv/languages/zho.m3u',
//   'https://iptv-org.github.io/iptv/languages/zho.m3u',
// ]);
