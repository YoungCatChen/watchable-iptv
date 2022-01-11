import assert from 'assert';
import {URL} from 'url';
import {ChannelProbeResult} from './channel-prober.js';

/** Determines if a line of text is a comment, as opposed to a URL. */
export function isM3uComment(line: string): boolean {
  return line.startsWith('#');
}

/**
 * Determines if a line of comment text indicates the start of a media in an
 * m3u playlist.
 */
export function isMediaStart(line: string): boolean {
  return line.startsWith('#EXTINF:') || line.startsWith('#EXT-X-STREAM-INF:');
}

export interface ChannelTextComposeOptions {
  channelName?: string;
  channelGroup?: string;
  useDereferencedUrl?: boolean;
}

/** Represents a media channel in an m3u playlist. */
export class M3u8Channel {
  /**
   * Consumes the first few `lines` of text and creates an `M3u8Channel` object.
   *
   * @param lines An array for lines of texts. The first (few) element(s) in the
   *    input array `lines` will be consumed (removed) for the first channel.
   *    Caller may call this function again with the same array object to
   *    get the second channel.
   *
   * @param klass The `M3u8Channel` class. Only useful for testing.
   *
   * @returns An `M3u8Channel` object, if it finds a media URL from the text
   *    lines. Otherwise null.
   */
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
      const isComment = isM3uComment(line);
      if (urlWasSeen && (!isComment || isMediaStart(line))) break;
      if (!isComment) urlWasSeen = true;
      consumed.push(line);
    }
    const channel = urlWasSeen ? new klass(consumed) : null;
    lines.splice(0, i);
    return channel;
  }

  public parentPlaylistUrl?: string | URL;
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
      if (!isM3uComment(lines[i])) {
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
