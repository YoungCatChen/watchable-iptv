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
  const ch1 = new M3u8Channel(['http://dont-care']);
  const ch2 = new M3u8Channel(['http://dont-care']);
  const spiedFn1 = jest.spyOn(ch1, 'composeText').mockReturnValue('http://ch1');
  const spiedFn2 = jest.spyOn(ch2, 'composeText').mockReturnValue('http://ch2');
  jest.spyOn(ch1, 'probePassed', 'get').mockReturnValue(false);
  jest.spyOn(ch2, 'probePassed', 'get').mockReturnValue(true);

  beforeEach(() => {
    jest.clearAllMocks();
    cl.channels.splice(0); // remove all elements from the array
  });

  it('keeps empty options as default', () => {
    cl.channels.push(ch1, ch2);
    const text = cl.composeText();
    expect(spiedFn1).toHaveBeenCalledWith({});
    expect(spiedFn2).toHaveBeenCalledWith({});
    expect(text).toEqual('#EXTM3U\nhttp://ch1\nhttp://ch2\n');
  });

  it('can put bad channels at last', () => {
    cl.channels.push(ch1, ch2);
    const text = cl.composeText({badChannelsAtLast: true});
    expect(text).toEqual('#EXTM3U\nhttp://ch2\nhttp://ch1\n');
  });

  it('passes through options', () => {
    cl.channels.push(ch1);
    cl.composeText({
      useDereferencedUrl: true,
      channelNameFn: () => 'NAME',
      channelGroupFn: () => 'GROUP',
    });
    expect(spiedFn1).toHaveBeenCalledWith({
      useDereferencedUrl: true,
      channelName: 'NAME',
      channelGroup: 'GROUP',
    } as ChannelTextComposeOptions);
  });
});
