import * as fs from 'fs';
import * as m3u8Parser from 'm3u8-parser';
import {Manifest} from './m3u8-parser-objects';

m3u8Parser.A;
console.log('Will read this file:');
console.log(process.argv[2]);
const contents = fs.readFileSync(process.argv[2], {encoding: 'utf-8'});
console.log('Done reading the file. Length: ', contents.length, 'Will parse.');
const parser = new m3u8Parser.Parser();
parser.push(contents);
parser.end();
const manifest = parser.manifest as Manifest;
console.log('Done parsing. Results:');
console.log(JSON.stringify(manifest, null, '  '));
const channelListUrls = process.argv.slice(2);
