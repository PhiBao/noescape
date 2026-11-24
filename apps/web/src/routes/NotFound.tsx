import { Link } from "wouter";

export function NotFound() {
  return (
    <main>
      <h1>No file under that number.</h1>
      <Link href="/">Back to the desk</Link>
    </main>
  );
}
