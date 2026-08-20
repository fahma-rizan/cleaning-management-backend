/**
 * inspect-schema.js — READ-ONLY schema inspection of the shared Atlas database.
 *
 * Connects with the raw MongoDB driver only (no Mongoose models/schemas are
 * ever defined or loaded here), so there is zero chance of this script
 * triggering autoIndex creation, a write, or any app-side logic. It only
 * lists collections and samples a handful of documents from each to report
 * field names / types / nested shapes, then disconnects and exits.
 *
 * Usage: node scripts/inspect-schema.js
 *
 * Reads MONGODB_URI from the project ROOT .env (not backend/.env), since
 * that's where the shared Atlas connection string lives.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { MongoClient } = require('mongodb');

const SAMPLE_SIZE = 5;

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not found in root .env — aborting.');
  process.exit(1);
}

// Never print the credential-bearing URI as-is.
const redactedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');

/** Best-effort human-readable type label, including Mongo-specific types. */
function typeLabel(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'array<empty>';
    const inner = new Set(value.map(typeLabel));
    return `array<${[...inner].join('|')}>`;
  }
  if (value && typeof value === 'object') {
    if (value._bsontype === 'ObjectId' || value.constructor?.name === 'ObjectId') return 'ObjectId';
    if (value instanceof Date) return 'Date';
    return 'object';
  }
  return typeof value; // string, number, boolean, undefined
}

/** Flattens one document's top-level (and one level of nested-object) fields into "path: type" lines. */
function describeDoc(doc, prefix = '', out = []) {
  for (const [key, value] of Object.entries(doc)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const label = typeLabel(value);
    out.push(`${path}: ${label}`);
    if (value && typeof value === 'object' && !Array.isArray(value) &&
        value._bsontype !== 'ObjectId' && !(value instanceof Date)) {
      describeDoc(value, path, out);
    }
  }
  return out;
}

async function run() {
  console.log(`Connecting (read-only) to: ${redactedUri}\n`);
  const client = new MongoClient(uri, { readPreference: 'secondaryPreferred' });

  try {
    await client.connect();
    const db = client.db(); // db name comes from the URI path
    console.log(`Connected. Database: "${db.databaseName}"\n`);
    console.log('══════════════════════════════════════════════════════════\n');

    const collections = await db.listCollections().toArray();
    if (collections.length === 0) {
      console.log('No collections found in this database.');
      return;
    }

    console.log(`Found ${collections.length} collection(s): ${collections.map(c => c.name).join(', ')}\n`);

    for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
      const coll  = db.collection(name);
      const count = await coll.estimatedDocumentCount();
      const docs  = await coll.aggregate([{ $sample: { size: SAMPLE_SIZE } }]).toArray();

      console.log(`── ${name}  (${count} document${count === 1 ? '' : 's'} total) ${'─'.repeat(Math.max(0, 40 - name.length))}`);

      if (docs.length === 0) {
        console.log('  (empty collection)\n');
        continue;
      }

      // Union of fields seen across the sample, so optional fields aren't missed.
      const fieldMap  = new Map(); // path -> Set of type labels seen
      const valueMap  = new Map(); // path -> Set of example scalar values seen
      for (const doc of docs) {
        for (const line of describeDoc(doc)) {
          const [path, label] = [line.slice(0, line.indexOf(': ')), line.slice(line.indexOf(': ') + 2)];
          if (!fieldMap.has(path)) fieldMap.set(path, new Set());
          fieldMap.get(path).add(label);
        }
        (function collectValues(obj, prefix = '') {
          for (const [key, value] of Object.entries(obj)) {
            const path = prefix ? `${prefix}.${key}` : key;
            if (value && typeof value === 'object' && !Array.isArray(value) &&
                value._bsontype !== 'ObjectId' && !(value instanceof Date)) {
              collectValues(value, path);
              continue;
            }
            if (['string', 'number', 'boolean'].includes(typeof value)) {
              if (!valueMap.has(path)) valueMap.set(path, new Set());
              if (valueMap.get(path).size < 6) valueMap.get(path).add(value);
            }
          }
        })(doc);
      }

      for (const [path, labels] of fieldMap) {
        const examples = valueMap.has(path) ? ` — e.g. ${[...valueMap.get(path)].map(v => JSON.stringify(v)).join(', ')}` : '';
        console.log(`  ${path}: ${[...labels].join(' | ')}${examples}`);
      }
      console.log(`  (sampled ${docs.length} of ${count} document(s))\n`);
    }

    console.log('══════════════════════════════════════════════════════════');
    console.log('Inspection complete — no writes were performed.');
  } finally {
    await client.close();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Inspection failed:', err.message);
    process.exit(1);
  });
