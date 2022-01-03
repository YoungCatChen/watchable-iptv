import {URL} from 'url';

/** Represents a channel list, usually as a playlist file. */
export interface M3u8ChannelList {
  headerText: string;
  channels: M3u8Channel[];
}

/** Represents a media channel, usually as an item in a playlist file. */
export interface M3u8Channel {
  text: string;
  url?: URL;
}

/** Parses a .m3u8 playlist file into the `M3u8ChannelList` representation. */
export function parseM3u8ChannelListFile(
  text: string,
  channelListUrl: string | URL
): M3u8ChannelList {
  let isHeader = true;
  const headerLines: string[] = [];

  let currentChannelLines: string[] = [];
  let currentChannelUrl: URL | undefined = undefined;
  const channels: M3u8Channel[] = [];

  function finalizeChannel() {
    if (currentChannelLines.length !== 0) {
      channels.push({
        text: currentChannelLines.join('\n'),
        url: currentChannelUrl,
      });
    }
    currentChannelLines = [];
    currentChannelUrl = undefined;
  }

  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:') || line.startsWith('#EXT-X-STREAM-INF:')) {
      isHeader = false;
      finalizeChannel();
    }
    if (isHeader) {
      headerLines.push(line);
    } else {
      if (line.startsWith('#')) {
        currentChannelLines.push(line);
      } else {
        currentChannelLines.push('{{URL}}');
        currentChannelUrl = new URL(line, channelListUrl);
      }
    }
  }

  finalizeChannel();
  return {headerText: headerLines.join('\n'), channels};
}

export class M3u8ChannelList2 {
  static findFirstMediaUrl(m3u8Text: string): string | null {
    for (let line of m3u8Text.split(/\r?\n/)) {
      line = line.trim();
      if (!line) continue;
      if (!line.startsWith('#')) return line;
    }
    return null;
  }

  static findMediaUrlIfSingleTrivialMedia(m3u8Text: string): string|null {
    const text = m3u8Text.trim();
    if (text.startsWith('http') && text.indexOf('\n') === -1) return text;
    return null;
  }
}

// import * as fs from 'fs';
// console.log('Will read this file:', process.argv[2]);
// const contents = fs.readFileSync(process.argv[2], {encoding: 'utf-8'});
// const results = parseM3u8ChannelListFile(contents, 'http://a/b/c');
// console.log(results);
