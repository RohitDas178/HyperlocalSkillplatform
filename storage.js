const fs = require('fs').promises;
const path = require('path');

async function readData(relativePath) {
  const p = path.join(__dirname, relativePath);
  try {
    const content = await fs.readFile(p, 'utf8');
    return JSON.parse(content || '[]');
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, '[]', 'utf8');
      return [];
    }
    throw err;
  }
}

async function writeData(relativePath, data) {
  const p = path.join(__dirname, relativePath);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { readData, writeData };
