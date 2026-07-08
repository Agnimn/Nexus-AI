import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: 'postgresql://postgres:Bunny95%40@localhost:5432/ai_pr_reviewer' });

async function run() {
  await client.connect();
  const days = 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const res = await client.query('select * from developer_commits where committed_at >= $1', [since]);
  const commits = res.rows;

  const byDate = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    byDate.set(key, { commits: 0, additions: 0, deletions: 0 });
  }

  for (const c of commits) {
    const key = c.committed_at.toISOString().split("T")[0];
    if (byDate.has(key)) {
      const existing = byDate.get(key);
      existing.commits++;
    } else {
      console.log('Key NOT found in byDate:', key);
    }
  }

  console.log('Result for last 5 days:');
  const result = Array.from(byDate.entries()).map(([date, data]) => ({ date, ...data }));
  console.log(result.slice(-5));
  
  await client.end();
}

run().catch(console.error);
