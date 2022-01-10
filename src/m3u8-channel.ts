// import Deque from 'collections/deque.js';
import assert from 'assert';
import {ChannelProbeResult} from './channel-prober';

export interface ChannelTextComposeOptions {
  channelName?: string;
  channelGroup?: string;
  useDereferencedUrl?: boolean;
}

export class M3u8Channel {
  static consumeAndParse(
    lines: string[],
    klass: typeof M3u8Channel = M3u8Channel
  ): M3u8Channel | null {
    if (lines.length === 0) return null;
    let urlWasSeen = false;
    const consumed = [];
    let i = 0;
    for (; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const isComment = line.startsWith('#');
      if (urlWasSeen && (!isComment || isMediaStart(line))) break;
      if (!isComment) urlWasSeen = true;
      consumed.push(line);
    }
    const channel = urlWasSeen ? new klass(consumed) : null;
    lines.splice(0, i);
    return channel;
  }

  protected readonly textPattern_: string;
  private channelName_ = '';
  private channelGroup_ = '';
  private url_ = '';
  private probePassed_?: boolean;
  private dereferencedUrl_?: string;

  get channelName() {
    return this.channelName_;
  }
  get channelGroup() {
    return this.channelGroup_;
  }
  get url() {
    return this.url_;
  }
  get probePassed() {
    return this.probePassed_;
  }
  get dereferencedUrl() {
    return this.dereferencedUrl_;
  }

  constructor(
    /**
     * Lines of texts. Caller must assure:
     *
     * 1. each line to be `trim()`ed, otherwise `this.url` would be wrong.
     * 2. a URL line to be included, otherwise an exception would be thrown.
     * 3. that they only include one URL line, and no more than one media-start
     *    line, otherwise the information from last occurrence would be
     *    captured and information from other occurrence(s) would be lost, and
     *    `composeText()` wouldn't work correctly.
     */
    lines: string[]
  ) {
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith('#')) {
        this.url_ = lines[i];
        lines[i] = '{{URL}}';
      }
      if (isMediaStart(lines[i])) {
        lines[i] = lines[i]
          .replace(/\b(group-title=['"])(.*?)(['"])/, (match, p1, p2, p3) => {
            this.channelGroup_ = p2;
            return p1 + '{{GROUP}}' + p3;
          })
          .replace(/,([^,=]*)$/, (match, p1) => {
            this.channelName_ = p1.trim();
            return ',{{NAME}}';
          });
      }
    }
    assert.ok(this.url_);
    this.textPattern_ = lines.join('\n');
  }

  fillInProbeResult(probeResult: ChannelProbeResult): void {
    this.probePassed_ = probeResult.passed;
    this.dereferencedUrl_ = probeResult.getDereferencedUrl();
  }

  composeText(options?: ChannelTextComposeOptions) {
    const url =
      (options?.useDereferencedUrl && this.dereferencedUrl_) || this.url_ || '';
    return this.textPattern_
      .replace('{{URL}}', url)
      .replace('{{NAME}}', options?.channelName || this.channelName_)
      .replace('{{GROUP}}', options?.channelGroup || this.channelGroup_);
  }
}

function isMediaStart(line: string): boolean {
  return line.startsWith('#EXTINF:') || line.startsWith('#EXT-X-STREAM-INF:');
}

// console.log(Deque);
