import {M3u8Channel} from './m3u8-channel.js';
import {Mock} from 'jest-mock';
import {jest} from '@jest/globals';
import {ChannelProbeResult} from './channel-prober.js';

describe('M3u8Channel.consumeAndParse()', () => {
  function mockCtor(): typeof M3u8Channel & Mock<unknown, unknown[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return jest.fn() as any;
  }

  it('does nothing if input is empty', () => {
    const ctor = mockCtor();

    let arr = ['', '  '];
    let result = M3u8Channel.consumeAndParse(arr, ctor);
    expect(arr).toEqual([]);
    expect(result).toBeNull();

    arr = [];
    result = M3u8Channel.consumeAndParse(arr, ctor);
    expect(arr).toEqual([]);
    expect(result).toBeNull();

    expect(ctor).toHaveBeenCalledTimes(0);
  });

  it('does nothing if no url', () => {
    const ctor = mockCtor();
    const arr = ['#FOO', '#BAR', '#EXTINF:', '#FOZ'];
    const result = M3u8Channel.consumeAndParse(arr, ctor);
    expect(ctor).toHaveBeenCalledTimes(0);
    expect(result).toBeNull();
    expect(arr).toEqual([]);
  });

  it('consumes a channel', () => {
    const ctor = mockCtor();
    const arr = ['http://a'];
    const result = M3u8Channel.consumeAndParse(arr, ctor);
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor).toHaveBeenCalledWith(['http://a']);
    expect(result).toBeTruthy();
    expect(arr).toEqual([]);
  });

  it('consumes a channel with comments', () => {
    const ctor = mockCtor();
    const arr = ['#FOO', 'http://a', '#BAR', 'http://b'];
    const result = M3u8Channel.consumeAndParse(arr, ctor);
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor).toHaveBeenCalledWith(['#FOO', 'http://a', '#BAR']);
    expect(result).toBeTruthy();
    expect(arr).toEqual(['http://b']);
  });

  it('trims spaces', () => {
    const ctor = mockCtor();
    const arr = [' #FOO ', ' http://a '];
    const result = M3u8Channel.consumeAndParse(arr, ctor);
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor).toHaveBeenCalledWith(['#FOO', 'http://a']);
    expect(result).toBeTruthy();
    expect(arr).toEqual([]);
  });

  it('stops at second url', () => {
    const ctor = mockCtor();
    const arr = ['http://a', 'http://b', 'http://c'];
    const result = M3u8Channel.consumeAndParse(arr, ctor);
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor).toHaveBeenCalledWith(['http://a']);
    expect(result).toBeTruthy();
    expect(arr).toEqual(['http://b', 'http://c']);
  });

  it('stops at a media start after a url', () => {
    const ctor = mockCtor();
    const arr = ['#AA', '#EXTINF:', 'http://a', '#BB', '#EXTINF:', 'http://b'];
    const result = M3u8Channel.consumeAndParse(arr, ctor);
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor).toHaveBeenCalledWith(['#AA', '#EXTINF:', 'http://a', '#BB']);
    expect(result).toBeTruthy();
    expect(arr).toEqual(['#EXTINF:', 'http://b']);
  });
});

describe('M3u8Channel constructor', () => {
  class TestChannel extends M3u8Channel {
    get textPattern() {
      return this.textPattern_;
    }
  }

  it('gets information from text', () => {
    const ch = new TestChannel(['#EXTINF:0 group-title="A",BTV-1', 'http://a']);
    expect(ch.channelName).toEqual('BTV-1');
    expect(ch.channelGroup).toEqual('A');
    expect(ch.url).toEqual('http://a');
    expect(ch.textPattern).toEqual(
      '#EXTINF:0 group-title="{{GROUP}}",{{NAME}}\n{{URL}}'
    );
  });

  it('respects empty channel name and empty channel group', () => {
    const ch = new TestChannel(['#EXTINF:0 group-title="",', 'http://a']);
    expect(ch.channelName).toEqual('');
    expect(ch.channelGroup).toEqual('');
    expect(ch.textPattern).toEqual(
      '#EXTINF:0 group-title="{{GROUP}}",{{NAME}}\n{{URL}}'
    );
  });

  it('gets information from #EXT-X-STREAM-INF directive too', () => {
    const ch = new TestChannel([
      '#EXT-X-STREAM-INF:group-title="A",BTV-1',
      'http://a',
    ]);
    expect(ch.channelName).toEqual('BTV-1');
    expect(ch.channelGroup).toEqual('A');
  });

  it('does not over-extract from wrong directive', () => {
    const ch = new TestChannel(['#WRONG:0 group-title="A",BTV-1', 'http://a']);
    expect(ch.channelName).toEqual('');
    expect(ch.channelGroup).toEqual('');
  });

  it('does not over-extract channel name from random attribute', () => {
    const ch = new TestChannel(['#EXT-X-STREAM-INF:FRAME-RATE=30', 'http://a']);
    expect(ch.channelName).toEqual('');
  });

  it('trims channel name', () => {
    const ch = new TestChannel(['#EXTINF:0, BTV-1', 'http://a']);
    expect(ch.channelName).toEqual('BTV-1');
    expect(ch.textPattern).toEqual('#EXTINF:0,{{NAME}}\n{{URL}}');
  });

  it('passes text through', () => {
    const ch = new TestChannel(['#EXTINF:0,BTV-1', '#FOO', 'http://a', '#BAR']);
    expect(ch.textPattern).toEqual('#EXTINF:0,{{NAME}}\n#FOO\n{{URL}}\n#BAR');
  });
});

describe('M3u8Channel.composeText()', () => {
  it('overwrites channel name and channel group', () => {
    const ch = new M3u8Channel(['#EXTINF:0 group-title="A",BTV-1', 'http://a']);
    const text = ch.composeText({channelName: '@@', channelGroup: '##'});
    expect(text).toEqual('#EXTINF:0 group-title="##",@@\nhttp://a');
  });
});

describe('M3u8Channel.composeText() and fillInProbeResult()', () => {
  it('respect dereferenced url', () => {
    const probeResult = new ChannelProbeResult('http://dont-care');
    jest.spyOn(probeResult, 'getDereferencedUrl').mockReturnValue('http://b');
    const ch = new M3u8Channel(['#EXTINF:0,BTV-1', 'http://a']);
    ch.fillInProbeResult(probeResult);
    const text = ch.composeText({useDereferencedUrl: true});
    expect(text).toEqual('#EXTINF:0,BTV-1\nhttp://b');
  });
});
