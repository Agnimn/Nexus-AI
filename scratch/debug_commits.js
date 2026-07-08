import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: 'postgresql://postgres:Bunny95%40@localhost:5432/ai_pr_reviewer' });

async function run() {
  await client.connect();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const res = await client.query('select id, repo_id, sha, committed_at, message from developer_commits where committed_at >= $1', [since]);
  console.log('Total commits found in last 30 days:', res.rows.length);
  console.log(res.rows.map(r => ({ id: r.id, repo_id: r.repo_id, sha: r.sha.slice(0,7), date: r.committed_at.toISOString() })));
  await client.end();
}

run().catch(console.error);
