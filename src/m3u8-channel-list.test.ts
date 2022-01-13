import {jest} from '@jest/globals';
import {M3u8ChannelList} from './m3u8-channel-list.js';
import {ChannelTextComposeOptions, M3u8Channel} from './m3u8-channel.js';

describe('M3u8ChannelList.parse()', () => {
  it('parses m3u text format', () => {
    const cl = M3u8ChannelList.parse(`#EXTM3U
#EXTINF:-1,CCTV
http://a
#EXTINF:-1,BTV
http://b`);
    expect(cl.headerText).toEqual('#EXTM3U');
    expect(cl.channels).toHaveLength(2);
    expect(cl.channels[0].channelName).toEqual('CCTV');
    expect(cl.channels[0].url).toEqual('http://a');
    expect(cl.channels[1].channelName).toEqual('BTV');
    expect(cl.channels[1].url).toEqual('http://b');
  });

  it('works with no-comment m3u', () => {
    const cl = M3u8ChannelList.parse('http://a\nhttp://b');
    expect(cl.headerText).toEqual('');
    expect(cl.channels).toHaveLength(2);
    expect(cl.channels[0].url).toEqual('http://a');
    expect(cl.channels[1].url).toEqual('http://b');
  });

  it('works with an empty file', () => {
    const cl = M3u8ChannelList.parse('');
    expect(cl.headerText).toEqual('');
    expect(cl.channels).toHaveLength(0);
  });

  it('works with a header-only m3u', () => {
    const cl = M3u8ChannelList.parse('#FOO\n\n#BAR');
    expect(cl.headerText).toEqual('#FOO\n\n#BAR');
    expect(cl.channels).toHaveLength(0);
  });

  it('works with an incomplete m3u', () => {
    const cl = M3u8ChannelList.parse('http://a\n#EXTINF:-1,BTV');
    expect(cl.channels).toHaveLength(1);
    expect(cl.channels[0].url).toEqual('http://a');
  });

  it('recognizes header until a media start', () => {
    const cl = M3u8ChannelList.parse(`#FOO
#BAR
#EXTINF:-1
http://a`);
    expect(cl.headerText).toEqual('#FOO\n#BAR');
    expect(cl.channels).toHaveLength(1);
    expect(cl.channels[0].url).toEqual('http://a');
  });

  it('recognizes header until a URL', () => {
    const cl = M3u8ChannelList.parse(`#FOO
#BAR
http://a`);
    expect(cl.headerText).toEqual('#FOO\n#BAR');
    expect(cl.channels).toHaveLength(1);
    expect(cl.channels[0].url).toEqual('http://a');
  });

  it('removes spaces', () => {
    const cl = M3u8ChannelList.parse(
      '  #EXTM3U  \n' + '  #EXTINF:-1,CCTV  \n' + '  http://a  \n'
    );
    expect(cl.headerText).toEqual('#EXTM3U');
    expect(cl.channels).toHaveLength(1);
    expect(cl.channels[0].channelName).toEqual('CCTV');
    expect(cl.channels[0].url).toEqual('http://a');
  });
});

describe('M3u8ChannelList.composeText()', () => {
  const cl = new M3u8ChannelList('#EXTM3U');
  const ch = new M3u8Channel(['http://a']);
  const mockFn = jest.spyOn(ch, 'composeText').mockReturnValue('http://b');
  cl.channels.push(ch);

  beforeEach(() => mockFn.mockClear());

  it('keeps empty options as default', () => {
    cl.composeText();
    expect(mockFn).toHaveBeenCalledWith({});
  });

  it('respects options', () => {
    cl.composeText({
      useDereferencedUrl: true,
      channelNameFn: () => 'NAME',
      channelGroupFn: () => 'GROUP',
    });
    expect(mockFn).toHaveBeenCalledWith({
      useDereferencedUrl: true,
      channelName: 'NAME',
      channelGroup: 'GROUP',
    } as ChannelTextComposeOptions);
  });
});