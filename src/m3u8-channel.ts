import Deque from 'collections/deque.js';
import {ChannelProbeResult} from './channel-prober';

export interface ChannelTextComposeOptions {
  channelName?: string;
  channelGroup?: string;
  useDereferencedUrl?: boolean;
}

export class M3u8Channel {
  static isChannelStart(line: string): boolean {
    throw new Error();
  }
  static consumeAndParse(lines: string[]): M3u8Channel {
    throw new Error();
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

console.log(Deque);
