import {mocked} from 'ts-jest/utils';
import {M3u8Channel} from './m3u8-channel.js';

test('adds 1 + 2 to equal 3', () => {
  expect(1 + 2).toBe(3);
});

describe('a', () => {
  const Mocked = mocked(M3u8Channel);
  beforeEach(() => {
    Mocked.mockClear();
  });
  it('b', () => {
    M3u8Channel.consumeAndParse(['http://a.b']);
    expect(Mocked).toHaveBeenCalledTimes(1);
  });
});
