import {M3u8Channel} from './m3u8-channel.js';
import {Mock} from 'jest-mock';
import {jest} from '@jest/globals';

describe('M3u8Channel.consumeAndParse', () => {
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
