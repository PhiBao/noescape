import { useParams } from "wouter";

export function Case() {
  const { id } = useParams();
  return (
    <main>
      <h1>Case route</h1>
      <p>Case {id} placeholder.</p>
    </main>
  );
}
