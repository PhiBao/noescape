import { useParams } from "wouter";

export function CaseFile() {
  const { id } = useParams();
  return (
    <main>
      <h1>Case file route</h1>
      <p>Case {id} file placeholder.</p>
    </main>
  );
}
