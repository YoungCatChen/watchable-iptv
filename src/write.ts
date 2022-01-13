import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {URL} from 'url';
import {M3u8ChannelList} from './m3u8-channel-list.js';

/**
 * Gets output filenames for processed playlist files, according to their URLs.
 *
 * The last part of the path of the URL is used as the basename of the resulting
 * filename. For example, `http://foo.bar/fuz/baz.php?pass=abc` will result in
 * `baz`. Caller usually wants to append `.m3u8` extension by itself.
 *
 * If the result includes same filenames, a number will be appended. For
 * example, if `baz` is duplicated, `baz`, `baz2`, `baz3`, ... will be returned.
 */
export function getOutputFilenames(channelListUrls: string[]): string[] {
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

  return bases;
}

/** Writes contents as text files to disk. */
export function writeFiles(contents: string[], filepaths: string[]): void {
  assert.ok(contents.length === filepaths.length);
  for (let i = 0; i < contents.length; i++) {
    fs.writeFileSync(filepaths[i], contents[i]);
  }
}

/** Writes channel lists' contents as files to disk. */
export function writeChannelLists(
  channelLists: M3u8ChannelList[],
  filepaths: string[]
): void {
  assert.ok(channelLists.length === filepaths.length);
  for (let i = 0; i < channelLists.length; i++) {
    writeChannelList(channelLists[i], filepaths[i]);
  }
}

function writeChannelList(channelList: M3u8ChannelList, filepath: string) {
  const text = channelList.composeText({
    useDereferencedUrl: false,
    channelNameFn: ch => (ch.probePassed ? '' : '❌') + ch.channelName,
    channelGroupFn: ch => (ch.probePassed ? '' : '❌') + ch.channelGroup,
  });
  fs.writeFileSync(filepath, text);
}
