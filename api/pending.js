const REPO = 'yuribeats/the-boards';
const FILE_PATH = 'data/pending.json';
const BRANCH = 'main';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const password = req.headers['x-admin-password'];
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: 'Server misconfigured' });

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (!resp.ok) throw new Error('Failed to read pending.json');
    const data = await resp.json();
    const content = Buffer.from(data.content, 'base64').toString('utf8');
    const pending = JSON.parse(content);

    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).json({ pending });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
