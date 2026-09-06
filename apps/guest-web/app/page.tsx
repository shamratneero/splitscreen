import Link from "next/link";

export default function Home() {
  return <main className="welcome"><p className="wordmark">AddaSplit</p><h1>Split bills, not friendships.</h1><p>Open a shared link to claim your items.</p><Link className="button" href="/s/demo-sultans-dine">Open demo split</Link></main>;
}
