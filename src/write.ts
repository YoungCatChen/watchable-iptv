import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {URL} from 'url';
import {AnnotatedChannel} from './channel-annotator.js';
import {M3u8Channel, M3u8ChannelList} from './m3u8-channel-list.js';

/**
 * Gets output filenames for processed playlist files, according to their URLs.
 *
 * The last part of the path of the URL is used as the basename of the resulting
 * filename, and then `.m3u8` will be added as the extention name. For example,
 * `http://foo.bar/fuz/baz.php?pass=abc` will result in `baz.m3u8`.
 *
 * If the result includes same filenames, a number will be appended. For
 * example, if `baz` is duplicated, `baz.m3u8`, `baz2.m3u8`, `baz3.m3u8`, ...
 * will be returned.
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

  return bases.map(base => base + '.m3u8');
}

/** Writes channel lists' contents as files to disk. */
export function writeChannelLists(
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
    const channel = ch as M3u8Channel & AnnotatedChannel;
    if (channel.probePassed) texts.push(channel.text);
  }
  fs.writeFileSync(filepath, texts.join('\n'));
}
