import {exit} from 'process';
import {main} from './main.js';

const channelListUrls = process.argv.slice(2);

main(channelListUrls).then(
  () => exit(0),
  err => {
    console.error(err);
    exit(1);
  }
);
