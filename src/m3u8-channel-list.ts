import {URL} from 'url';
import {isMediaStart, isMediaUrl, M3u8Channel} from './m3u8-channel.js';

/** Represents a channel list, usually as a playlist file. */
export class M3u8ChannelList {
  static findFirstMediaUrl(m3u8Text: string): string | null {
    for (let line of m3u8Text.split(/\r?\n/)) {
      line = line.trim();
      if (isMediaUrl(line)) return line;
    }
    return null;
  }

  static findMediaUrlIfSingleTrivialMedia(m3u8Text: string): string | null {
    const text = m3u8Text.trim();
    if (text.startsWith('http') && text.indexOf('\n') === -1) return text;
    return null;
  }

  /** Parses a m3u file into an `M3u8ChannelList` object. */
  static parse(text: string): M3u8ChannelList {
    const lines = text.split(/\r?\n/).map(s => s.trim());

    let i = 0;
    for (; i < lines.length; i++) {
      const line = lines[i];
      if (isMediaStart(line) || isMediaUrl(line)) break;
    }

    const headerText = lines.slice(0, i).join('\n');
    const result = new M3u8ChannelList(headerText);

    const mediaLines = lines.slice(i);
    let channel: M3u8Channel | null = null;

    do {
      channel = M3u8Channel.consumeAndParse(mediaLines);
      if (channel) result.channels.push(channel);
    } while (channel);

    return result;
  }

  constructor(readonly headerText: string) {}
  readonly channels: M3u8Channel[] = [];
  private playlistUrl_?: string | URL;

  get playlistUrl(): string | URL | undefined {
    return this.playlistUrl_;
  }
  set playlistUrl(url: string | URL | undefined) {
    this.playlistUrl_ = url;
    for (const ch of this.channels) ch.parentPlaylistUrl = url;
  }

  composeText(options?: ChannelListTextComposeOptions): string {
    let texts = [this.headerText];
    const badChannelTexts: string[] = [];

    for (const ch of this.channels) {
      const targetArray =
        options?.badChannelsAtLast && !ch.probePassed ? badChannelTexts : texts;
      targetArray.push(
        ch.composeText({
          useDereferencedUrl: options?.useDereferencedUrl,
          channelName: options?.channelNameFn
            ? options.channelNameFn(ch)
            : undefined,
          channelGroup: options?.channelGroupFn
            ? options.channelGroupFn(ch)
            : undefined,
        })
      );
    }
    texts = texts.concat(badChannelTexts);
    texts.push('');
    return texts.join('\n');
  }
}

export interface ChannelListTextComposeOptions {
  channelNameFn?: (channel: M3u8Channel) => string;
  channelGroupFn?: (channel: M3u8Channel) => string;
  useDereferencedUrl?: boolean;
  badChannelsAtLast?: boolean;
}

// import * as fs from 'fs';
// console.log('Will read this file:', process.argv[2]);
// const contents = fs.readFileSync(process.argv[2], {encoding: 'utf-8'});
// const results = parseM3u8ChannelListFile(contents, 'http://a/b/c');
// console.log(results);
