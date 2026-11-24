import { Route, Switch } from "wouter";
import { Case } from "./routes/Case.tsx";
import { CaseFile } from "./routes/CaseFile.tsx";
import { MostWanted } from "./routes/MostWanted.tsx";
import { NotFound } from "./routes/NotFound.tsx";
import { Record } from "./routes/Record.tsx";
import { Secret } from "./routes/Secret.tsx";
import { Title } from "./routes/Title.tsx";
import { Disclaimer } from "./ui/Disclaimer.tsx";

export function App() {
  return (
    <>
      <Switch>
        <Route path="/" component={Title} />
        <Route path="/case/:id/file" component={CaseFile} />
        <Route path="/case/:id" component={Case} />
        <Route path="/most-wanted" component={MostWanted} />
        <Route path="/secret" component={Secret} />
        <Route path="/record" component={Record} />
        <Route component={NotFound} />
      </Switch>
      <Disclaimer />
    </>
  );
}
