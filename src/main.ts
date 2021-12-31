import {forkJoin, lastValueFrom, map, Observable} from 'rxjs';
import {URL} from 'url';
import {annotateChannels} from './channel-annotator.js';
import {download} from './downloader.js';
import {parseM3u8ChannelListFile} from './m3u8-channel-list.js';
import {getOutputFilenames, writeChannelLists} from './write.js';

/**
 * The main function: downloads channel list files and writes processed files
 * to the current directory on disk.
 */
export async function main(channelListUrls: string[]): Promise<void> {
  const resultFiles = getOutputFilenames(channelListUrls);

  console.info(
    'Will download playlists',
    channelListUrls,
    'and will write to',
    resultFiles,
    '.'
  );

  console.info('Start downloading playlists...');
  const channelListTextsAndUrls = await downloadPlaylists(channelListUrls);

  console.info(`Downloaded ${resultFiles.length} playlists. Start parsing...`);
  const channelLists = channelListTextsAndUrls.map(([content, respUrl]) =>
    parseM3u8ChannelListFile(content, respUrl)
  );
  const allChannels = channelLists.map(list => list.channels).flat();

  console.info(
    `Parsed ${resultFiles.length} playlists. ` +
      `Start probing ${allChannels.length} channels...`
  );
  await annotateChannels(allChannels);

  console.info(`Writing ${resultFiles.length} channel list files to disk...`);
  writeChannelLists(channelLists, resultFiles);

  console.info('Done.');
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
      return [dr.text, dr.respUrl];
    })
  );
}

// main([
//   'https://iptv-org.github.io/iptv/languages/zho.m3u',
//   'https://iptv-org.github.io/iptv/languages/zho.m3u',
// ]);
