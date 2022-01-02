import assert from 'assert';
import {forkJoin, lastValueFrom, map, Observable} from 'rxjs';
import {URL} from 'url';
import {annotateChannels} from './channel-annotator.js';
import {download} from './downloader.js';
import {parseM3u8ChannelListFile} from './m3u8-channel-list.js';
import {getOutputFilenames, writeChannelLists, writeFiles} from './write.js';

/**
 * The main function: downloads channel list files and writes processed files
 * to the current directory on disk.
 */
export async function main(urls: string[]): Promise<void> {
  const resultBases = getOutputFilenames(urls);
  const originCopies = resultBases.map(base => base + '.m3u');
  const processedOutputs = resultBases.map(base => base + '.p.m3u');

  console.info(
    new Date(),
    ': Will download playlists',
    urls,
    'as',
    originCopies,
    'and will write processed playlists to',
    processedOutputs,
    '.'
  );

  console.info(`Start downloading ${urls.length} playlists...`);
  const channelListTextsAndUrls = await downloadPlaylists(urls);

  console.info('Saving original copies...');
  writeFiles(
    channelListTextsAndUrls.map(([text]) => text),
    originCopies
  );

  console.info('Start parsing playlists...');
  const channelLists = channelListTextsAndUrls.map(([content, respUrl]) =>
    parseM3u8ChannelListFile(content, respUrl)
  );
  const allChannels = channelLists.map(list => list.channels).flat();

  console.info(`Start probing ${allChannels.length} channels...`);
  await annotateChannels(allChannels);

  console.info(`Writing ${urls.length} processed playlists to disk...`);
  writeChannelLists(channelLists, processedOutputs);

  console.info(new Date(), ': Done.');
}

/**
 * Downloads one or more playlist files.
 *
 * @returns An array, whose element is the text contents and a response URL
 *    (after redirection) of a downloaded file.
 */
async function downloadPlaylists(
  urls: string[]
): Promise<Array<[string, URL]>> {
  if (urls.length === 0) return [];
  const observables = urls.map(url => downloadPlaylist$(url));
  return lastValueFrom(forkJoin(observables));
}

/** Internal implementation with Observables of `downloadPlaylists()`. */
function downloadPlaylist$(url: string): Observable<[string, URL]> {
  return download(url).pipe(
    map(dr => {
      if (dr.status !== 'done' || !dr.looksLikeText) {
        console.debug(dr);
        throw new Error('Could not download playlist ' + url);
      }
      assert.ok(dr.respUrl);
      return [dr.text, dr.respUrl];
    })
  );
}

// main([
//   'https://iptv-org.github.io/iptv/languages/zho.m3u',
//   'https://iptv-org.github.io/iptv/languages/zho.m3u',
// ]);
