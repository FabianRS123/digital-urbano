import { buildOfficialSnapshot, readOfficialSnapshot, saveOfficialSnapshot } from '../src/data/realData';

const previous = readOfficialSnapshot();
const snapshot = await buildOfficialSnapshot((message) => console.log(message));
if (previous?.version === snapshot.version) snapshot.createdAt = previous.createdAt;
await saveOfficialSnapshot(snapshot, process.argv.includes('--seed'));
console.log(JSON.stringify({ version: snapshot.version, months: snapshot.months.length,
  facilities: snapshot.facilities.length, sisMatched: snapshot.counts.sisMatched,
  period: `${snapshot.months[0]}–${snapshot.months.at(-1)}` }, null, 2));
