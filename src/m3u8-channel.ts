// import Deque from 'collections/deque.js';
import {ChannelProbeResult} from './channel-prober';

export interface ChannelTextComposeOptions {
  channelName?: string;
  channelGroup?: string;
  useDereferencedUrl?: boolean;
}

export class M3u8Channel {
  static consumeAndParse(lines: string[]): M3u8Channel | null {
    if (lines.length === 0) return null;
    let urlWasSeen = false;
    let i = 0;
    for (; i < lines.length; i++) {
      const line = lines[i].trim();
      const isComment = line.startsWith('#');
      if (i !== 0 && isMediaStart(line)) break;
      if (urlWasSeen && !isComment) break;
      if (!isComment) urlWasSeen = true;
    }
    const channel = new M3u8Channel(lines, i);
    lines.splice(0, i);
    return channel;
  }

  private readonly textPattern: string;
  private readonly channelName: string;
  private readonly channelGroup: string;
  private readonly url: string;
  private probePassed_?: boolean;
  private dereferencedUrl_?: string;

  constructor(lines: string[], length = lines.length) {
    this.textPattern = '';
    this.channelName = '';
    this.channelGroup = '';
    this.url = '';
    console.log('real constructor');
  }

  fillInProbeResult(probeResult: ChannelProbeResult): void {
    this.probePassed_ = probeResult.passed;
    this.dereferencedUrl_ = probeResult.getDereferencedUrl();
  }

  get probePassed() {
    return this.probePassed_;
  }
  get dereferencedUrl() {
    return this.dereferencedUrl_;
  }

  composeText(options?: ChannelTextComposeOptions) {
    const url =
      (options?.useDereferencedUrl && this.dereferencedUrl_) || this.url || '';
    return this.textPattern
      .replace('{{URL}}', url)
      .replace('{{NAME}}', options?.channelName || this.channelName)
      .replace('{{GROUP}}', options?.channelGroup || this.channelGroup);
  }
}

function isMediaStart(line: string): boolean {
  return line.startsWith('#EXTINF:') || line.startsWith('#EXT-X-STREAM-INF:');
}

// console.log(Deque);