import fs from 'fs';
import path from 'path';


const dataDir = `${__dirname}/data`;


export function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}


export const ECHO_RESPONSE = readFile(path.join(dataDir, 'echo_response.txt'));
export const WELCOME_TEXT = readFile(path.join(dataDir, 'welcome.txt'));
